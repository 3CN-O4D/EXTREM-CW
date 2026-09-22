from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import func
from app.db.session import get_db
from app.models.models import Expense as ExpenseModel
from app.schemas.schemas import ExpenseCreate, Expense as ExpenseSchema
from app.services.utils import get_current_week_id, validate_day

from app.api.deps import check_role
from app.models.models import UserRole

router = APIRouter()

@router.post("/", response_model=ExpenseSchema)
def create_expense(
    expense_in: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    week_id = get_current_week_id()
    db_expense = ExpenseModel(
        description=expense_in.description,
        amount=expense_in.amount,
        category=expense_in.category,
        week_id=week_id
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

@router.get("/", response_model=List[ExpenseSchema])
def get_expenses(
    week_id: str = None,
    day: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    validate_day(day)
    query = db.query(ExpenseModel)
    if day:
        query = query.filter(func.date(ExpenseModel.timestamp) == day)
    else:
        if not week_id:
            week_id = get_current_week_id()
        query = query.filter(ExpenseModel.week_id == week_id)
    return query.all()

@router.delete("/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    exp = db.query(ExpenseModel).filter(ExpenseModel.id == expense_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(exp)
    db.commit()
    return {"message": "Expense deleted"}
