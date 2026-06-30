from sqlalchemy.orm import Session
from backend.app.models.models import User, Transaction, Expense, Repayment, WeeklyLog, UserRole
from backend.app.services.utils import get_current_week_id
from datetime import datetime
import json

def reset_weekly_balances(db: Session):
    week_id = get_current_week_id()

    # 1. Collect stats for the week
    # (Simplified for now, in a real system we'd aggregate carefully)

    # 2. Reset employee payable balances
    employees = db.query(User).filter(User.role == UserRole.EMPLOYEE).all()
    for emp in employees:
        emp.payable_balance = 0.0

    # 3. Debt balances persist as per requirement

    db.commit()
    print(f"Weekly reset completed for {week_id}")

if __name__ == "__main__":
    from backend.app.db.session import SessionLocal
    db = SessionLocal()
    reset_weekly_balances(db)
    db.close()
