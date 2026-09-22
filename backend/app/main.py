from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import transactions, users, expenses, repayments, stats, tips, debts, carpets
from app.db.session import engine
from app.models.models import Base
from app.core.config import settings

# Create database tables
Base.metadata.create_all(bind=engine)

# Migration: add columns if missing (each try/except separately)
from sqlalchemy import text
for col in ["plate_number", "customer_phone", "custom_category"]:
    try:
        with engine.connect() as conn:
            conn.execute(text(f"ALTER TABLE transactions ADD COLUMN {col} VARCHAR"))
            conn.commit()
    except Exception:
        pass  # Column already exists

for col in ["misc_amount FLOAT DEFAULT 0.0", "misc_description VARCHAR"]:
    try:
        with engine.connect() as conn:
            conn.execute(text(f"ALTER TABLE transactions ADD COLUMN {col}"))
            conn.commit()
    except Exception:
        pass  # Column already exists

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE expenses ADD COLUMN transaction_id INTEGER"))
        conn.commit()
except Exception:
    pass  # Column already exists

for col in ["client_name VARCHAR", "image_data TEXT"]:
    try:
        with engine.connect() as conn:
            conn.execute(text(f"ALTER TABLE carpets ADD COLUMN {col}"))
            conn.commit()
    except Exception:
        pass  # Column already exists

app = FastAPI(title=settings.PROJECT_NAME)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(transactions.router, prefix="/api/v1/transactions", tags=["transactions"])
app.include_router(expenses.router, prefix="/api/v1/expenses", tags=["expenses"])
app.include_router(repayments.router, prefix="/api/v1/repayments", tags=["repayments"])
app.include_router(stats.router, prefix="/api/v1/stats", tags=["stats"])
app.include_router(tips.router, prefix="/api/v1/tips", tags=["tips"])
app.include_router(debts.router, prefix="/api/v1/debts", tags=["debts"])
app.include_router(carpets.router, prefix="/api/v1/carpets", tags=["carpets"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Carwash POS API"}
