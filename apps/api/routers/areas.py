"""
Areas router
Handles area management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from utils.database import get_db
from utils.security import get_current_user, require_role
from models.user import User, UserRole
from models.location import Territory, Area, Branch
from schemas.location import (
    AreaCreate, AreaUpdate, AreaResponse
)

router = APIRouter()


@router.get("", response_model=List[AreaResponse])
async def list_areas(
    territory_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Area)

    if current_user.role == UserRole.SUPER_ADMIN:
        query = query.filter(Area.territory_id == current_user.territory_id)
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
        area_resp = AreaResponse.model_validate(area)
        area_resp.territory_name = area.territory.name if area.territory else None
        area_resp.branch_count = len(area.branches) if hasattr(area, 'branches') and area.branches else 0
        result.append(area_resp)
    return result


@router.get("/{area_id}", response_model=AreaResponse)
async def get_area(
    area_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")

    resp = AreaResponse.model_validate(area)
    resp.territory_name = area.territory.name if area.territory else None
    resp.branch_count = len(area.branches) if hasattr(area, 'branches') and area.branches else 0
    return resp


@router.post("", response_model=AreaResponse, status_code=status.HTTP_201_CREATED)
async def create_area(
    data: AreaCreate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN])),
    db: Session = Depends(get_db)
):
    existing = db.query(Area).filter(Area.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Area code already exists")

    territory = db.query(Territory).filter(Territory.id == data.territory_id).first()
    if not territory:
        raise HTTPException(status_code=400, detail="Territory not found")

    if current_user.role == UserRole.SUPER_ADMIN:
        if data.territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Cannot create area in another territory")

    area = Area(**data.model_dump())
    db.add(area)
    db.commit()
    db.refresh(area)

    resp = AreaResponse.model_validate(area)
    resp.territory_name = territory.name
    return resp


@router.put("/{area_id}", response_model=AreaResponse)
async def update_area(
    area_id: int,
    data: AreaUpdate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN])),
    db: Session = Depends(get_db)
):
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")

    if current_user.role == UserRole.SUPER_ADMIN:
        if area.territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Cannot update area in another territory")

    update_data = data.model_dump(exclude_unset=True)
    if 'code' in update_data:
        existing = db.query(Area).filter(
            Area.code == update_data['code'],
            Area.id != area_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Area code already exists")

    for field, value in update_data.items():
        setattr(area, field, value)

    db.commit()
    db.refresh(area)

    resp = AreaResponse.model_validate(area)
    resp.territory_name = area.territory.name if area.territory else None
    resp.branch_count = len(area.branches) if hasattr(area, 'branches') and area.branches else 0
    return resp


@router.delete("/{area_id}", status_code=status.HTTP_200_OK)
async def delete_area(
    area_id: int,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN])),
    db: Session = Depends(get_db)
):
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")

    if current_user.role == UserRole.SUPER_ADMIN:
        if area.territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Cannot delete area in another territory")

    branches = db.query(Branch).filter(Branch.area_id == area_id).all()
    if branches:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete area with existing branches. Remove branches first."
        )

    db.delete(area)
    db.commit()

    return {"message": f"Area '{area.name}' deleted successfully"}
