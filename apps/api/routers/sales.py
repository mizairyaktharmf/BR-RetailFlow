"""
Sales router
Handles daily sales submissions and Gemini Vision extraction
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
from datetime import date
import logging

from utils.database import get_db
from utils.security import get_current_user
from models.user import User
from models.location import Branch
from models.sales import DailySales, SalesWindowType, BranchBudget
from schemas.sales import DailySalesCreate, DailySalesResponse, ReceiptExtractionResponse

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== DAILY SALES ==============

def _build_sales_response(s) -> DailySalesResponse:
    """Build DailySalesResponse from a DailySales model instance."""
    return DailySalesResponse(
        id=s.id,
        branch_id=s.branch_id,
        date=s.date,
        sales_window=s.sales_window.value,
        gross_sales=getattr(s, 'gross_sales', None),
        total_sales=s.total_sales,
        transaction_count=s.transaction_count,
        cash_sales=getattr(s, 'cash_sales', None),
        ly_sale=getattr(s, 'ly_sale', None),
        cake_units=getattr(s, 'cake_units', None),
        hand_pack_units=getattr(s, 'hand_pack_units', None),
        sundae_pct=getattr(s, 'sundae_pct', None),
        cups_cones_pct=getattr(s, 'cups_cones_pct', None),
        category_data=getattr(s, 'category_data', None),
        items_data=getattr(s, 'items_data', None),
        photo_url=s.photo_url,
        notes=s.notes,
        hd_gross_sales=getattr(s, 'hd_gross_sales', None),
        hd_net_sales=getattr(s, 'hd_net_sales', None),
        hd_orders=getattr(s, 'hd_orders', None),
        hd_photo_url=getattr(s, 'hd_photo_url', None),
        deliveroo_gross_sales=getattr(s, 'deliveroo_gross_sales', None),
        deliveroo_net_sales=getattr(s, 'deliveroo_net_sales', None),
        deliveroo_orders=getattr(s, 'deliveroo_orders', None),
        deliveroo_photo_url=getattr(s, 'deliveroo_photo_url', None),
        submitted_by_id=s.submitted_by_id,
        created_at=s.created_at,
    )


@router.post("/daily", response_model=DailySalesResponse)
async def submit_daily_sales(
    data: DailySalesCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit a daily sales report for a specific window"""
    branch = db.query(Branch).filter(Branch.id == data.branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    window_map = {
        "3pm": SalesWindowType.WINDOW_3PM,
        "7pm": SalesWindowType.WINDOW_7PM,
        "9pm": SalesWindowType.WINDOW_9PM,
        "closing": SalesWindowType.CLOSING,
    }
    window_enum = window_map.get(data.sales_window)
    if not window_enum:
        raise HTTPException(status_code=400, detail=f"Invalid sales window: {data.sales_window}")

    existing = db.query(DailySales).filter(
        and_(
            DailySales.branch_id == data.branch_id,
            DailySales.date == data.date,
            DailySales.sales_window == window_enum,
        )
    ).first()

    # Helper to safely set a field if column exists
    def _set(obj, field, value):
        if hasattr(obj, field):
            setattr(obj, field, value)

    if existing:
        existing.total_sales = data.total_sales
        existing.transaction_count = data.transaction_count
        _set(existing, 'gross_sales', data.gross_sales or 0)
        _set(existing, 'cash_sales', data.cash_sales or 0)
        _set(existing, 'ly_sale', data.ly_sale or 0)
        _set(existing, 'cake_units', data.cake_units or 0)
        _set(existing, 'hand_pack_units', data.hand_pack_units or 0)
        _set(existing, 'sundae_pct', data.sundae_pct or 0)
        _set(existing, 'cups_cones_pct', data.cups_cones_pct or 0)
        _set(existing, 'category_data', data.category_data)
        _set(existing, 'items_data', data.items_data)
        if data.photo_url:
            existing.photo_url = data.photo_url
        if data.notes:
            existing.notes = data.notes
        # Home Delivery
        _set(existing, 'hd_gross_sales', data.hd_gross_sales or 0)
        _set(existing, 'hd_net_sales', data.hd_net_sales or 0)
        _set(existing, 'hd_orders', data.hd_orders or 0)
        if data.hd_photo_url:
            _set(existing, 'hd_photo_url', data.hd_photo_url)
        # Deliveroo
        _set(existing, 'deliveroo_gross_sales', data.deliveroo_gross_sales or 0)
        _set(existing, 'deliveroo_net_sales', data.deliveroo_net_sales or 0)
        _set(existing, 'deliveroo_orders', data.deliveroo_orders or 0)
        if data.deliveroo_photo_url:
            _set(existing, 'deliveroo_photo_url', data.deliveroo_photo_url)
        db.commit()
        db.refresh(existing)

        return _build_sales_response(existing)

    sales_entry = DailySales(
        branch_id=data.branch_id,
        date=data.date,
        sales_window=window_enum,
        total_sales=data.total_sales,
        transaction_count=data.transaction_count,
        photo_url=data.photo_url,
        notes=data.notes,
        submitted_by_id=current_user.id,
    )

    _set(sales_entry, 'gross_sales', data.gross_sales or 0)
    _set(sales_entry, 'cash_sales', data.cash_sales or 0)
    _set(sales_entry, 'ly_sale', data.ly_sale or 0)
    _set(sales_entry, 'cake_units', data.cake_units or 0)
    _set(sales_entry, 'hand_pack_units', data.hand_pack_units or 0)
    _set(sales_entry, 'sundae_pct', data.sundae_pct or 0)
    _set(sales_entry, 'cups_cones_pct', data.cups_cones_pct or 0)
    _set(sales_entry, 'category_data', data.category_data)
    _set(sales_entry, 'items_data', data.items_data)
    _set(sales_entry, 'hd_gross_sales', data.hd_gross_sales or 0)
    _set(sales_entry, 'hd_net_sales', data.hd_net_sales or 0)
    _set(sales_entry, 'hd_orders', data.hd_orders or 0)
    _set(sales_entry, 'hd_photo_url', data.hd_photo_url)
    _set(sales_entry, 'deliveroo_gross_sales', data.deliveroo_gross_sales or 0)
    _set(sales_entry, 'deliveroo_net_sales', data.deliveroo_net_sales or 0)
    _set(sales_entry, 'deliveroo_orders', data.deliveroo_orders or 0)
    _set(sales_entry, 'deliveroo_photo_url', data.deliveroo_photo_url)

    db.add(sales_entry)
    db.commit()
    db.refresh(sales_entry)

    return _build_sales_response(sales_entry)


@router.get("/daily", response_model=List[DailySalesResponse])
async def get_daily_sales(
    branch_id: int,
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get daily sales for a branch on a specific date"""
    sales = db.query(DailySales).filter(
        and_(
            DailySales.branch_id == branch_id,
            DailySales.date == date,
        )
    ).order_by(DailySales.created_at).all()

    return [_build_sales_response(s) for s in sales]


# ============== BUDGET ==============

@router.get("/budget")
async def get_branch_budget(
    branch_id: int,
    year: int,
    month: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get branch budget for a specific month"""
    budget = db.query(BranchBudget).filter(
        and_(
            BranchBudget.branch_id == branch_id,
            BranchBudget.year == year,
            BranchBudget.month == month,
        )
    ).first()

    if not budget:
        return None

    return {
        "id": budget.id,
        "branch_id": budget.branch_id,
        "year": budget.year,
        "month": budget.month,
        "target_sales": budget.target_sales,
        "target_transactions": budget.target_transactions,
        "last_year_sales": budget.last_year_sales,
        "last_year_transactions": budget.last_year_transactions,
    }


# ============== GEMINI VISION EXTRACTION ==============

@router.post("/extract-receipt", response_model=ReceiptExtractionResponse)
async def extract_receipt(
    file: UploadFile = File(...),
    receipt_type: str = Query(..., description="pos, pos_categories, hd, or deliveroo"),
    current_user: User = Depends(get_current_user),
):
    """Extract sales data from a receipt photo using Gemini Vision.
    Photo is NOT saved — only used for extraction."""
    from services.gemini_vision import (
        extract_pos_sales,
        extract_pos_categories,
        extract_hd_sales,
        extract_deliveroo_sales,
    )

    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/heic"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Use JPEG, PNG, or WebP.")

    try:
        image_bytes = await file.read()

        if receipt_type == "pos":
            data = await extract_pos_sales(image_bytes)
        elif receipt_type == "pos_categories":
            data = await extract_pos_categories(image_bytes)
        elif receipt_type == "hd":
            data = await extract_hd_sales(image_bytes)
        elif receipt_type == "deliveroo":
            data = await extract_deliveroo_sales(image_bytes)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid receipt_type: {receipt_type}. Use pos, pos_categories, hd, or deliveroo.")

        return ReceiptExtractionResponse(
            receipt_type=receipt_type,
            success=True,
            data=data,
        )
    except ValueError as e:
        return ReceiptExtractionResponse(
            receipt_type=receipt_type,
            success=False,
            data={},
            error=str(e),
        )
    except Exception as e:
        logger.error(f"Extraction failed for {receipt_type}: {e}")
        return ReceiptExtractionResponse(
            receipt_type=receipt_type,
            success=False,
            data={},
            error=f"Extraction failed: {str(e)}",
        )
