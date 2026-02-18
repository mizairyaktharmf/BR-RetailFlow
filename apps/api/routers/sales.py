"""
Sales router
Handles daily sales submissions (manual entry)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List
from datetime import date
import logging

from utils.database import get_db
from utils.security import get_current_user
from models.user import User
from models.location import Branch
from models.sales import DailySales, SalesWindowType
from schemas.sales import DailySalesCreate, DailySalesResponse

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
        photo_url=s.photo_url,
        notes=s.notes,
        hd_gross_sales=getattr(s, 'hd_gross_sales', None),
        hd_net_sales=getattr(s, 'hd_net_sales', None),
        hd_orders=getattr(s, 'hd_orders', None),
        hd_photo_url=getattr(s, 'hd_photo_url', None),
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
        if data.photo_url:
            existing.photo_url = data.photo_url
        if data.notes:
            existing.notes = data.notes
        # Home Delivery fields
        _set(existing, 'hd_gross_sales', data.hd_gross_sales or 0)
        _set(existing, 'hd_net_sales', data.hd_net_sales or 0)
        _set(existing, 'hd_orders', data.hd_orders or 0)
        if data.hd_photo_url:
            _set(existing, 'hd_photo_url', data.hd_photo_url)
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
    _set(sales_entry, 'hd_gross_sales', data.hd_gross_sales or 0)
    _set(sales_entry, 'hd_net_sales', data.hd_net_sales or 0)
    _set(sales_entry, 'hd_orders', data.hd_orders or 0)
    _set(sales_entry, 'hd_photo_url', data.hd_photo_url)

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
