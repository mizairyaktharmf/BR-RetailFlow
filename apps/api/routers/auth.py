"""
Authentication router
Handles login, logout, token refresh
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import random
import string

from utils.database import get_db
from utils.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_password_hash
)
from models.user import User, UserRole
from models.location import Branch
from schemas.user import UserLogin, TokenResponse, UserResponse, UserCreate, VerifyAccount, PasswordChange
from pydantic import BaseModel as PydanticBaseModel

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user and return access/refresh tokens
    """
    # Find user by username or email
    user = db.query(User).filter(
        (User.username == credentials.username) | (User.email == credentials.username)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled"
        )

    # Check if user is verified
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please verify your account first. Check your email for verification code."
        )

    # Check if user is approved by HQ
    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is under review. Please wait for HQ approval."
        )

    # Update last login
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    # Create tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user)
    )


class BranchLoginRequest(PydanticBaseModel):
    branch_id: str  # The login_id of the branch
    password: str


@router.post("/branch-login")
async def branch_login(credentials: BranchLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a branch (Flavor Expert app) using Branch ID and password.
    Returns JWT tokens for the linked staff user.
    """
    # Find branch by login_id (case-insensitive, since branch code may be entered in any case)
    branch = db.query(Branch).filter(
        Branch.login_id.ilike(credentials.branch_id)
    ).first()

    if not branch:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Branch ID or password"
        )

    if not branch.hashed_password or not verify_password(credentials.password, branch.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Branch ID or password"
        )

    if not branch.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This branch is currently inactive"
        )

    # Find the linked staff user for this branch
    staff_user = db.query(User).filter(
        User.branch_id == branch.id,
        User.role == UserRole.STAFF,
        User.is_active == True
    ).first()

    if not staff_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Branch account not properly configured. Contact HQ."
        )

    # Update last login
    staff_user.last_login = datetime.now(timezone.utc)
    db.commit()

    # Create tokens for the staff user
    access_token = create_access_token(data={"sub": str(staff_user.id)})
    refresh_token = create_refresh_token(data={"sub": str(staff_user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "branch": {
            "id": branch.id,
            "name": branch.name,
            "code": branch.code,
            "login_id": branch.login_id,
            "territory_id": branch.territory_id,
        },
        "user": UserResponse.model_validate(staff_user).model_dump()
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new admin user - generates verification code
    """
    # Check if username or email already exists
    existing = db.query(User).filter(
        (User.username == user_data.username) | (User.email == user_data.email)
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Username or email already registered"
        )

    # Generate 6-digit verification code
    verification_code = ''.join(random.choices(string.digits, k=6))

    # Code expires in 30 minutes
    code_expires = datetime.now(timezone.utc) + timedelta(minutes=30)

    # Create user (NOT verified yet)
    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role or UserRole.SUPREME_ADMIN,
        is_active=True,
        is_verified=False,  # NOT verified yet
        verification_code=verification_code,
        verification_code_expires=code_expires,
        branch_id=user_data.branch_id,
        area_id=user_data.area_id,
        territory_id=user_data.territory_id
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Return verification code (in production, send via email)
    return {
        "message": "Registration successful. Please verify your account.",
        "user_id": user.id,
        "email": user.email,
        "verification_code": verification_code,  # In production, send via email
        "expires_in_minutes": 30
    }


@router.post("/verify")
async def verify_account(
    verify_data: VerifyAccount,
    db: Session = Depends(get_db)
):
    """
    Verify user account with verification code.
    Supreme Admin users are auto-approved and get tokens immediately.
    Other roles need HQ approval before they can login.
    """
    # Find user by email
    user = db.query(User).filter(User.email == verify_data.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account already verified"
        )

    # Check if code expired (handle both naive and aware datetimes for SQLite compat)
    if user.verification_code_expires:
        expires = user.verification_code_expires
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code expired. Please request a new one."
            )

    # Verify code
    if user.verification_code != verify_data.verification_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )

    # Mark user as verified
    user.is_verified = True
    user.verification_code = None
    user.verification_code_expires = None

    # Auto-approve HQ (supreme_admin) users
    if user.role == UserRole.SUPREME_ADMIN:
        user.is_approved = True

    db.commit()
    db.refresh(user)

    # If user is approved (HQ), return tokens so they can login immediately
    if user.is_approved:
        access_token = create_access_token(data={"sub": str(user.id)})
        refresh_token_val = create_refresh_token(data={"sub": str(user.id)})
        return {
            "message": "Account verified and approved. You can now login.",
            "approved": True,
            "access_token": access_token,
            "refresh_token": refresh_token_val,
            "token_type": "bearer",
            "user": UserResponse.model_validate(user).model_dump()
        }

    # For non-HQ users, return pending approval message (no tokens)
    return {
        "message": "Account verified successfully. Your account is pending HQ approval. You will be able to login once approved.",
        "approved": False
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
    """
    Refresh access token using refresh token
    """
    payload = decode_token(refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )

    # Create new tokens
    new_access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user info with location names
    """
    from models.location import Territory, Area, Branch
    resp = UserResponse.model_validate(current_user)
    if current_user.territory_id:
        territory = db.query(Territory).filter(Territory.id == current_user.territory_id).first()
        resp.territory_name = territory.name if territory else None
    if current_user.area_id:
        area = db.query(Area).filter(Area.id == current_user.area_id).first()
        resp.area_name = area.name if area else None
    if current_user.branch_id:
        branch = db.query(Branch).filter(Branch.id == current_user.branch_id).first()
        resp.branch_name = branch.name if branch else None
    return resp


@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Change current user's password. Requires current password for verification.
    """
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )

    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()

    return {"message": "Password changed successfully"}


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current user's own profile (full_name, phone only).
    Users cannot change their own role, email, or username.
    """
    allowed_fields = {'full_name', 'phone'}
    for field, value in data.items():
        if field in allowed_fields and value is not None:
            setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """
    Logout user (client should discard tokens)
    In a more complex setup, we would invalidate tokens on server side
    """
    return {"message": "Successfully logged out"}
