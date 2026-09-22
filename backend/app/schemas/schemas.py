from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
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
    expected_price: float = Field(ge=0)
    cash_paid: float = Field(ge=0)
    mpesa_paid: float = Field(ge=0)
    mpesa_transaction_id: Optional[str] = None
    mpesa_sender_name: Optional[str] = None
    manual_tip: float = Field(default=0.0, ge=0)
    tip_method: TipMethod
    misc_amount: float = Field(default=0.0, ge=0)
    misc_description: Optional[str] = None
    has_car_wash: bool = False
    has_vacuum: bool = False
    has_engine_wash: bool = False
    plate_number: Optional[str] = None
    custom_category: Optional[str] = None
    carpet_metadata: Optional[CarpetMetadata] = None

class TransactionSummary(BaseModel):
    expected_price: float
    total_customer_paid: float
    isolated_tip: float
    misc_amount: float = 0.0
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
    id: int
    timestamp: datetime
    transaction_summary: TransactionSummary
    employee_financials: EmployeeFinancials
    ledger_routing: LedgerRouting

class TransactionUpdate(BaseModel):
    washer_id: Optional[int] = None
    category: Optional[ServiceCategory] = None
    expected_price: Optional[float] = Field(default=None, ge=0)
    cash_paid: Optional[float] = Field(default=None, ge=0)
    mpesa_paid: Optional[float] = Field(default=None, ge=0)
    mpesa_transaction_id: Optional[str] = None
    mpesa_sender_name: Optional[str] = None
    manual_tip: Optional[float] = Field(default=None, ge=0)
    tip_method: Optional[TipMethod] = None
    misc_amount: Optional[float] = Field(default=None, ge=0)
    misc_description: Optional[str] = None
    has_car_wash: Optional[bool] = None
    has_vacuum: Optional[bool] = None
    has_engine_wash: Optional[bool] = None
    plate_number: Optional[str] = None
    custom_category: Optional[str] = None
    carpet_metadata: Optional[CarpetMetadata] = None

# Expense Schemas
class ExpenseCreate(BaseModel):
    description: str
    amount: float = Field(ge=0)
    category: str

class Expense(ExpenseCreate):
    id: int
    timestamp: datetime
    week_id: str
    transaction_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

# Repayment Schemas
class RepaymentCreate(BaseModel):
    employee_id: int
    amount: float = Field(ge=0)

class Repayment(RepaymentCreate):
    id: int
    timestamp: datetime
    week_id: str

    model_config = ConfigDict(from_attributes=True)

class RepaymentOut(Repayment):
    employee_name: Optional[str] = None
    abbreviation: Optional[str] = None

# Tip Schemas
class TipCreate(BaseModel):
    employee_id: int
    amount: float = Field(ge=0)
    method: TipMethod  # WAGES = add to wage, CASH = expense

# Debt Schemas
class DebtCreate(BaseModel):
    employee_id: int
    amount: float = Field(ge=0)
    service: Optional[str] = None
    paid: float = Field(default=0.0, ge=0)
    paid_date: Optional[str] = None
    notes: Optional[str] = None

class DebtUpdate(BaseModel):
    paid: float = Field(ge=0)
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

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str

# Carpet Schemas
class CarpetCreate(BaseModel):
    receiver_id: int
    characteristics: Optional[str] = None
    client_name: Optional[str] = None
    customer_phone: Optional[str] = None
    image_data: Optional[str] = None
    expected_price: float = Field(default=0.0, ge=0)
    cash_paid: float = Field(default=0.0, ge=0)
    mpesa_paid: float = Field(default=0.0, ge=0)

class CarpetUpdate(BaseModel):
    is_washed: Optional[bool] = None
    characteristics: Optional[str] = None
    client_name: Optional[str] = None
    expected_price: Optional[float] = Field(default=None, ge=0)
    cash_paid: Optional[float] = Field(default=None, ge=0)
    mpesa_paid: Optional[float] = Field(default=None, ge=0)
    customer_phone: Optional[str] = None
    image_data: Optional[str] = None

class CarpetOut(BaseModel):
    id: int
    created_at: datetime
    receiver_id: int
    characteristics: Optional[str] = None
    client_name: Optional[str] = None
    customer_phone: Optional[str] = None
    image_data: Optional[str] = None
    expected_price: float
    cash_paid: float
    mpesa_paid: float
    is_washed: bool
    status: str
    released_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
