from app.db.session import SessionLocal
from app.models.models import User, UserRole
from app.core.security import get_password_hash

db = SessionLocal()
if not db.query(User).filter(User.abbreviation == "manager").first():
    manager = User(
        full_name="Business Manager",
        abbreviation="manager",
        role=UserRole.MANAGER,
        hashed_password=get_password_hash("manager")
    )
    db.add(manager)
    db.commit()
db.close()
