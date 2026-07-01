from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.models import Debt as DebtModel, User as UserModel
from app.schemas.schemas import DebtCreate, DebtUpdate, DebtOut
from app.api.deps import check_role
from app.models.models import UserRole
from datetime import datetime
from typing import List

router = APIRouter()

@router.get("/", response_model=List[DebtOut])
def list_debts(
    employee_id: int = None,
    db: Session = Depends(get_db),
    current_user = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    query = db.query(DebtModel)
    if employee_id:
        query = query.filter(DebtModel.employee_id == employee_id)
    debts = query.all()
    result = []
    for d in debts:
        result.append(DebtOut(
            id=d.id, employee_id=d.employee_id, amount=d.amount,
            service=d.service, date=d.date, paid=d.paid,
            paid_date=d.paid_date, notes=d.notes, balance=d.amount - d.paid
        ))
    return result

@router.post("/", response_model=DebtOut)
def create_debt(
    debt_in: DebtCreate,
    db: Session = Depends(get_db),
    current_user = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    emp = db.query(UserModel).filter(UserModel.id == debt_in.employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    paid_date = None
    if debt_in.paid_date:
        try:
            paid_date = datetime.fromisoformat(debt_in.paid_date)
        except ValueError:
            pass

    debt = DebtModel(
        employee_id=debt_in.employee_id,
        amount=debt_in.amount,
        service=debt_in.service,
        paid=debt_in.paid,
        paid_date=paid_date,
        notes=debt_in.notes
    )
    db.add(debt)
    db.commit()
    db.refresh(debt)

    emp.debt_balance += debt_in.amount - debt_in.paid

    db.commit()

    return DebtOut(
        id=debt.id, employee_id=debt.employee_id, amount=debt.amount,
        service=debt.service, date=debt.date, paid=debt.paid,
        paid_date=debt.paid_date, notes=debt.notes, balance=debt.amount - debt.paid
    )

@router.put("/{debt_id}", response_model=DebtOut)
def update_debt(
    debt_id: int,
    debt_in: DebtUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    debt = db.query(DebtModel).filter(DebtModel.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")

    old_paid = debt.paid
    debt.paid = debt_in.paid
    if debt_in.paid_date:
        try:
            debt.paid_date = datetime.fromisoformat(debt_in.paid_date)
        except ValueError:
            pass
    db.commit()
    db.refresh(debt)

    emp = db.query(UserModel).filter(UserModel.id == debt.employee_id).first()
    if emp:
        emp.debt_balance -= old_paid
        emp.debt_balance += debt.paid
        db.commit()

    return DebtOut(
        id=debt.id, employee_id=debt.employee_id, amount=debt.amount,
        service=debt.service, date=debt.date, paid=debt.paid,
        paid_date=debt.paid_date, notes=debt.notes, balance=debt.amount - debt.paid
    )

@router.delete("/{debt_id}")
def delete_debt(
    debt_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    debt = db.query(DebtModel).filter(DebtModel.id == debt_id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")

    emp = db.query(UserModel).filter(UserModel.id == debt.employee_id).first()
    if emp:
        emp.debt_balance -= (debt.amount - debt.paid)

    db.delete(debt)
    db.commit()
    return {"message": "Debt deleted"}
