from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from app.db.session import get_db
from app.models.models import Transaction, Expense, Repayment, User, UserRole, Carpet
from app.services.utils import get_current_week_id
from app.api.deps import check_role, get_current_user
from app.models.models import User as UserModel

router = APIRouter()

def _weekday(day: str) -> str:
    try:
        return datetime.strptime(day, "%Y-%m-%d").strftime("%A")
    except Exception:
        return ""

def _collect_employee_stats(emp, db: Session, week_id: str = None, day: str = None):
    """Shared per-employee stats (identical for admin and employee self-service views)."""
    query = db.query(Transaction).filter(Transaction.washer_id == emp.id)
    if day:
        query = query.filter(func.date(Transaction.timestamp) == day)
    else:
        if not week_id:
            week_id = get_current_week_id()
        query = query.filter(Transaction.week_id == week_id)

    emp_revenue = query.with_entities(func.sum(Transaction.net_business_remittance)).scalar() or 0.0
    emp_wages = query.filter(Transaction.final_payout > 0).with_entities(func.sum(Transaction.final_payout)).scalar() or 0.0
    emp_shortfall = query.with_entities(func.sum(Transaction.shortfall)).scalar() or 0.0
    jobs_count = query.with_entities(func.count(Transaction.id)).scalar() or 0

    categories = query.with_entities(Transaction.category, func.count(Transaction.id)).group_by(Transaction.category).all()
    emp_counts = {cat.value: count for cat, count in categories}

    daily = db.query(
        func.date(Transaction.timestamp).label("day"),
        func.sum(Transaction.final_payout).label("wages")
    ).filter(
        Transaction.washer_id == emp.id,
        Transaction.final_payout > 0
    )
    if day:
        daily = daily.filter(func.date(Transaction.timestamp) == day)
    else:
        if not week_id:
            week_id = get_current_week_id()
        daily = daily.filter(Transaction.week_id == week_id)
    daily = daily.group_by(func.date(Transaction.timestamp)).all()
    wage_breakdown = [{"day": d.day, "day_of_week": _weekday(d.day), "wages": d.wages} for d in daily]

    debt_txns = db.query(Transaction).filter(
        Transaction.washer_id == emp.id,
        Transaction.shortfall > 0
    ).all()
    debt_sources = [{
        "id": t.id,
        "timestamp": t.timestamp.isoformat(),
        "category": t.category.value,
        "custom_category": t.custom_category,
        "expected_price": t.expected_price,
        "shortfall": t.shortfall,
        "plate_number": t.plate_number
    } for t in debt_txns]

    misc = query.with_entities(func.sum(Transaction.misc_amount)).scalar() or 0.0
    misc_txns = query.filter(Transaction.misc_amount > 0).all()
    misc_items = [{
        "id": t.id,
        "timestamp": t.timestamp.isoformat(),
        "amount": t.misc_amount,
        "description": t.misc_description,
        "category": t.category.value,
        "custom_category": t.custom_category,
        "plate_number": t.plate_number
    } for t in misc_txns]

    carpets_received = db.query(func.count(Carpet.id)).filter(
        Carpet.receiver_id == emp.id, Carpet.status == "received"
    ).scalar() or 0
    carpets_released = db.query(func.count(Carpet.id)).filter(
        Carpet.receiver_id == emp.id, Carpet.status == "released"
    ).scalar() or 0

    return {
        "id": emp.id,
        "name": emp.full_name,
        "abbreviation": emp.abbreviation,
        "jobs_count": jobs_count,
        "revenue_generated": emp_revenue,
        "wages_earned": emp_wages,
        "shortfall_total": emp_shortfall,
        "wage_breakdown": wage_breakdown,
        "current_debt": emp.debt_balance,
        "payable_balance": emp.payable_balance,
        "service_counts": emp_counts,
        "debt_sources": debt_sources,
        "misc_earned": misc,
        "misc_items": misc_items,
        "carpets_received": carpets_received,
        "carpets_released": carpets_released
    }

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
    misc_total = query.with_entities(func.sum(Transaction.misc_amount)).scalar() or 0.0

    misc_txns = query.filter(Transaction.misc_amount > 0).order_by(Transaction.timestamp.desc()).all()
    misc_items = [{
        "id": t.id,
        "timestamp": t.timestamp.isoformat(),
        "amount": t.misc_amount,
        "description": t.misc_description,
        "category": t.category.value,
        "custom_category": t.custom_category,
        "plate_number": t.plate_number,
        "washer": f"{t.washer.full_name} ({t.washer.abbreviation})" if t.washer else None
    } for t in misc_txns]

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
        "day_of_week": _weekday(day) if day else None,
        "total_cash_received": total_cash,
        "total_expenses": expenses,
        "balance": total_cash - expenses,
        "total_labor_expense": labor,
        "total_revenue": revenue,
        "misc_total": misc_total,
        "misc_items": misc_items,
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
    return [_collect_employee_stats(emp, db, week_id, day) for emp in employees]

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
    return _collect_employee_stats(emp, db, week_id, day)

@router.get("/me")
def get_my_stats(
    week_id: str = None,
    day: str = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    return _collect_employee_stats(current_user, db, week_id, day)