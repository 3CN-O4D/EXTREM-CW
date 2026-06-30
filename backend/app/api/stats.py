from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.db.session import get_db
from backend.app.models.models import Transaction, Expense, Repayment, User, UserRole
from backend.app.services.utils import get_current_week_id
from backend.app.api.deps import check_role

router = APIRouter()

@router.get("/summary", dependencies=[Depends(check_role([UserRole.ADMIN]))])
def get_weekly_summary(
    week_id: str = None,
    db: Session = Depends(get_db)
):
    if not week_id:
        week_id = get_current_week_id()

    revenue = db.query(func.sum(Transaction.net_business_remittance)).filter(Transaction.week_id == week_id).scalar() or 0.0
    expenses = db.query(func.sum(Expense.amount)).filter(Expense.week_id == week_id).scalar() or 0.0
    labor = db.query(func.sum(Transaction.final_payout)).filter(Transaction.week_id == week_id, Transaction.final_payout > 0).scalar() or 0.0

    # Total cash before and after expenses
    # Business revenue is net_business_remittance collected.
    # Total cash before expenses = revenue
    # Total cash after expenses = revenue - expenses - labor (if paid out)

    return {
        "week_id": week_id,
        "total_revenue": revenue,
        "total_expenses": expenses,
        "total_labor_expense": labor,
        "gross_profit": revenue - labor,
        "net_profit": revenue - labor - expenses,
        "total_debts": db.query(func.sum(User.debt_balance)).scalar() or 0.0
    }

@router.get("/employees", dependencies=[Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))])
def get_employee_performance(
    week_id: str = None,
    db: Session = Depends(get_db)
):
    if not week_id:
        week_id = get_current_week_id()

    employees = db.query(User).filter(User.role == UserRole.EMPLOYEE).all()
    results = []
    for emp in employees:
        emp_revenue = db.query(func.sum(Transaction.net_business_remittance)).filter(
            Transaction.washer_id == emp.id,
            Transaction.week_id == week_id
        ).scalar() or 0.0

        emp_wages = db.query(func.sum(Transaction.final_payout)).filter(
            Transaction.washer_id == emp.id,
            Transaction.week_id == week_id,
            Transaction.final_payout > 0
        ).scalar() or 0.0

        results.append({
            "id": emp.id,
            "name": emp.full_name,
            "abbreviation": emp.abbreviation,
            "revenue_generated": emp_revenue,
            "wages_earned": emp_wages,
            "current_debt": emp.debt_balance,
            "payable_balance": emp.payable_balance
        })
    return results
