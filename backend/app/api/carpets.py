from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.db.session import get_db
from app.models.models import Carpet as CarpetModel, User, UserRole, ServiceCategory, TipMethod
from app.schemas.schemas import CarpetCreate, CarpetUpdate, CarpetOut, TransactionCreate, CarpetMetadata
from app.api.deps import check_role, get_current_user
from app.api.transactions import create_transaction
from typing import List

router = APIRouter()

RETENTION_DAYS = 1

def _auto_delete_released(db: Session):
    """Delete released carpets that are older than RETENTION_DAYS."""
    cutoff = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
    stale = db.query(CarpetModel).filter(
        CarpetModel.status == "released",
        CarpetModel.released_at < cutoff
    ).all()
    for c in stale:
        db.delete(c)
    if stale:
        db.commit()

@router.get("/", response_model=List[CarpetOut])
def list_carpets(
    status: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    _auto_delete_released(db)
    query = db.query(CarpetModel)
    # Employees can only see carpets they received (includes their released ones)
    if current_user.role == UserRole.EMPLOYEE:
        query = query.filter(CarpetModel.receiver_id == current_user.id)
    if status in ("received", "released"):
        query = query.filter(CarpetModel.status == status)
    return query.order_by(CarpetModel.created_at.desc()).all()

@router.post("/", response_model=CarpetOut, dependencies=[Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))])
def receive_carpet(data: CarpetCreate, db: Session = Depends(get_db)):
    receiver = db.query(User).filter(User.id == data.receiver_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    carpet = CarpetModel(
        receiver_id=data.receiver_id,
        characteristics=data.characteristics,
        client_name=data.client_name,
        customer_phone=data.customer_phone,
        image_data=data.image_data,
        expected_price=data.expected_price,
        cash_paid=data.cash_paid,
        mpesa_paid=data.mpesa_paid,
        is_washed=False,
        status="received",
        released_at=None
    )
    db.add(carpet)
    db.commit()
    db.refresh(carpet)
    return carpet

@router.patch("/{carpet_id}/wash", response_model=CarpetOut, dependencies=[Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))])
def mark_washed(carpet_id: int, db: Session = Depends(get_db)):
    carpet = db.query(CarpetModel).filter(CarpetModel.id == carpet_id).first()
    if not carpet:
        raise HTTPException(status_code=404, detail="Carpet not found")
    carpet.is_washed = True
    db.commit()
    db.refresh(carpet)
    return carpet

@router.patch("/{carpet_id}", response_model=CarpetOut, dependencies=[Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))])
def update_carpet(carpet_id: int, update: CarpetUpdate, db: Session = Depends(get_db)):
    carpet = db.query(CarpetModel).filter(CarpetModel.id == carpet_id).first()
    if not carpet:
        raise HTTPException(status_code=404, detail="Carpet not found")
    if update.is_washed is not None:
        carpet.is_washed = update.is_washed
    if update.characteristics is not None:
        carpet.characteristics = update.characteristics
    if update.client_name is not None:
        carpet.client_name = update.client_name
    if update.expected_price is not None:
        carpet.expected_price = update.expected_price
    if update.cash_paid is not None:
        carpet.cash_paid = update.cash_paid
    if update.mpesa_paid is not None:
        carpet.mpesa_paid = update.mpesa_paid
    if update.customer_phone is not None:
        carpet.customer_phone = update.customer_phone
    if update.image_data is not None:
        carpet.image_data = update.image_data
    db.commit()
    db.refresh(carpet)
    return carpet

@router.post("/{carpet_id}/release", response_model=CarpetOut)
def release_carpet(
    carpet_id: int,
    update: CarpetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))
):
    carpet = db.query(CarpetModel).filter(CarpetModel.id == carpet_id).first()
    if not carpet:
        raise HTTPException(status_code=404, detail="Carpet not found")
    if carpet.status == "released":
        raise HTTPException(status_code=400, detail="Carpet already released")
    if update.cash_paid is not None:
        carpet.cash_paid = update.cash_paid
    if update.mpesa_paid is not None:
        carpet.mpesa_paid = update.mpesa_paid
    if update.customer_phone is not None:
        carpet.customer_phone = update.customer_phone
    if update.client_name is not None:
        carpet.client_name = update.client_name
    carpet.status = "released"
    carpet.released_at = datetime.utcnow()
    db.commit()

    if carpet.expected_price > 0 or (carpet.cash_paid + carpet.mpesa_paid) > 0:
        tx_data = TransactionCreate(
            washer_id=carpet.receiver_id,
            category=ServiceCategory.CARPET,
            expected_price=carpet.expected_price,
            cash_paid=carpet.cash_paid,
            mpesa_paid=carpet.mpesa_paid,
            tip_method=TipMethod.CASH,
            has_car_wash=True,
            carpet_metadata=CarpetMetadata(
                characteristics=carpet.characteristics or "Carpet",
                receiver_id=carpet.receiver_id,
                customer_phone=carpet.customer_phone
            )
        )
        create_transaction(tx_data, db, current_user)

    db.refresh(carpet)
    return carpet

@router.delete("/{carpet_id}", dependencies=[Depends(check_role([UserRole.ADMIN, UserRole.MANAGER]))])
def delete_carpet(carpet_id: int, db: Session = Depends(get_db)):
    carpet = db.query(CarpetModel).filter(CarpetModel.id == carpet_id).first()
    if not carpet:
        raise HTTPException(status_code=404, detail="Carpet not found")
    db.delete(carpet)
    db.commit()
    return {"message": "Carpet deleted"}