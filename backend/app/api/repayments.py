from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.models import Repayment as RepaymentModel, User as UserModel
from app.schemas.schemas import RepaymentCreate, Repayment as RepaymentSchema
from app.services.utils import get_current_week_id

from app.api.deps import check_role
from app.models.models import UserRole

router = APIRouter()

@router.post("/", response_model=RepaymentSchema)
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

    # Update debt balance
    employee.debt_balance = max(0.0, employee.debt_balance - repayment_in.amount)

    db.add(db_repayment)
    db.commit()
    db.refresh(db_repayment)
    return db_repayment
