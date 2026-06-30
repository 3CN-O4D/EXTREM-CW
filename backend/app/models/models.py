from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
import enum

Base = declarative_base()

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    EMPLOYEE = "employee"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, index=True)
    abbreviation = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.EMPLOYEE)
    is_active = Column(Boolean, default=True)

    # Balances
    payable_balance = Column(Float, default=0.0)
    debt_balance = Column(Float, default=0.0)

    transactions_as_washer = relationship("Transaction", foreign_keys="Transaction.washer_id", back_populates="washer")
    transactions_as_receiver = relationship("Transaction", foreign_keys="Transaction.receiver_id", back_populates="receiver")

class ServiceCategory(str, enum.Enum):
    BICYCLE = "bicycle"
    MOTORCYCLE = "motorcycle"
    TAXI = "taxi"
    CAR = "car"
    MIDRANGE = "midrange"
    LORRY = "lorry"
    CARPET = "carpet"

class TipMethod(str, enum.Enum):
    CASH = "cash"
    WAGES = "wages"

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    washer_id = Column(Integer, ForeignKey("users.id"))
    washer = relationship("User", foreign_keys=[washer_id], back_populates="transactions_as_washer")

    category = Column(Enum(ServiceCategory))
    expected_price = Column(Float)
    cash_paid = Column(Float, default=0.0)
    mpesa_paid = Column(Float, default=0.0)
    mpesa_transaction_id = Column(String, nullable=True)
    mpesa_sender_name = Column(String, nullable=True)

    manual_tip = Column(Float, default=0.0)
    tip_method = Column(Enum(TipMethod))

    # Flags for add-ons
    has_car_wash = Column(Boolean, default=False)
    has_vacuum = Column(Boolean, default=False)
    has_engine_wash = Column(Boolean, default=False)

    # Carpet Metadata
    carpet_characteristics = Column(Text, nullable=True)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="transactions_as_receiver")

    # Financial results (stored for audit)
    total_paid = Column(Float)
    isolated_tip = Column(Float)
    net_business_remittance = Column(Float)
    shortfall = Column(Float)
    calculated_commission = Column(Float)
    net_wage_before_tip = Column(Float)
    final_payout = Column(Float)

    # Weekly reset group
    week_id = Column(String, index=True) # Format: YYYY-WW

class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    description = Column(String)
    amount = Column(Float)
    category = Column(String) # e.g., Soap, Electricity
    week_id = Column(String, index=True)

class Repayment(Base):
    __tablename__ = "repayments"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    employee_id = Column(Integer, ForeignKey("users.id"))
    amount = Column(Float)
    week_id = Column(String, index=True)

class WeeklyLog(Base):
    __tablename__ = "weekly_logs"
    id = Column(Integer, primary_key=True, index=True)
    week_id = Column(String, unique=True, index=True)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    total_revenue = Column(Float)
    total_expenses = Column(Float)
    total_labor_expense = Column(Float)
    total_profit = Column(Float)
    data_json = Column(Text) # Store serialized detailed stats
