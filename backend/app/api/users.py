from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.core.security import verify_password, create_access_token, get_password_hash
from backend.app.models.models import User as UserModel, UserRole
from backend.app.schemas.schemas import Token, UserCreate, User as UserSchema, UserUpdate
from datetime import timedelta
from backend.app.core.config import settings

router = APIRouter()

@router.post("/token", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(UserModel).filter(UserModel.abbreviation == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.abbreviation, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

from backend.app.api.deps import check_role
from backend.app.models.models import UserRole
from typing import List

@router.get("/users", response_model=List[UserSchema])
def get_users(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(check_role([UserRole.ADMIN]))
):
    return db.query(UserModel).all()

@router.post("/users", response_model=UserSchema)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(check_role([UserRole.ADMIN]))
):
    user = db.query(UserModel).filter(UserModel.abbreviation == user_in.abbreviation).first()
    if user:
        raise HTTPException(status_code=400, detail="User with this abbreviation already exists")

    db_user = UserModel(
        full_name=user_in.full_name,
        abbreviation=user_in.abbreviation,
        role=user_in.role,
        hashed_password=get_password_hash(user_in.password)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.put("/users/{user_id}", response_model=UserSchema)
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(check_role([UserRole.ADMIN]))
):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.abbreviation is not None:
        user.abbreviation = user_in.abbreviation
    if user_in.role is not None:
        user.role = user_in.role
    if user_in.password is not None:
        user.hashed_password = get_password_hash(user_in.password)
    if user_in.is_active is not None:
        user.is_active = user_in.is_active

    db.commit()
    db.refresh(user)
    return user

@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(check_role([UserRole.ADMIN]))
):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}
