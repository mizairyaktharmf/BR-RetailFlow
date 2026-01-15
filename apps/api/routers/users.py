"""
Users router
Handles user management (CRUD operations)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from utils.database import get_db
from utils.security import get_current_user, require_role, get_password_hash
from models.user import User, UserRole
from schemas.user import UserCreate, UserUpdate, UserResponse

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
async def list_users(
    role: Optional[UserRole] = None,
    branch_id: Optional[int] = None,
    area_id: Optional[int] = None,
    territory_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(require_role([
        UserRole.SUPREME_ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN
    ])),
    db: Session = Depends(get_db)
):
    """
    List users based on current user's role and permissions
    """
    query = db.query(User)

    # Filter based on current user's role
    if current_user.role == UserRole.ADMIN:
        # Area managers can only see staff in their area
        query = query.filter(User.area_id == current_user.area_id)
    elif current_user.role == UserRole.SUPER_ADMIN:
        # Territory managers can see users in their territory
        query = query.filter(User.territory_id == current_user.territory_id)
    # Supreme admins can see all users

    # Apply filters
    if role:
        query = query.filter(User.role == role)
    if branch_id:
        query = query.filter(User.branch_id == branch_id)
    if area_id:
        query = query.filter(User.area_id == area_id)
    if territory_id:
        query = query.filter(User.territory_id == territory_id)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    users = query.offset(skip).limit(limit).all()
    return [UserResponse.model_validate(u) for u in users]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(require_role([
        UserRole.SUPREME_ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN
    ])),
    db: Session = Depends(get_db)
):
    """
    Get a specific user by ID
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check permissions
    if current_user.role == UserRole.ADMIN:
        if user.area_id != current_user.area_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.SUPER_ADMIN:
        if user.territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Access denied")

    return UserResponse.model_validate(user)


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_role([
        UserRole.SUPREME_ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN
    ])),
    db: Session = Depends(get_db)
):
    """
    Create a new user
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

    # Validate role creation permissions
    if current_user.role == UserRole.ADMIN:
        # Area managers can only create staff
        if user_data.role != UserRole.STAFF:
            raise HTTPException(status_code=403, detail="Can only create staff users")
        user_data.area_id = current_user.area_id
    elif current_user.role == UserRole.SUPER_ADMIN:
        # Territory managers can create staff and admins
        if user_data.role not in [UserRole.STAFF, UserRole.ADMIN]:
            raise HTTPException(status_code=403, detail="Can only create staff or admin users")
        user_data.territory_id = current_user.territory_id

    # Create user
    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role,
        branch_id=user_data.branch_id,
        area_id=user_data.area_id,
        territory_id=user_data.territory_id
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(require_role([
        UserRole.SUPREME_ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN
    ])),
    db: Session = Depends(get_db)
):
    """
    Update a user
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check permissions
    if current_user.role == UserRole.ADMIN:
        if user.area_id != current_user.area_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if user_data.role and user_data.role != UserRole.STAFF:
            raise HTTPException(status_code=403, detail="Cannot change role")
    elif current_user.role == UserRole.SUPER_ADMIN:
        if user.territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Update fields
    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Delete a user (Supreme Admin only)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    db.delete(user)
    db.commit()
