"""
Territories router
Handles territory management
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from utils.database import get_db
from utils.security import get_current_user, require_role
from models.user import User, UserRole
from models.location import Territory, Area, Branch
from schemas.location import (
    TerritoryCreate, TerritoryUpdate, TerritoryResponse,
    TerritoryWithAreas
)
from sqlalchemy import func as sa_func

router = APIRouter()


@router.get("", response_model=List[TerritoryResponse])
async def list_territories(
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Territory)

    if current_user.role == UserRole.SUPER_ADMIN:
        query = query.filter(Territory.id == current_user.territory_id)
    elif current_user.role == UserRole.ADMIN:
        area = db.query(Area).filter(Area.id == current_user.area_id).first()
        if area:
            query = query.filter(Territory.id == area.territory_id)
    elif current_user.role == UserRole.STAFF:
        branch = db.query(Branch).filter(Branch.id == current_user.branch_id).first()
        if branch:
            area = db.query(Area).filter(Area.id == branch.area_id).first()
            if area:
                query = query.filter(Territory.id == area.territory_id)

    if is_active is not None:
        query = query.filter(Territory.is_active == is_active)

    territories = query.all()
    result = []
    for t in territories:
        resp = TerritoryResponse.model_validate(t)
        resp.areas_count = len(t.areas) if hasattr(t, 'areas') and t.areas else 0
        branch_total = 0
        if hasattr(t, 'areas') and t.areas:
            for a in t.areas:
                branch_total += len(a.branches) if hasattr(a, 'branches') and a.branches else 0
        resp.branches_count = branch_total
        resp.users_count = db.query(sa_func.count(User.id)).filter(User.territory_id == t.id).scalar() or 0
        result.append(resp)
    return result


@router.get("/{territory_id}", response_model=TerritoryWithAreas)
async def get_territory(
    territory_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    territory = db.query(Territory).filter(Territory.id == territory_id).first()
    if not territory:
        raise HTTPException(status_code=404, detail="Territory not found")
    return territory


@router.post("", response_model=TerritoryResponse, status_code=status.HTTP_201_CREATED)
async def create_territory(
    data: TerritoryCreate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    existing = db.query(Territory).filter(Territory.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Territory code already exists")

    territory = Territory(**data.model_dump())
    db.add(territory)
    db.commit()
    db.refresh(territory)

    return TerritoryResponse.model_validate(territory)


@router.put("/{territory_id}", response_model=TerritoryResponse)
async def update_territory(
    territory_id: int,
    data: TerritoryUpdate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    territory = db.query(Territory).filter(Territory.id == territory_id).first()
    if not territory:
        raise HTTPException(status_code=404, detail="Territory not found")

    update_data = data.model_dump(exclude_unset=True)
    if 'code' in update_data:
        existing = db.query(Territory).filter(
            Territory.code == update_data['code'],
            Territory.id != territory_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Territory code already exists")

    for field, value in update_data.items():
        setattr(territory, field, value)

    db.commit()
    db.refresh(territory)

    return TerritoryResponse.model_validate(territory)


@router.delete("/{territory_id}", status_code=status.HTTP_200_OK)
async def delete_territory(
    territory_id: int,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    territory = db.query(Territory).filter(Territory.id == territory_id).first()
    if not territory:
        raise HTTPException(status_code=404, detail="Territory not found")

    areas = db.query(Area).filter(Area.territory_id == territory_id).all()
    if areas:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete territory with existing areas. Remove areas first."
        )

    db.delete(territory)
    db.commit()

    return {"message": f"Territory '{territory.name}' deleted successfully"}
