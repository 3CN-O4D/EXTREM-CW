from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.core.security import verify_password, create_access_token, get_password_hash
from backend.app.models.models import User as UserModel, UserRole
from backend.app.schemas.schemas import Token, UserCreate, User as UserSchema
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
