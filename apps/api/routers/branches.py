"""
Branches router
Handles branch management with direct AM assignment via manager_id
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import secrets
import string

from utils.database import get_db
from utils.security import get_current_user, require_role, get_password_hash
from models.user import User, UserRole
from models.location import Territory, Area, Branch
from schemas.location import (
    BranchCreate, BranchUpdate, BranchResponse
)


class BranchAssignRequest(BaseModel):
    """Schema for assigning a branch to an AM via manager_id"""
    manager_id: Optional[int] = None


router = APIRouter()


def enrich_branch_response(branch: Branch, db: Session) -> BranchResponse:
    """Add manager_name, territory_name, area_name, staff_count to branch response"""
    response = BranchResponse.model_validate(branch)
    response.territory_name = branch.territory.name if branch.territory else None
    response.area_name = branch.area.name if branch.area else None
    if branch.manager_id:
        manager = db.query(User).filter(User.id == branch.manager_id).first()
        response.manager_name = manager.full_name if manager else None
    response.staff_count = len(branch.staff) if branch.staff else 0
    return response


@router.get("/", response_model=List[BranchResponse])
async def list_branches(
    area_id: Optional[int] = None,
    territory_id: Optional[int] = None,
    manager_id: Optional[int] = None,
    unassigned: Optional[bool] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List branches based on user role.
    AM sees branches assigned to them via manager_id.
    """
    query = db.query(Branch)

    # Filter based on role
    if current_user.role == UserRole.STAFF:
        query = query.filter(Branch.id == current_user.branch_id)
    elif current_user.role == UserRole.ADMIN:
        # AM sees branches assigned to them
        query = query.filter(Branch.manager_id == current_user.id)
    elif current_user.role == UserRole.SUPER_ADMIN:
        query = query.filter(Branch.territory_id == current_user.territory_id)
    # Supreme admin sees all

    if area_id:
        query = query.filter(Branch.area_id == area_id)
    if territory_id:
        query = query.filter(Branch.territory_id == territory_id)
    if manager_id:
        query = query.filter(Branch.manager_id == manager_id)
    if unassigned is True:
        query = query.filter(Branch.manager_id == None)
    if is_active is not None:
        query = query.filter(Branch.is_active == is_active)

    branches = query.offset(skip).limit(limit).all()
    return [enrich_branch_response(b, db) for b in branches]


@router.get("/{branch_id}", response_model=BranchResponse)
async def get_branch(
    branch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific branch
    """
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # Check permissions
    if current_user.role == UserRole.STAFF:
        if branch.id != current_user.branch_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.ADMIN:
        if branch.manager_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.SUPER_ADMIN:
        if branch.territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Access denied")

    return enrich_branch_response(branch, db)


def generate_password(length=10):
    """Generate a random password excluding ambiguous characters"""
    chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    return ''.join(secrets.choice(chars) for _ in range(length))


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_branch(
    data: BranchCreate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Create a new branch under a territory (Supreme Admin / HQ only).
    Auto-generates a unique Branch ID and password for Flavor Expert login.
    Also creates a linked staff user internally for API auth.
    """
    # Check for duplicate code
    existing = db.query(Branch).filter(Branch.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Branch code already exists")

    # Verify territory exists
    territory = db.query(Territory).filter(Territory.id == data.territory_id).first()
    if not territory:
        raise HTTPException(status_code=400, detail="Territory not found")

    # Use branch code as login_id and HQ-provided password
    login_id = data.code
    raw_password = data.password

    # Ensure login_id is unique
    existing_login = db.query(Branch).filter(Branch.login_id == login_id).first()
    if existing_login:
        raise HTTPException(status_code=400, detail="Branch ID already exists")

    # Exclude password from model_dump since it's not a Branch column
    branch_data = data.model_dump(exclude={"password"})
    branch = Branch(
        **branch_data,
        login_id=login_id,
        hashed_password=get_password_hash(raw_password)
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)

    # Auto-create a linked staff user for API authentication (internal, hidden from admin)
    fe_email = f"{login_id.lower().replace('-', '').replace(' ', '')}@branch.brretailflow.com"
    fe_user = User(
        email=fe_email,
        username=login_id,
        hashed_password=get_password_hash(raw_password),
        full_name=f"Flavor Expert - {data.name}",
        role=UserRole.STAFF,
        branch_id=branch.id,
        territory_id=data.territory_id,
        is_verified=True,
        is_approved=True,
    )
    db.add(fe_user)
    db.commit()

    response = enrich_branch_response(branch, db)
    return {
        **response.model_dump(),
        "generated_password": raw_password
    }


@router.post("/{branch_id}/assign", response_model=BranchResponse)
async def assign_branch(
    branch_id: int,
    data: BranchAssignRequest,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN])),
    db: Session = Depends(get_db),
):
    """
    Assign a branch to an Area Manager via manager_id, or unassign by passing manager_id=null.
    HQ and TM can assign. TM only within their territory.
    """
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # TM can only assign within their territory
    if current_user.role == UserRole.SUPER_ADMIN:
        if branch.territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Cannot assign branches outside your territory")

    if data.manager_id is not None:
        # Verify manager exists and is an AM
        manager = db.query(User).filter(User.id == data.manager_id).first()
        if not manager:
            raise HTTPException(status_code=400, detail="Manager not found")
        if manager.role != UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="User is not an Area Manager")
        if manager.territory_id != branch.territory_id:
            raise HTTPException(status_code=400, detail="Manager does not belong to the same territory")

    branch.manager_id = data.manager_id
    db.commit()
    db.refresh(branch)

    return enrich_branch_response(branch, db)


@router.put("/{branch_id}", response_model=BranchResponse)
async def update_branch(
    branch_id: int,
    data: BranchUpdate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Update a branch (Supreme Admin / HQ only)
    """
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(branch, field, value)

    db.commit()
    db.refresh(branch)

    return enrich_branch_response(branch, db)


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(
    branch_id: int,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Delete a branch (Supreme Admin / HQ only)
    """
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    db.delete(branch)
    db.commit()
