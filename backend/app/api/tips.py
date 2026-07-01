from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.models import User as UserModel, Expense as ExpenseModel, TipMethod
from app.schemas.schemas import TipCreate
from app.services.utils import get_current_week_id
from app.api.deps import check_role
from app.models.models import UserRole
from datetime import datetime

router = APIRouter()

@router.post("/")
def create_tip(
    tip_in: TipCreate,
    db: Session = Depends(get_db),
    current_user = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    employee = db.query(UserModel).filter(UserModel.id == tip_in.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if tip_in.method == TipMethod.WAGES:
        employee.payable_balance += tip_in.amount
    else:
        week_id = get_current_week_id()
        expense = ExpenseModel(
            description=f"Chai - {employee.full_name}",
            amount=tip_in.amount,
            category="Chai",
            week_id=week_id
        )
        db.add(expense)

    db.commit()
    return {"message": "Tip logged successfully", "method": tip_in.method.value, "employee": employee.full_name}
