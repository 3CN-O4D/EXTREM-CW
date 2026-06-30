from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.models import Transaction, Expense, Repayment, User, UserRole
from app.services.utils import get_current_week_id
from app.api.deps import check_role

router = APIRouter()

@router.get("/summary", dependencies=[Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))])
def get_summary(
    week_id: str = None,
    day: str = None, # YYYY-MM-DD
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)
    exp_query = db.query(Expense)

    if day:
        # Filter by specific date
        query = query.filter(func.date(Transaction.timestamp) == day)
        exp_query = exp_query.filter(func.date(Expense.timestamp) == day)
    else:
        if not week_id:
            week_id = get_current_week_id()
        query = query.filter(Transaction.week_id == week_id)
        exp_query = exp_query.filter(Expense.week_id == week_id)

    revenue = query.with_entities(func.sum(Transaction.net_business_remittance)).scalar() or 0.0
    expenses = exp_query.with_entities(func.sum(Expense.amount)).scalar() or 0.0
    labor = query.filter(Transaction.final_payout > 0).with_entities(func.sum(Transaction.final_payout)).scalar() or 0.0

    # Counts by category
    categories = query.with_entities(Transaction.category, func.count(Transaction.id)).group_by(Transaction.category).all()
    category_counts = {cat.value: count for cat, count in categories}

    return {
        "week_id": week_id,
        "day": day,
        "total_revenue": revenue,
        "total_expenses": expenses,
        "total_labor_expense": labor,
        "gross_profit": revenue - labor,
        "net_profit": revenue - labor - expenses,
        "category_counts": category_counts,
        "total_debts": db.query(func.sum(User.debt_balance)).scalar() or 0.0
    }

@router.get("/employees", dependencies=[Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))])
def get_employee_performance(
    week_id: str = None,
    day: str = None,
    db: Session = Depends(get_db)
):
    employees = db.query(User).filter(User.role == UserRole.EMPLOYEE).all()
    results = []
    for emp in employees:
        query = db.query(Transaction).filter(Transaction.washer_id == emp.id)
        if day:
            query = query.filter(func.date(Transaction.timestamp) == day)
        else:
            if not week_id:
                week_id = get_current_week_id()
            query = query.filter(Transaction.week_id == week_id)

        emp_revenue = query.with_entities(func.sum(Transaction.net_business_remittance)).scalar() or 0.0
        emp_wages = query.filter(Transaction.final_payout > 0).with_entities(func.sum(Transaction.final_payout)).scalar() or 0.0

        # Detailed counts for this employee
        categories = query.with_entities(Transaction.category, func.count(Transaction.id)).group_by(Transaction.category).all()
        emp_counts = {cat.value: count for cat, count in categories}

        results.append({
            "id": emp.id,
            "name": emp.full_name,
            "abbreviation": emp.abbreviation,
            "revenue_generated": emp_revenue,
            "wages_earned": emp_wages,
            "current_debt": emp.debt_balance,
            "payable_balance": emp.payable_balance,
            "service_counts": emp_counts
        })
    return results
