"""
Users router
Handles user management (CRUD operations)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from utils.database import get_db
from utils.security import get_current_user, require_role, get_password_hash
from models.user import User, UserRole
from models.location import Territory, Area, Branch
from schemas.user import UserCreate, UserUpdate, UserResponse, ApprovalAction

router = APIRouter()


def enrich_user_response(user: User, db: Session) -> UserResponse:
    """Add territory_name, area_name, branch_name to user response"""
    resp = UserResponse.model_validate(user)
    if user.territory_id:
        territory = db.query(Territory).filter(Territory.id == user.territory_id).first()
        resp.territory_name = territory.name if territory else None
    if user.area_id:
        area = db.query(Area).filter(Area.id == user.area_id).first()
        resp.area_name = area.name if area else None
    if user.branch_id:
        branch = db.query(Branch).filter(Branch.id == user.branch_id).first()
        resp.branch_name = branch.name if branch else None
    return resp


def cascade_location_ids(db: Session, branch_id=None, area_id=None, territory_id=None):
    """Auto-fill parent location IDs from child.
    branch -> area -> territory"""
    if branch_id:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if branch:
            area_id = branch.area_id
            area = db.query(Area).filter(Area.id == area_id).first()
            if area:
                territory_id = area.territory_id
    elif area_id:
        area = db.query(Area).filter(Area.id == area_id).first()
        if area:
            territory_id = area.territory_id
    return branch_id, area_id, territory_id


@router.get("/pending-approvals", response_model=List[UserResponse])
async def get_pending_approvals(
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    List users pending HQ approval (verified but not approved) - Supreme Admin only
    """
    users = db.query(User).filter(
        User.is_verified == True,
        User.is_approved == False,
        User.is_active == True
    ).all()
    return [enrich_user_response(u, db) for u in users]


@router.get("/", response_model=List[UserResponse])
async def list_users(
    role: Optional[UserRole] = None,
    branch_id: Optional[int] = None,
    area_id: Optional[int] = None,
    territory_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    is_approved: Optional[bool] = None,
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
        query = query.filter(User.area_id == current_user.area_id)
    elif current_user.role == UserRole.SUPER_ADMIN:
        query = query.filter(User.territory_id == current_user.territory_id)

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
    if is_approved is not None:
        query = query.filter(User.is_approved == is_approved)

    users = query.offset(skip).limit(limit).all()
    return [enrich_user_response(u, db) for u in users]


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

    if current_user.role == UserRole.ADMIN:
        if user.area_id != current_user.area_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.SUPER_ADMIN:
        if user.territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Access denied")

    return enrich_user_response(user, db)


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
    Create a new user with auto-cascading location assignment
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
        if user_data.role != UserRole.STAFF:
            raise HTTPException(status_code=403, detail="Can only create staff users")
        user_data.area_id = current_user.area_id
    elif current_user.role == UserRole.SUPER_ADMIN:
        if user_data.role not in [UserRole.STAFF, UserRole.ADMIN]:
            raise HTTPException(status_code=403, detail="Can only create staff or admin users")
        user_data.territory_id = current_user.territory_id

    # Auto-cascade location IDs
    branch_id, area_id, territory_id = cascade_location_ids(
        db,
        branch_id=user_data.branch_id,
        area_id=user_data.area_id,
        territory_id=user_data.territory_id
    )

    # Create user (admin-created users are pre-approved and pre-verified)
    user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role,
        branch_id=branch_id,
        area_id=area_id,
        territory_id=territory_id,
        is_verified=True,
        is_approved=True
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return enrich_user_response(user, db)


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

    if current_user.role == UserRole.ADMIN:
        if user.area_id != current_user.area_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if user_data.role and user_data.role != UserRole.STAFF:
            raise HTTPException(status_code=403, detail="Cannot change role")
    elif current_user.role == UserRole.SUPER_ADMIN:
        if user.territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Access denied")

    update_data = user_data.model_dump(exclude_unset=True)

    # Auto-cascade if location changed
    if 'branch_id' in update_data or 'area_id' in update_data or 'territory_id' in update_data:
        b_id = update_data.get('branch_id', user.branch_id)
        a_id = update_data.get('area_id', user.area_id)
        t_id = update_data.get('territory_id', user.territory_id)
        b_id, a_id, t_id = cascade_location_ids(db, branch_id=b_id, area_id=a_id, territory_id=t_id)
        update_data['branch_id'] = b_id
        update_data['area_id'] = a_id
        update_data['territory_id'] = t_id

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return enrich_user_response(user, db)


class AssignRequest(BaseModel):
    """Schema for assigning a user to a location"""
    territory_id: Optional[int] = None
    area_id: Optional[int] = None
    branch_id: Optional[int] = None


@router.post("/{user_id}/assign", response_model=UserResponse)
async def assign_user(
    user_id: int,
    data: AssignRequest,
    current_user: User = Depends(require_role([
        UserRole.SUPREME_ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN
    ])),
    db: Session = Depends(get_db)
):
    """
    Assign a user to territory/area/branch with auto-cascading.
    - HQ: Can assign anyone anywhere
    - TM: Can assign within own territory
    - AM: Can assign staff to branches within own area
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Auto-cascade location IDs
    branch_id, area_id, territory_id = cascade_location_ids(
        db, branch_id=data.branch_id, area_id=data.area_id, territory_id=data.territory_id
    )

    # Permission checks
    if current_user.role == UserRole.SUPER_ADMIN:
        if territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Cannot assign to location outside your territory")
    elif current_user.role == UserRole.ADMIN:
        if user.role != UserRole.STAFF:
            raise HTTPException(status_code=403, detail="Can only assign staff users")
        if area_id != current_user.area_id:
            raise HTTPException(status_code=403, detail="Cannot assign to location outside your area")

    user.branch_id = branch_id
    user.area_id = area_id
    user.territory_id = territory_id

    db.commit()
    db.refresh(user)

    return enrich_user_response(user, db)


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


@router.post("/{user_id}/approve", response_model=UserResponse)
async def approve_user(
    user_id: int,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Approve a user account (Supreme Admin only)
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_approved:
        raise HTTPException(status_code=400, detail="User is already approved")

    user.is_approved = True
    db.commit()
    db.refresh(user)

    return enrich_user_response(user, db)


@router.post("/{user_id}/reject", status_code=status.HTTP_200_OK)
async def reject_user(
    user_id: int,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Reject a user account (Supreme Admin only) - deactivates the account
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_approved:
        raise HTTPException(status_code=400, detail="Cannot reject an already approved user")

    user.is_active = False
    db.commit()

    return {"message": f"User {user.full_name} has been rejected and deactivated"}
