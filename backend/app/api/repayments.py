from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.models import Repayment as RepaymentModel, User as UserModel, Debt as DebtModel
from app.schemas.schemas import RepaymentCreate, RepaymentOut
from app.services.utils import get_current_week_id
from datetime import datetime as dt
from typing import List

from app.api.deps import check_role, get_current_user
from app.models.models import UserRole

router = APIRouter()

@router.get("/", response_model=List[RepaymentOut])
def list_repayments(
    week_id: str = None,
    day: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = (
        db.query(RepaymentModel, UserModel)
        .join(UserModel, UserModel.id == RepaymentModel.employee_id)
    )
    if current_user.role == UserRole.EMPLOYEE:
        query = query.filter(RepaymentModel.employee_id == current_user.id)
    if day:
        query = query.filter(func.date(RepaymentModel.timestamp) == day)
    else:
        if not week_id:
            week_id = get_current_week_id()
        query = query.filter(RepaymentModel.week_id == week_id)
    rows = query.order_by(RepaymentModel.timestamp.desc()).all()
    return [{
        "id": r.id,
        "employee_id": r.employee_id,
        "amount": r.amount,
        "timestamp": r.timestamp,
        "week_id": r.week_id,
        "employee_name": emp.full_name,
        "abbreviation": emp.abbreviation
    } for r, emp in rows]

@router.post("/", response_model=RepaymentOut)
def create_repayment(
    repayment_in: RepaymentCreate,
    db: Session = Depends(get_db),
    current_user = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    employee = db.query(UserModel).filter(UserModel.id == repayment_in.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    week_id = get_current_week_id()
    db_repayment = RepaymentModel(
        employee_id=repayment_in.employee_id,
        amount=repayment_in.amount,
        week_id=week_id
    )

    # Update debt balance (clamped so it can never go negative)
    employee.debt_balance = max(0.0, employee.debt_balance - repayment_in.amount)

    # Reconcile: allocate the repayment against the employee's outstanding
    # debts (oldest first) so per-row balances match the real debt_balance
    remaining = repayment_in.amount
    open_debts = (
        db.query(DebtModel)
        .filter(DebtModel.employee_id == repayment_in.employee_id)
        .order_by(DebtModel.date.asc())
        .all()
    )
    now = dt.utcnow()
    for debt in open_debts:
        if remaining <= 0:
            break
        outstanding = debt.amount - debt.paid
        if outstanding <= 0:
            continue
        applied = min(remaining, outstanding)
        debt.paid += applied
        debt.paid_date = now
        remaining -= applied

    db.add(db_repayment)
    db.commit()
    db.refresh(db_repayment)
    return db_repayment
