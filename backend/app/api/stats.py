from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models.models import Transaction, Expense, Repayment, User, UserRole
from app.services.utils import get_current_week_id
from app.api.deps import check_role, get_current_user
from app.models.models import User as UserModel

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

    total_cash = query.with_entities(func.sum(Transaction.total_paid)).scalar() or 0.0
    expenses = exp_query.with_entities(func.sum(Expense.amount)).scalar() or 0.0
    labor = query.filter(Transaction.final_payout > 0).with_entities(func.sum(Transaction.final_payout)).scalar() or 0.0
    revenue = query.with_entities(func.sum(Transaction.net_business_remittance)).scalar() or 0.0

    # Per-employee labor breakdown
    emp_labor = db.query(
        User.full_name, User.abbreviation,
        func.sum(Transaction.final_payout).label("wages")
    ).join(Transaction, User.id == Transaction.washer_id).filter(
        Transaction.final_payout > 0
    ).group_by(User.id)
    if day:
        emp_labor = emp_labor.filter(func.date(Transaction.timestamp) == day)
    else:
        emp_labor = emp_labor.filter(Transaction.week_id == week_id)
    emp_labor = emp_labor.all()
    labor_breakdown = [{"name": e.full_name, "abbreviation": e.abbreviation, "wages": e.wages} for e in emp_labor]

    # Counts by category
    categories = query.with_entities(Transaction.category, func.count(Transaction.id)).group_by(Transaction.category).all()
    category_counts = {cat.value: count for cat, count in categories}

    return {
        "week_id": week_id,
        "day": day,
        "total_cash_received": total_cash,
        "total_expenses": expenses,
        "balance": total_cash - expenses,
        "total_labor_expense": labor,
        "total_revenue": revenue,
        "labor_breakdown": labor_breakdown,
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

        debt_txns = db.query(Transaction).filter(
            Transaction.washer_id == emp.id,
            Transaction.shortfall > 0
        ).all()
        debt_sources = [{
            "id": t.id,
            "timestamp": t.timestamp.isoformat(),
            "category": t.category.value,
            "expected_price": t.expected_price,
            "shortfall": t.shortfall,
            "plate_number": t.plate_number
        } for t in debt_txns]

        results.append({
            "id": emp.id,
            "name": emp.full_name,
            "abbreviation": emp.abbreviation,
            "revenue_generated": emp_revenue,
            "wages_earned": emp_wages,
            "current_debt": emp.debt_balance,
            "payable_balance": emp.payable_balance,
            "service_counts": emp_counts,
            "debt_sources": debt_sources
        })
    return results

@router.get("/employees/{employee_id}", dependencies=[Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))])
def get_employee_stats(
    employee_id: int,
    week_id: str = None,
    day: str = None,
    db: Session = Depends(get_db)
):
    emp = db.query(User).filter(User.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    query = db.query(Transaction).filter(Transaction.washer_id == emp.id)
    if day:
        query = query.filter(func.date(Transaction.timestamp) == day)
    else:
        if not week_id:
            week_id = get_current_week_id()
        query = query.filter(Transaction.week_id == week_id)

    emp_revenue = query.with_entities(func.sum(Transaction.net_business_remittance)).scalar() or 0.0
    emp_wages = query.filter(Transaction.final_payout > 0).with_entities(func.sum(Transaction.final_payout)).scalar() or 0.0

    categories = query.with_entities(Transaction.category, func.count(Transaction.id)).group_by(Transaction.category).all()
    emp_counts = {cat.value: count for cat, count in categories}

    debt_txns = db.query(Transaction).filter(
        Transaction.washer_id == emp.id,
        Transaction.shortfall > 0
    ).all()
    debt_sources = [{
        "id": t.id,
        "timestamp": t.timestamp.isoformat(),
        "category": t.category.value,
        "expected_price": t.expected_price,
        "shortfall": t.shortfall,
        "plate_number": t.plate_number
    } for t in debt_txns]

    return {
        "id": emp.id,
        "name": emp.full_name,
        "abbreviation": emp.abbreviation,
        "revenue_generated": emp_revenue,
        "wages_earned": emp_wages,
        "current_debt": emp.debt_balance,
        "payable_balance": emp.payable_balance,
        "service_counts": emp_counts,
        "debt_sources": debt_sources
    }

@router.get("/me")
def get_my_stats(
    week_id: str = None,
    day: str = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(Transaction).filter(Transaction.washer_id == current_user.id)
    if day:
        query = query.filter(func.date(Transaction.timestamp) == day)
    else:
        if not week_id:
            week_id = get_current_week_id()
        query = query.filter(Transaction.week_id == week_id)

    emp_revenue = query.with_entities(func.sum(Transaction.net_business_remittance)).scalar() or 0.0
    emp_wages = query.filter(Transaction.final_payout > 0).with_entities(func.sum(Transaction.final_payout)).scalar() or 0.0

    categories = query.with_entities(Transaction.category, func.count(Transaction.id)).group_by(Transaction.category).all()
    emp_counts = {cat.value: count for cat, count in categories}

    debt_txns = db.query(Transaction).filter(
        Transaction.washer_id == current_user.id,
        Transaction.shortfall > 0
    ).all()
    debt_sources = [{
        "id": t.id,
        "timestamp": t.timestamp.isoformat(),
        "category": t.category.value,
        "expected_price": t.expected_price,
        "shortfall": t.shortfall,
        "plate_number": t.plate_number
    } for t in debt_txns]

    return {
        "id": current_user.id,
        "name": current_user.full_name,
        "abbreviation": current_user.abbreviation,
        "revenue_generated": emp_revenue,
        "wages_earned": emp_wages,
        "current_debt": current_user.debt_balance,
        "payable_balance": current_user.payable_balance,
        "service_counts": emp_counts,
        "debt_sources": debt_sources
    }
