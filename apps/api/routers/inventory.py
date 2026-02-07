"""
Inventory router
Handles daily inventory entries and tub receipts
Core functionality for flavor experts
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import date, datetime, timedelta

from utils.database import get_db
from utils.security import get_current_user, require_role
from models.user import User, UserRole
from models.location import Branch, Area
from models.inventory import DailyInventory, TubReceipt, Flavor, InventoryEntryType
from schemas.inventory import (
    DailyInventoryCreate,
    DailyInventoryResponse,
    TubReceiptCreate,
    TubReceiptResponse,
    InventoryEntryBulk,
    TubReceiptBulk,
    DailySummary,
    FlavorDailySummary
)

router = APIRouter()


# ============== DAILY INVENTORY ==============

@router.get("/daily", response_model=List[DailyInventoryResponse])
async def list_daily_inventory(
    branch_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    flavor_id: Optional[int] = None,
    entry_type: Optional[InventoryEntryType] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List daily inventory entries for a branch
    """
    # Verify branch access
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # Check permissions
    if current_user.role == UserRole.STAFF:
        if branch_id != current_user.branch_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.ADMIN:
        if branch.area_id != current_user.area_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.SUPER_ADMIN:
        if branch.area.territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Access denied")

    query = db.query(DailyInventory).filter(DailyInventory.branch_id == branch_id)

    if date_from:
        query = query.filter(DailyInventory.date >= date_from)
    if date_to:
        query = query.filter(DailyInventory.date <= date_to)
    if flavor_id:
        query = query.filter(DailyInventory.flavor_id == flavor_id)
    if entry_type:
        query = query.filter(DailyInventory.entry_type == entry_type)

    entries = query.order_by(DailyInventory.date.desc(), DailyInventory.flavor_id).all()

    result = []
    for entry in entries:
        entry_response = DailyInventoryResponse.model_validate(entry)
        entry_response.flavor_name = entry.flavor.name if entry.flavor else None
        entry_response.entered_by_name = entry.entered_by.full_name if entry.entered_by else None
        result.append(entry_response)
    return result


@router.post("/daily", response_model=DailyInventoryResponse, status_code=status.HTTP_201_CREATED)
async def create_daily_inventory(
    data: DailyInventoryCreate,
    current_user: User = Depends(require_role([UserRole.STAFF])),
    db: Session = Depends(get_db)
):
    """
    Create a single daily inventory entry
    Staff can only create for their own branch
    """
    # Staff can only enter for their branch
    if data.branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Can only enter inventory for your branch")

    # Verify flavor exists
    flavor = db.query(Flavor).filter(Flavor.id == data.flavor_id).first()
    if not flavor:
        raise HTTPException(status_code=400, detail="Flavor not found")

    # Check if entry already exists for this date/flavor/type
    existing = db.query(DailyInventory).filter(
        and_(
            DailyInventory.branch_id == data.branch_id,
            DailyInventory.date == data.date,
            DailyInventory.flavor_id == data.flavor_id,
            DailyInventory.entry_type == data.entry_type
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"{data.entry_type.value.capitalize()} entry already exists for this flavor on this date"
        )

    entry = DailyInventory(
        branch_id=data.branch_id,
        date=data.date,
        flavor_id=data.flavor_id,
        entry_type=data.entry_type,
        inches=data.inches,
        notes=data.notes,
        entered_by_id=current_user.id
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)

    response = DailyInventoryResponse.model_validate(entry)
    response.flavor_name = flavor.name
    response.entered_by_name = current_user.full_name
    return response


@router.post("/daily/bulk", response_model=List[DailyInventoryResponse], status_code=status.HTTP_201_CREATED)
async def bulk_create_daily_inventory(
    data: InventoryEntryBulk,
    current_user: User = Depends(require_role([UserRole.STAFF])),
    db: Session = Depends(get_db)
):
    """
    Bulk create daily inventory entries (opening or closing)
    This is the main endpoint flavor experts will use
    """
    # Staff can only enter for their branch
    if data.branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Can only enter inventory for your branch")

    # Check if entries already exist for this date/type
    existing_count = db.query(DailyInventory).filter(
        and_(
            DailyInventory.branch_id == data.branch_id,
            DailyInventory.date == data.date,
            DailyInventory.entry_type == data.entry_type
        )
    ).count()

    if existing_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"{data.entry_type.value.capitalize()} entries already exist for this date. Use update endpoint."
        )

    created = []
    for item in data.items:
        # Verify flavor exists
        flavor = db.query(Flavor).filter(Flavor.id == item.flavor_id).first()
        if not flavor:
            continue  # Skip invalid flavors

        entry = DailyInventory(
            branch_id=data.branch_id,
            date=data.date,
            flavor_id=item.flavor_id,
            entry_type=data.entry_type,
            inches=item.inches,
            notes=item.notes,
            entered_by_id=current_user.id
        )
        db.add(entry)
        created.append((entry, flavor))

    db.commit()

    result = []
    for entry, flavor in created:
        db.refresh(entry)
        response = DailyInventoryResponse.model_validate(entry)
        response.flavor_name = flavor.name
        response.entered_by_name = current_user.full_name
        result.append(response)

    return result


@router.get("/daily/opening", response_model=List[DailyInventoryResponse])
async def get_opening_inventory(
    branch_id: int,
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get opening inventory for a specific date
    If no opening exists, returns previous day's closing
    """
    # Verify access
    if current_user.role == UserRole.STAFF:
        if branch_id != current_user.branch_id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Try to get today's opening
    opening = db.query(DailyInventory).filter(
        and_(
            DailyInventory.branch_id == branch_id,
            DailyInventory.date == date,
            DailyInventory.entry_type == InventoryEntryType.OPENING
        )
    ).all()

    if opening:
        result = []
        for entry in opening:
            response = DailyInventoryResponse.model_validate(entry)
            response.flavor_name = entry.flavor.name if entry.flavor else None
            result.append(response)
        return result

    # If no opening, get previous day's closing
    yesterday = date - timedelta(days=1)
    closing = db.query(DailyInventory).filter(
        and_(
            DailyInventory.branch_id == branch_id,
            DailyInventory.date == yesterday,
            DailyInventory.entry_type == InventoryEntryType.CLOSING
        )
    ).all()

    result = []
    for entry in closing:
        response = DailyInventoryResponse.model_validate(entry)
        response.flavor_name = entry.flavor.name if entry.flavor else None
        # Mark as previous day's closing
        response.notes = f"Carried forward from {yesterday}"
        result.append(response)

    return result


# ============== TUB RECEIPTS ==============

@router.get("/receipts", response_model=List[TubReceiptResponse])
async def list_tub_receipts(
    branch_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    flavor_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List tub receipts for a branch
    """
    # Verify access
    if current_user.role == UserRole.STAFF:
        if branch_id != current_user.branch_id:
            raise HTTPException(status_code=403, detail="Access denied")

    query = db.query(TubReceipt).filter(TubReceipt.branch_id == branch_id)

    if date_from:
        query = query.filter(TubReceipt.date >= date_from)
    if date_to:
        query = query.filter(TubReceipt.date <= date_to)
    if flavor_id:
        query = query.filter(TubReceipt.flavor_id == flavor_id)

    receipts = query.order_by(TubReceipt.date.desc()).all()

    result = []
    for receipt in receipts:
        response = TubReceiptResponse.model_validate(receipt)
        response.flavor_name = receipt.flavor.name if receipt.flavor else None
        response.recorded_by_name = receipt.recorded_by.full_name if receipt.recorded_by else None
        response.total_inches = receipt.quantity * receipt.inches_per_tub
        result.append(response)
    return result


@router.post("/receipts", response_model=TubReceiptResponse, status_code=status.HTTP_201_CREATED)
async def create_tub_receipt(
    data: TubReceiptCreate,
    current_user: User = Depends(require_role([UserRole.STAFF])),
    db: Session = Depends(get_db)
):
    """
    Record a tub receipt
    """
    if data.branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Can only record receipts for your branch")

    # Verify flavor exists
    flavor = db.query(Flavor).filter(Flavor.id == data.flavor_id).first()
    if not flavor:
        raise HTTPException(status_code=400, detail="Flavor not found")

    receipt = TubReceipt(
        branch_id=data.branch_id,
        date=data.date,
        flavor_id=data.flavor_id,
        quantity=data.quantity,
        inches_per_tub=data.inches_per_tub,
        reference_number=data.reference_number,
        notes=data.notes,
        recorded_by_id=current_user.id
    )

    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    response = TubReceiptResponse.model_validate(receipt)
    response.flavor_name = flavor.name
    response.recorded_by_name = current_user.full_name
    response.total_inches = receipt.quantity * receipt.inches_per_tub
    return response


@router.post("/receipts/bulk", response_model=List[TubReceiptResponse], status_code=status.HTTP_201_CREATED)
async def bulk_create_tub_receipts(
    data: TubReceiptBulk,
    current_user: User = Depends(require_role([UserRole.STAFF])),
    db: Session = Depends(get_db)
):
    """
    Bulk record tub receipts
    """
    if data.branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Can only record receipts for your branch")

    created = []
    for item in data.items:
        flavor = db.query(Flavor).filter(Flavor.id == item.flavor_id).first()
        if not flavor:
            continue

        receipt = TubReceipt(
            branch_id=data.branch_id,
            date=data.date,
            flavor_id=item.flavor_id,
            quantity=item.quantity,
            inches_per_tub=item.inches_per_tub,
            reference_number=data.reference_number,
            notes=item.notes,
            recorded_by_id=current_user.id
        )
        db.add(receipt)
        created.append((receipt, flavor))

    db.commit()

    result = []
    for receipt, flavor in created:
        db.refresh(receipt)
        response = TubReceiptResponse.model_validate(receipt)
        response.flavor_name = flavor.name
        response.recorded_by_name = current_user.full_name
        response.total_inches = receipt.quantity * receipt.inches_per_tub
        result.append(response)

    return result


# ============== DAILY SUMMARY ==============

@router.get("/summary/{branch_id}/{date}", response_model=DailySummary)
async def get_daily_summary(
    branch_id: int,
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get complete daily summary for a branch
    Shows opening, received, closing, and consumed for each flavor
    """
    # Verify access
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    if current_user.role == UserRole.STAFF:
        if branch_id != current_user.branch_id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Get all flavors
    flavors = db.query(Flavor).filter(Flavor.is_active == True).all()

    # Get opening entries
    opening_entries = {
        e.flavor_id: e.inches
        for e in db.query(DailyInventory).filter(
            and_(
                DailyInventory.branch_id == branch_id,
                DailyInventory.date == date,
                DailyInventory.entry_type == InventoryEntryType.OPENING
            )
        ).all()
    }

    # Get closing entries
    closing_entries = {
        e.flavor_id: e.inches
        for e in db.query(DailyInventory).filter(
            and_(
                DailyInventory.branch_id == branch_id,
                DailyInventory.date == date,
                DailyInventory.entry_type == InventoryEntryType.CLOSING
            )
        ).all()
    }

    # Get receipts
    receipts = db.query(TubReceipt).filter(
        and_(
            TubReceipt.branch_id == branch_id,
            TubReceipt.date == date
        )
    ).all()

    receipt_totals = {}
    for r in receipts:
        receipt_totals[r.flavor_id] = receipt_totals.get(r.flavor_id, 0) + (r.quantity * r.inches_per_tub)

    # Build summary
    flavor_summaries = []
    total_consumed = 0.0

    for flavor in flavors:
        opening = opening_entries.get(flavor.id, 0)
        received = receipt_totals.get(flavor.id, 0)
        closing = closing_entries.get(flavor.id, 0)
        consumed = opening + received - closing

        if opening > 0 or received > 0 or closing > 0:
            flavor_summaries.append(FlavorDailySummary(
                flavor_id=flavor.id,
                flavor_name=flavor.name,
                opening_inches=opening,
                received_inches=received,
                closing_inches=closing,
                consumed_inches=max(0, consumed)  # Prevent negative
            ))
            total_consumed += max(0, consumed)

    entry_complete = len(opening_entries) > 0 and len(closing_entries) > 0

    return DailySummary(
        branch_id=branch_id,
        branch_name=branch.name,
        date=date,
        flavors=flavor_summaries,
        total_consumed=total_consumed,
        entry_complete=entry_complete
    )
