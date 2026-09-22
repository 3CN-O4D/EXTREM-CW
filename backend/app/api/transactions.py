from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.models import Transaction as TransactionModel, User as UserModel, Expense as ExpenseModel
from app.schemas.schemas import TransactionCreate, TransactionUpdate, TransactionResponse
from app.services.finance import calculate_transaction
from app.services.utils import get_current_week_id, validate_day
from app.api.deps import check_role, get_current_user
from app.models.models import UserRole, TipMethod
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
    validate_day(day)
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

def _reverse_balances(tx: TransactionModel, db: Session):
    """Reverse the balance effects of a transaction on its washer."""
    washer = db.query(UserModel).filter(UserModel.id == tx.washer_id).first()
    if washer:
        # The transaction added credit_wages to payable and debit_debt to debt
        # We stored: final_payout (negative = debt, positive = wage)
        credit = max(0.0, tx.final_payout)
        debit = abs(min(0.0, tx.final_payout))
        washer.payable_balance -= credit
        washer.debt_balance -= debit

def _apply_balances(tx: TransactionModel, db: Session):
    """Apply balance effects of a transaction on its washer."""
    washer = db.query(UserModel).filter(UserModel.id == tx.washer_id).first()
    if washer:
        credit = max(0.0, tx.final_payout)
        debit = abs(min(0.0, tx.final_payout))
        washer.payable_balance += credit
        washer.debt_balance += debit

def _sync_chai_expense(tx: TransactionModel, db: Session, isolated_tip: float, washer_name: str):
    """Keep the cash-tip 'Chai' expense in sync with a transaction.
       A tip isolated with CASH method is handed to the attendant, so the
       business must record it as an expense (float parity)."""
    existing = db.query(ExpenseModel).filter(ExpenseModel.transaction_id == tx.id).all()
    for exp in existing:
        db.delete(exp)
    if isolated_tip > 0 and tx.tip_method.value == TipMethod.CASH:
        db.add(ExpenseModel(
            description=f"Chai (tip) - {washer_name}",
            amount=isolated_tip,
            category="Chai",
            week_id=tx.week_id,
            transaction_id=tx.id
        ))

def _validate_misc(data: TransactionCreate):
    if data.misc_amount and data.misc_amount > 0:
        extra = max(0.0, (data.cash_paid + data.mpesa_paid) - data.expected_price)
        if data.misc_amount > extra:
            raise HTTPException(
                status_code=400,
                detail=f"Miscellaneous amount ({data.misc_amount}) exceeds overpayment ({extra}). "
                       "Amount beyond expected must be tip or miscellaneous."
            )
    if data.misc_amount and data.misc_amount > 0 and not data.misc_description:
        raise HTTPException(status_code=400, detail="Miscellaneous amount requires a description")

def _build_create_from_update(tx: TransactionModel, update: TransactionUpdate) -> TransactionCreate:
    """Merge existing transaction with update fields into a TransactionCreate."""
    return TransactionCreate(
        washer_id=update.washer_id if update.washer_id is not None else tx.washer_id,
        category=update.category if update.category is not None else tx.category,
        expected_price=update.expected_price if update.expected_price is not None else tx.expected_price,
        cash_paid=update.cash_paid if update.cash_paid is not None else tx.cash_paid,
        mpesa_paid=update.mpesa_paid if update.mpesa_paid is not None else tx.mpesa_paid,
        mpesa_transaction_id=update.mpesa_transaction_id if update.mpesa_transaction_id is not None else tx.mpesa_transaction_id,
        mpesa_sender_name=update.mpesa_sender_name if update.mpesa_sender_name is not None else tx.mpesa_sender_name,
        manual_tip=update.manual_tip if update.manual_tip is not None else tx.manual_tip,
        tip_method=update.tip_method if update.tip_method is not None else tx.tip_method,
        misc_amount=update.misc_amount if update.misc_amount is not None else tx.misc_amount or 0.0,
        misc_description=update.misc_description if update.misc_description is not None else tx.misc_description,
        has_car_wash=update.has_car_wash if update.has_car_wash is not None else tx.has_car_wash,
        has_vacuum=update.has_vacuum if update.has_vacuum is not None else tx.has_vacuum,
        has_engine_wash=update.has_engine_wash if update.has_engine_wash is not None else tx.has_engine_wash,
        plate_number=update.plate_number if update.plate_number is not None else tx.plate_number,
        custom_category=update.custom_category if update.custom_category is not None else tx.custom_category,
        carpet_metadata=update.carpet_metadata,
    )

@router.post("/", response_model=TransactionResponse)
def create_transaction(
    transaction_in: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    result = calculate_transaction(transaction_in)
    _validate_misc(transaction_in)
    week_id = get_current_week_id()

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
        misc_amount=transaction_in.misc_amount or 0.0,
        misc_description=transaction_in.misc_description,
        has_car_wash=transaction_in.has_car_wash,
        has_vacuum=transaction_in.has_vacuum,
        has_engine_wash=transaction_in.has_engine_wash,
        plate_number=transaction_in.plate_number,
        custom_category=transaction_in.custom_category,
        customer_phone=transaction_in.carpet_metadata.customer_phone if transaction_in.carpet_metadata else None,
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

    washer = db.query(UserModel).filter(UserModel.id == transaction_in.washer_id).first()
    if not washer:
        raise HTTPException(status_code=404, detail="Washer not found")

    washer.payable_balance += result.ledger_routing.credit_employee_wages
    washer.debt_balance += result.ledger_routing.debit_employee_debt

    db.commit()
    db.refresh(db_transaction)

    _sync_chai_expense(db_transaction, db, result.transaction_summary.isolated_tip, washer.full_name)
    db.commit()

    return TransactionResponse(
        id=db_transaction.id,
        timestamp=db_transaction.timestamp,
        transaction_summary=result.transaction_summary,
        employee_financials=result.employee_financials,
        ledger_routing=result.ledger_routing
    )

@router.put("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(
    transaction_id: int,
    update: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    tx = db.query(TransactionModel).filter(TransactionModel.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Reverse old balances
    _reverse_balances(tx, db)

    # Build merged create data and recalculate
    create_data = _build_create_from_update(tx, update)
    _validate_misc(create_data)
    result = calculate_transaction(create_data)

    # Check washer exists
    washer = db.query(UserModel).filter(UserModel.id == create_data.washer_id).first()
    if not washer:
        raise HTTPException(status_code=404, detail="Washer not found")

    # Update transaction fields
    tx.washer_id = create_data.washer_id
    tx.category = create_data.category
    tx.expected_price = result.transaction_summary.expected_price
    tx.cash_paid = create_data.cash_paid
    tx.mpesa_paid = create_data.mpesa_paid
    tx.mpesa_transaction_id = create_data.mpesa_transaction_id
    tx.mpesa_sender_name = create_data.mpesa_sender_name
    tx.manual_tip = create_data.manual_tip
    tx.tip_method = create_data.tip_method
    tx.misc_amount = create_data.misc_amount or 0.0
    tx.misc_description = create_data.misc_description
    tx.has_car_wash = create_data.has_car_wash
    tx.has_vacuum = create_data.has_vacuum
    tx.has_engine_wash = create_data.has_engine_wash
    tx.plate_number = create_data.plate_number
    tx.custom_category = create_data.custom_category
    tx.customer_phone = create_data.carpet_metadata.customer_phone if create_data.carpet_metadata else None
    tx.carpet_characteristics = create_data.carpet_metadata.characteristics if create_data.carpet_metadata else None
    tx.receiver_id = create_data.carpet_metadata.receiver_id if create_data.carpet_metadata else None
    tx.total_paid = result.transaction_summary.total_customer_paid
    tx.isolated_tip = result.transaction_summary.isolated_tip
    tx.net_business_remittance = result.transaction_summary.net_business_remittance
    tx.shortfall = result.transaction_summary.shortfall_detected
    tx.calculated_commission = result.employee_financials.calculated_commission
    tx.net_wage_before_tip = result.employee_financials.net_wage_before_tip
    tx.final_payout = result.employee_financials.final_payout_output

    # Apply new balances
    _apply_balances(tx, db)

    _sync_chai_expense(tx, db, result.transaction_summary.isolated_tip, washer.full_name)

    db.commit()
    db.refresh(tx)

    return TransactionResponse(
        id=tx.id,
        timestamp=tx.timestamp,
        transaction_summary=result.transaction_summary,
        employee_financials=result.employee_financials,
        ledger_routing=result.ledger_routing
    )

@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    tx = db.query(TransactionModel).filter(TransactionModel.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    _reverse_balances(tx, db)
    for exp in db.query(ExpenseModel).filter(ExpenseModel.transaction_id == tx.id).all():
        db.delete(exp)
    db.delete(tx)
    db.commit()

    return {"message": "Transaction deleted"}
