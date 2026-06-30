from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.models import Transaction as TransactionModel, User as UserModel
from backend.app.schemas.schemas import TransactionCreate, TransactionResponse
from backend.app.services.finance import calculate_transaction
from backend.app.services.utils import get_current_week_id
from backend.app.api.deps import check_role, get_current_user
from backend.app.models.models import UserRole
from sqlalchemy import func
from typing import List

router = APIRouter()

@router.get("/", response_model=None)
def get_transactions(
    day: str = None,
    week_id: str = None,
    washer_id: int = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(TransactionModel)
    if day:
        query = query.filter(func.date(TransactionModel.timestamp) == day)
    elif week_id:
        query = query.filter(TransactionModel.week_id == week_id)

    if washer_id:
        query = query.filter(TransactionModel.washer_id == washer_id)

    # Employees can only see their own
    if current_user.role == UserRole.EMPLOYEE:
        query = query.filter(TransactionModel.washer_id == current_user.id)

    return query.all()

@router.post("/", response_model=TransactionResponse)
def create_transaction(
    transaction_in: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    # 1. Calculate financials
    result = calculate_transaction(transaction_in)

    # 2. Get current week ID
    week_id = get_current_week_id()

    # 3. Create Transaction record
    db_transaction = TransactionModel(
        washer_id=transaction_in.washer_id,
        category=transaction_in.category,
        expected_price=result.transaction_summary.expected_price,
        cash_paid=transaction_in.cash_paid,
        mpesa_paid=transaction_in.mpesa_paid,
        mpesa_transaction_id=transaction_in.mpesa_transaction_id,
        mpesa_sender_name=transaction_in.mpesa_sender_name,
        manual_tip=transaction_in.manual_tip,
        tip_method=transaction_in.tip_method,
        has_car_wash=transaction_in.has_car_wash,
        has_vacuum=transaction_in.has_vacuum,
        has_engine_wash=transaction_in.has_engine_wash,
        carpet_characteristics=transaction_in.carpet_metadata.characteristics if transaction_in.carpet_metadata else None,
        receiver_id=transaction_in.carpet_metadata.receiver_id if transaction_in.carpet_metadata else None,

        total_paid=result.transaction_summary.total_customer_paid,
        isolated_tip=result.transaction_summary.isolated_tip,
        net_business_remittance=result.transaction_summary.net_business_remittance,
        shortfall=result.transaction_summary.shortfall_detected,
        calculated_commission=result.employee_financials.calculated_commission,
        net_wage_before_tip=result.employee_financials.net_wage_before_tip,
        final_payout=result.employee_financials.final_payout_output,
        week_id=week_id
    )

    db.add(db_transaction)

    # 4. Update Employee Balances
    washer = db.query(UserModel).filter(UserModel.id == transaction_in.washer_id).first()
    if not washer:
        raise HTTPException(status_code=404, detail="Washer not found")

    washer.payable_balance += result.ledger_routing.credit_employee_wages
    washer.debt_balance += result.ledger_routing.debit_employee_debt

    db.commit()
    db.refresh(db_transaction)

    return result
