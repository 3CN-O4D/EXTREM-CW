from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from backend.app.models.models import UserRole, ServiceCategory, TipMethod
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

# Auth
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
