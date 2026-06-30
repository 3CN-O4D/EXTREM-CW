from backend.app.db.session import engine
from backend.app.models.models import Base
Base.metadata.create_all(bind=engine)
print("Database tables created.")
