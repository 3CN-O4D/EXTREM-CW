from app.db.session import engine, SessionLocal
from app.models.models import Base, User, UserRole
from app.core.security import get_password_hash

Base.metadata.create_all(bind=engine)

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

if not db.query(User).filter(User.abbreviation == "admin").first():
    admin = User(
        full_name="Administrator",
        abbreviation="admin",
        role=UserRole.ADMIN,
        hashed_password=get_password_hash("admin")
    )
    db.add(admin)
    db.commit()
db.close()
