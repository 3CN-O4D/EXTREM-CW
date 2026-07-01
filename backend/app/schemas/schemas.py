from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.models.models import UserRole, ServiceCategory, TipMethod
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    full_name: str
    abbreviation: str
    role: UserRole = UserRole.EMPLOYEE

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    abbreviation: Optional[str] = None
    role: Optional[UserRole] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None

class User(UserBase):
    id: int
    is_active: bool
    payable_balance: float
    debt_balance: float

    model_config = ConfigDict(from_attributes=True)

# Transaction Schemas
class CarpetMetadata(BaseModel):
    characteristics: str
    receiver_id: int
    customer_phone: Optional[str] = None

class TransactionCreate(BaseModel):
    washer_id: int
    category: ServiceCategory
    expected_price: float
    cash_paid: float
    mpesa_paid: float
    mpesa_transaction_id: Optional[str] = None
    mpesa_sender_name: Optional[str] = None
    manual_tip: float = 0.0
    tip_method: TipMethod
    has_car_wash: bool = False
    has_vacuum: bool = False
    has_engine_wash: bool = False
    plate_number: Optional[str] = None
    carpet_metadata: Optional[CarpetMetadata] = None

class TransactionSummary(BaseModel):
    expected_price: float
    total_customer_paid: float
    isolated_tip: float
    net_business_remittance: float
    shortfall_detected: float

class EmployeeFinancials(BaseModel):
    calculated_commission: float
    net_wage_before_tip: float
    final_payout_output: float

class LedgerRouting(BaseModel):
    credit_employee_wages: float
    debit_employee_debt: float
    business_gross_revenue: float
    business_labor_expense: float

class TransactionResponse(BaseModel):
    transaction_summary: TransactionSummary
    employee_financials: EmployeeFinancials
    ledger_routing: LedgerRouting

class TransactionUpdate(BaseModel):
    washer_id: Optional[int] = None
    category: Optional[ServiceCategory] = None
    expected_price: Optional[float] = None
    cash_paid: Optional[float] = None
    mpesa_paid: Optional[float] = None
    mpesa_transaction_id: Optional[str] = None
    mpesa_sender_name: Optional[str] = None
    manual_tip: Optional[float] = None
    tip_method: Optional[TipMethod] = None
    has_car_wash: Optional[bool] = None
    has_vacuum: Optional[bool] = None
    has_engine_wash: Optional[bool] = None
    plate_number: Optional[str] = None
    carpet_metadata: Optional[CarpetMetadata] = None

# Expense Schemas
class ExpenseCreate(BaseModel):
    description: str
    amount: float
    category: str

class Expense(ExpenseCreate):
    id: int
    timestamp: datetime
    week_id: str

    model_config = ConfigDict(from_attributes=True)

# Repayment Schemas
class RepaymentCreate(BaseModel):
    employee_id: int
    amount: float

class Repayment(RepaymentCreate):
    id: int
    timestamp: datetime
    week_id: str

    model_config = ConfigDict(from_attributes=True)

# Tip Schemas
class TipCreate(BaseModel):
    employee_id: int
    amount: float
    method: TipMethod  # WAGES = add to wage, CASH = expense

# Debt Schemas
class DebtCreate(BaseModel):
    employee_id: int
    amount: float
    service: Optional[str] = None
    paid: float = 0.0
    paid_date: Optional[str] = None
    notes: Optional[str] = None

class DebtUpdate(BaseModel):
    paid: float
    paid_date: Optional[str] = None

class DebtOut(BaseModel):
    id: int
    employee_id: int
    amount: float
    service: Optional[str] = None
    date: datetime
    paid: float
    paid_date: Optional[datetime] = None
    notes: Optional[str] = None
    balance: float

    model_config = ConfigDict(from_attributes=True)

# Auth
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
