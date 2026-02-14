"""
Branches router
Handles territory, area, and branch management
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from utils.database import get_db
from utils.security import get_current_user, require_role
from models.user import User, UserRole
from models.location import Territory, Area, Branch
from schemas.location import (
    TerritoryCreate, TerritoryUpdate, TerritoryResponse,
    AreaCreate, AreaUpdate, AreaResponse,
    BranchCreate, BranchUpdate, BranchResponse,
    TerritoryWithAreas
)

router = APIRouter()


# ============== TERRITORIES ==============

@router.get("/territories", response_model=List[TerritoryResponse])
async def list_territories(
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List territories based on user role
    """
    query = db.query(Territory)

    # Filter based on role
    if current_user.role == UserRole.SUPER_ADMIN:
        query = query.filter(Territory.id == current_user.territory_id)
    elif current_user.role == UserRole.ADMIN:
        # Get territory through area
        area = db.query(Area).filter(Area.id == current_user.area_id).first()
        if area:
            query = query.filter(Territory.id == area.territory_id)
    elif current_user.role == UserRole.STAFF:
        # Get territory through branch -> area
        branch = db.query(Branch).filter(Branch.id == current_user.branch_id).first()
        if branch:
            area = db.query(Area).filter(Area.id == branch.area_id).first()
            if area:
                query = query.filter(Territory.id == area.territory_id)

    if is_active is not None:
        query = query.filter(Territory.is_active == is_active)

    territories = query.all()
    return [TerritoryResponse.model_validate(t) for t in territories]


@router.post("/territories", response_model=TerritoryResponse, status_code=status.HTTP_201_CREATED)
async def create_territory(
    data: TerritoryCreate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Create a new territory (Supreme Admin only)
    """
    # Check for duplicate code
    existing = db.query(Territory).filter(Territory.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Territory code already exists")

    territory = Territory(**data.model_dump())
    db.add(territory)
    db.commit()
    db.refresh(territory)

    return TerritoryResponse.model_validate(territory)


@router.get("/territories/{territory_id}", response_model=TerritoryWithAreas)
async def get_territory(
    territory_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a territory with its areas and branches
    """
    territory = db.query(Territory).filter(Territory.id == territory_id).first()
    if not territory:
        raise HTTPException(status_code=404, detail="Territory not found")

    return territory


# ============== AREAS ==============

@router.get("/areas", response_model=List[AreaResponse])
async def list_areas(
    territory_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List areas based on user role
    """
    query = db.query(Area)

    # Filter based on role
    if current_user.role == UserRole.SUPER_ADMIN:
        query = query.join(Territory).filter(Territory.id == current_user.territory_id)
    elif current_user.role == UserRole.ADMIN:
        query = query.filter(Area.id == current_user.area_id)
    elif current_user.role == UserRole.STAFF:
        branch = db.query(Branch).filter(Branch.id == current_user.branch_id).first()
        if branch:
            query = query.filter(Area.id == branch.area_id)

    if territory_id:
        query = query.filter(Area.territory_id == territory_id)
    if is_active is not None:
        query = query.filter(Area.is_active == is_active)

    areas = query.all()
    result = []
    for area in areas:
        area_dict = AreaResponse.model_validate(area)
        area_dict.territory_name = area.territory.name if area.territory else None
        area_dict.branch_count = len(area.branches)
        result.append(area_dict)
    return result


@router.post("/areas", response_model=AreaResponse, status_code=status.HTTP_201_CREATED)
async def create_area(
    data: AreaCreate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Create a new area
    """
    # Check for duplicate code
    existing = db.query(Area).filter(Area.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Area code already exists")

    # Verify territory exists
    territory = db.query(Territory).filter(Territory.id == data.territory_id).first()
    if not territory:
        raise HTTPException(status_code=400, detail="Territory not found")

    # Super admin can only create in their territory
    if current_user.role == UserRole.SUPER_ADMIN:
        if data.territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Cannot create area in another territory")

    area = Area(**data.model_dump())
    db.add(area)
    db.commit()
    db.refresh(area)

    return AreaResponse.model_validate(area)


# ============== BRANCHES ==============

@router.get("/", response_model=List[BranchResponse])
async def list_branches(
    area_id: Optional[int] = None,
    territory_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List branches based on user role
    """
    query = db.query(Branch)

    # Filter based on role
    if current_user.role == UserRole.STAFF:
        query = query.filter(Branch.id == current_user.branch_id)
    elif current_user.role == UserRole.ADMIN:
        query = query.filter(Branch.area_id == current_user.area_id)
    elif current_user.role == UserRole.SUPER_ADMIN:
        query = query.join(Area).filter(Area.territory_id == current_user.territory_id)
    # Supreme admin sees all

    if area_id:
        query = query.filter(Branch.area_id == area_id)
    if territory_id:
        query = query.join(Area).filter(Area.territory_id == territory_id)
    if is_active is not None:
        query = query.filter(Branch.is_active == is_active)

    branches = query.offset(skip).limit(limit).all()

    result = []
    for branch in branches:
        branch_response = BranchResponse.model_validate(branch)
        branch_response.area_name = branch.area.name if branch.area else None
        branch_response.territory_name = branch.area.territory.name if branch.area and branch.area.territory else None
        branch_response.staff_count = len(branch.staff)
        result.append(branch_response)
    return result


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
        if branch.area_id != current_user.area_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.SUPER_ADMIN:
        if branch.area.territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Access denied")

    response = BranchResponse.model_validate(branch)
    response.area_name = branch.area.name if branch.area else None
    response.territory_name = branch.area.territory.name if branch.area and branch.area.territory else None
    return response


@router.post("/", response_model=BranchResponse, status_code=status.HTTP_201_CREATED)
async def create_branch(
    data: BranchCreate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Create a new branch (Supreme Admin / HQ only)
    """
    # Check for duplicate code
    existing = db.query(Branch).filter(Branch.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Branch code already exists")

    # Verify area exists
    area = db.query(Area).filter(Area.id == data.area_id).first()
    if not area:
        raise HTTPException(status_code=400, detail="Area not found")

    branch = Branch(**data.model_dump())
    db.add(branch)
    db.commit()
    db.refresh(branch)

    return BranchResponse.model_validate(branch)


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

    return BranchResponse.model_validate(branch)
