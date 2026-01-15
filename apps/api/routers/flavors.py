"""
Flavors router
Handles flavor master data management
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from utils.database import get_db
from utils.security import get_current_user, require_role
from models.user import User, UserRole
from models.inventory import Flavor
from schemas.inventory import FlavorCreate, FlavorUpdate, FlavorResponse

router = APIRouter()


@router.get("/", response_model=List[FlavorResponse])
async def list_flavors(
    category: Optional[str] = None,
    is_active: Optional[bool] = True,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all flavors
    All authenticated users can view flavors
    """
    query = db.query(Flavor)

    if category:
        query = query.filter(Flavor.category == category)
    if is_active is not None:
        query = query.filter(Flavor.is_active == is_active)
    if search:
        query = query.filter(
            (Flavor.name.ilike(f"%{search}%")) |
            (Flavor.code.ilike(f"%{search}%"))
        )

    flavors = query.order_by(Flavor.name).offset(skip).limit(limit).all()
    return [FlavorResponse.model_validate(f) for f in flavors]


@router.get("/categories")
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all unique flavor categories
    """
    categories = db.query(Flavor.category).distinct().filter(
        Flavor.category.isnot(None)
    ).all()
    return [c[0] for c in categories if c[0]]


@router.get("/{flavor_id}", response_model=FlavorResponse)
async def get_flavor(
    flavor_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific flavor
    """
    flavor = db.query(Flavor).filter(Flavor.id == flavor_id).first()
    if not flavor:
        raise HTTPException(status_code=404, detail="Flavor not found")
    return FlavorResponse.model_validate(flavor)


@router.post("/", response_model=FlavorResponse, status_code=status.HTTP_201_CREATED)
async def create_flavor(
    data: FlavorCreate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Create a new flavor (Supreme Admin only)
    """
    # Check for duplicate code
    existing = db.query(Flavor).filter(
        (Flavor.code == data.code) | (Flavor.name == data.name)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Flavor code or name already exists")

    flavor = Flavor(**data.model_dump())
    db.add(flavor)
    db.commit()
    db.refresh(flavor)

    return FlavorResponse.model_validate(flavor)


@router.put("/{flavor_id}", response_model=FlavorResponse)
async def update_flavor(
    flavor_id: int,
    data: FlavorUpdate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Update a flavor (Supreme Admin only)
    """
    flavor = db.query(Flavor).filter(Flavor.id == flavor_id).first()
    if not flavor:
        raise HTTPException(status_code=404, detail="Flavor not found")

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(flavor, field, value)

    db.commit()
    db.refresh(flavor)

    return FlavorResponse.model_validate(flavor)


@router.delete("/{flavor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flavor(
    flavor_id: int,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Soft delete a flavor (mark as inactive)
    """
    flavor = db.query(Flavor).filter(Flavor.id == flavor_id).first()
    if not flavor:
        raise HTTPException(status_code=404, detail="Flavor not found")

    flavor.is_active = False
    db.commit()


@router.post("/bulk", response_model=List[FlavorResponse], status_code=status.HTTP_201_CREATED)
async def bulk_create_flavors(
    flavors: List[FlavorCreate],
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """
    Bulk create flavors (Supreme Admin only)
    Useful for initial setup
    """
    created = []
    for flavor_data in flavors:
        # Skip if already exists
        existing = db.query(Flavor).filter(Flavor.code == flavor_data.code).first()
        if existing:
            continue

        flavor = Flavor(**flavor_data.model_dump())
        db.add(flavor)
        created.append(flavor)

    db.commit()

    # Refresh all created flavors
    for flavor in created:
        db.refresh(flavor)

    return [FlavorResponse.model_validate(f) for f in created]
