from datetime import datetime

def get_current_week_id():
    # Week starts Monday, resets Sunday 11:59PM
    # datetime.isocalendar() returns (year, week_number, day_of_week)
    # where Monday is 1 and Sunday is 7.
    now = datetime.utcnow()
    year, week, _ = now.isocalendar()
    return f"{year}-{week:02d}"
