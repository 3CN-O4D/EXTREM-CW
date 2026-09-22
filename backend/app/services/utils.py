from datetime import datetime
from fastapi import HTTPException

def get_current_week_id():
    # Week starts Monday, resets Sunday 11:59PM
    # datetime.isocalendar() returns (year, week_number, day_of_week)
    # where Monday is 1 and Sunday is 7.
    now = datetime.utcnow()
    year, week, _ = now.isocalendar()
    return f"{year}-{week:02d}"

def validate_day(day):
    """Reject anything that is not a strict YYYY-MM-DD date (prevents
    malformed values from reaching the DB cast and causing 500s)."""
    if day is None:
        return
    try:
        datetime.strptime(day, "%Y-%m-%d")
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Invalid date. Use YYYY-MM-DD format.",
        )
