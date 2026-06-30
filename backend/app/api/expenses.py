from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.models import Expense as ExpenseModel
from app.schemas.schemas import ExpenseCreate, Expense as ExpenseSchema
from app.services.utils import get_current_week_id

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
    db: Session = Depends(get_db),
    current_user = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    if not week_id:
        week_id = get_current_week_id()
    return db.query(ExpenseModel).filter(ExpenseModel.week_id == week_id).all()
