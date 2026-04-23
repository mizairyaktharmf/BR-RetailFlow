"""
Sales router
Handles daily sales submissions and Gemini Vision extraction
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Optional
from datetime import date
import logging

from utils.database import get_db
from utils.security import get_current_user
from models.user import User, UserRole
from models.location import Branch
from models.sales import DailySales, SalesWindowType, BranchBudget, TrackedItem
from schemas.sales import (
    DailySalesCreate, DailySalesResponse, ReceiptExtractionResponse,
    TrackedItemCreate, TrackedItemResponse,
)

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
        cash_gc=getattr(s, 'cash_gc', None),
        atv=getattr(s, 'atv', None),
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
        cm_gross_sales=getattr(s, 'cm_gross_sales', None),
        cm_net_sales=getattr(s, 'cm_net_sales', None),
        cm_orders=getattr(s, 'cm_orders', None),
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
        _set(existing, 'cash_gc', data.cash_gc or 0)
        _set(existing, 'atv', data.atv or 0)
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
        # Cool Mood
        _set(existing, 'cm_gross_sales', data.cm_gross_sales or 0)
        _set(existing, 'cm_net_sales', data.cm_net_sales or 0)
        _set(existing, 'cm_orders', data.cm_orders or 0)
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
    _set(sales_entry, 'cash_gc', data.cash_gc or 0)
    _set(sales_entry, 'atv', data.atv or 0)
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
    _set(sales_entry, 'cm_gross_sales', data.cm_gross_sales or 0)
    _set(sales_entry, 'cm_net_sales', data.cm_net_sales or 0)
    _set(sales_entry, 'cm_orders', data.cm_orders or 0)

    db.add(sales_entry)
    db.commit()
    db.refresh(sales_entry)

    # Send WhatsApp alert (non-blocking)
    try:
        from models.whatsapp_config import WhatsAppConfig
        from services.whatsapp import send_sales_summary
        import asyncio
        wa_config = db.query(WhatsAppConfig).filter(WhatsAppConfig.branch_id == data.branch_id).first()
        if wa_config and wa_config.phone_numbers and "sales" in (wa_config.alert_types or ""):
            branch = db.query(Branch).filter(Branch.id == data.branch_id).first()
            branch_name = branch.name if branch else f"Branch {data.branch_id}"
            phones = [p.strip() for p in wa_config.phone_numbers.split(",") if p.strip()]
            asyncio.create_task(send_sales_summary(
                branch_name, data.sales_window,
                {"total_sales": data.total_sales, "transaction_count": data.transaction_count, "atv": data.atv or 0},
                phones
            ))
    except Exception as wa_err:
        logger.warning(f"WhatsApp alert failed (non-critical): {wa_err}")

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
    files: List[UploadFile] = File(...),
    receipt_type: str = Query(..., description="pos, pos_categories, pos_combined, hd, or deliveroo"),
    current_user: User = Depends(get_current_user),
):
    """Extract sales data from receipt photos.
    POS uses Claude (fast, reliable). HD/Deliveroo use Gemini.
    Accepts 1-5 images. Photos are NOT saved — only used for extraction."""
    from services.claude_vision import extract_pos_combined
    from services.gemini_vision import (
        extract_pos_sales,
        extract_pos_categories,
        extract_hd_sales,
        extract_deliveroo_sales,
    )

    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images allowed.")

    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/heic"]

    try:
        from PIL import Image
        import io

        def _resize_image(raw_bytes: bytes) -> bytes:
            """Resize large images to reduce Gemini processing time."""
            try:
                img = Image.open(io.BytesIO(raw_bytes))
                max_dim = 1600
                if max(img.size) > max_dim:
                    ratio = max_dim / max(img.size)
                    new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
                    img = img.resize(new_size, Image.LANCZOS)
                    buf = io.BytesIO()
                    img.save(buf, format='JPEG', quality=85)
                    logger.info(f"Resized image to {new_size}, {len(buf.getvalue())} bytes")
                    return buf.getvalue()
            except Exception as resize_err:
                logger.warning(f"Image resize skipped: {resize_err}")
            return raw_bytes

        # Read and resize all images
        image_bytes_list = []
        for f in files:
            raw = await f.read()
            # Convert any format to JPEG (handles HEIC, HEIF, WebP, etc.)
            try:
                img = Image.open(io.BytesIO(raw))
                if img.mode in ("RGBA", "P", "LA"):
                    img = img.convert("RGB")
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=90)
                raw = buf.getvalue()
            except Exception as conv_err:
                logger.warning(f"Image conversion skipped ({f.content_type}): {conv_err}")
            image_bytes_list.append(_resize_image(raw))

        logger.info(f"Extraction request: type={receipt_type}, images={len(image_bytes_list)}")

        if receipt_type == "pos":
            data = await extract_pos_sales(image_bytes_list[0])
        elif receipt_type == "pos_categories":
            data = await extract_pos_categories(image_bytes_list[0])
        elif receipt_type == "pos_combined":
            # Send ALL images to Gemini in one request
            data = await extract_pos_combined(image_bytes_list)
            logger.info(f"POS Combined result: cats={len(data.get('categories', []))}, items={len(data.get('items', []))}, summary_keys={list(data.get('sales_summary', {}).keys())}")
        elif receipt_type == "hd":
            data = await extract_hd_sales(image_bytes_list[0])
        elif receipt_type == "deliveroo":
            data = await extract_deliveroo_sales(image_bytes_list[0])
        else:
            raise HTTPException(status_code=400, detail=f"Invalid receipt_type: {receipt_type}.")

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


# ============== TRACKED PROMOTION ITEMS ==============

@router.get("/tracked-items", response_model=List[TrackedItemResponse])
async def get_tracked_items(
    branch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all tracked promotion items for a branch."""
    items = db.query(TrackedItem).filter(
        TrackedItem.branch_id == branch_id,
        TrackedItem.is_active == True,
    ).order_by(TrackedItem.created_at.desc()).all()
    return items


@router.post("/tracked-items", response_model=TrackedItemResponse)
async def add_tracked_item(
    data: TrackedItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a POS item to the promotion tracking list."""
    # Check if already tracked
    existing = db.query(TrackedItem).filter(
        TrackedItem.branch_id == data.branch_id,
        TrackedItem.item_code == data.item_code,
        TrackedItem.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Item {data.item_code} is already tracked")

    item = TrackedItem(
        branch_id=data.branch_id,
        item_code=data.item_code,
        item_name=data.item_name,
        category=data.category,
        created_by=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/tracked-items/{item_id}")
async def remove_tracked_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove (deactivate) a tracked promotion item."""
    item = db.query(TrackedItem).filter(TrackedItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Tracked item not found")
    item.is_active = False
    db.commit()
    return {"success": True, "message": f"Stopped tracking {item.item_name}"}


# ============== YEAR-OVER-YEAR MONTHLY SALES ==============

_MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


@router.get("/monthly-yoy")
async def monthly_year_over_year(
    branch_id: int = Query(None),
    year: int = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return monthly gross sales for a given year and the previous year.
    If branch_id is omitted, aggregates across all branches the user has access to.
    """
    from datetime import datetime as dt
    current_year = year or dt.utcnow().year
    previous_year = current_year - 1

    # Determine accessible branch IDs
    branch_query = db.query(Branch).filter(Branch.is_active == True)
    if current_user.role == UserRole.SUPER_ADMIN:
        branch_query = branch_query.filter(Branch.territory_id == current_user.territory_id)
    elif current_user.role == UserRole.ADMIN:
        branch_query = branch_query.filter(Branch.manager_id == current_user.id)
    elif current_user.role == UserRole.STAFF:
        if current_user.branch_id:
            branch_query = branch_query.filter(Branch.id == current_user.branch_id)
        else:
            branch_query = branch_query.filter(Branch.id == -1)  # Empty result

    accessible_ids = [b.id for b in branch_query.all()]

    if branch_id is not None:
        if branch_id not in accessible_ids:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Not authorized to view this branch")
        filter_ids = [branch_id]
    else:
        filter_ids = accessible_ids

    def _query_monthly(yr: int):
        """Return {month: total_gross_sales} for a given year."""
        rows = (
            db.query(
                func.extract("month", DailySales.date).label("month"),
                func.sum(DailySales.gross_sales).label("total"),
            )
            .filter(
                DailySales.branch_id.in_(filter_ids),
                func.extract("year", DailySales.date) == yr,
            )
            .group_by(func.extract("month", DailySales.date))
            .all()
        )
        return {int(r.month): float(r.total or 0) for r in rows}

    current_data = _query_monthly(current_year)
    previous_data = _query_monthly(previous_year)

    months = []
    total_current = 0.0
    total_previous = 0.0
    for m in range(1, 13):
        cur = current_data.get(m, 0.0)
        prev = previous_data.get(m, 0.0)
        total_current += cur
        total_previous += prev
        months.append({
            "month": m,
            "label": _MONTH_LABELS[m - 1],
            "current": cur,
            "previous": prev,
        })

    growth_pct = 0.0
    if total_previous > 0:
        growth_pct = round((total_current - total_previous) / total_previous * 100, 1)

    return {
        "current_year": current_year,
        "months": months,
        "totals": {
            "current": total_current,
            "previous": total_previous,
            "growth_pct": growth_pct,
        },
    }
