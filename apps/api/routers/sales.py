"""
Sales router
Handles daily sales submissions and Gemini Vision extraction
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
from typing import List, Optional, Any
from datetime import date, timedelta
import logging
import json

from utils.database import get_db
from utils.security import get_current_user
from models.user import User, UserRole
from models.location import Branch
from models.sales import DailySales, SalesWindowType, BranchBudget, TrackedItem, CustomSalesWindow
from schemas.sales import (
    DailySalesCreate, DailySalesResponse, ReceiptExtractionResponse,
    TrackedItemCreate, TrackedItemResponse,
    CustomSalesWindowCreate, CustomSalesWindowResponse, SalesWindowListResponse,
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
    Claude extracts ALL: POS, HD, Deliveroo, budget sheets, visit times (fast, reliable).
    Accepts 1-5 images. Photos are NOT saved — only used for extraction."""
    from services.claude_vision import (
        extract_pos_combined,
        extract_hd_sales,
        extract_deliveroo_sales,
        extract_budget_sheet,
        extract_visit_times,
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


# ============== PROMOTION ROI ==============

def _get_accessible_branch_ids(current_user: User, db: Session) -> List[int]:
    """Get branch IDs accessible to the current user."""
    branch_query = db.query(Branch).filter(Branch.is_active == True)
    if current_user.role == UserRole.SUPER_ADMIN:
        branch_query = branch_query.filter(Branch.territory_id == current_user.territory_id)
    elif current_user.role == UserRole.ADMIN:
        branch_query = branch_query.filter(Branch.manager_id == current_user.id)
    elif current_user.role == UserRole.STAFF:
        if current_user.branch_id:
            branch_query = branch_query.filter(Branch.id == current_user.branch_id)
        else:
            branch_query = branch_query.filter(Branch.id == -1)
    return [b.id for b in branch_query.all()]


@router.get("/promotion-roi")
async def get_promotion_roi(
    date_from: date = Query(...),
    date_to: date = Query(...),
    branch_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get promotion ROI for tracked items over a date range."""
    accessible_branch_ids = _get_accessible_branch_ids(current_user, db)

    if branch_id:
        if branch_id not in accessible_branch_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view this branch")
        filter_ids = [branch_id]
    else:
        filter_ids = accessible_branch_ids

    # Calculate baseline date range (prior period of same length)
    period_length = (date_to - date_from).days
    baseline_to = date_from - timedelta(days=1)
    baseline_from = baseline_to - timedelta(days=period_length)

    # Get all tracked items for the accessible branches
    tracked_items = db.query(TrackedItem).filter(
        TrackedItem.branch_id.in_(filter_ids),
        TrackedItem.is_active == True,
    ).all()

    def _query_period(start: date, end: date):
        """Query sales data for tracked items in a date range."""
        sales_records = db.query(DailySales).filter(
            DailySales.branch_id.in_(filter_ids),
            DailySales.date >= start,
            DailySales.date <= end,
        ).all()

        item_stats = {}
        for tracked in tracked_items:
            item_key = f"{tracked.id}"
            item_stats[item_key] = {"qty": 0, "sales": 0.0}

            for sales in sales_records:
                if not sales.items_data:
                    continue

                try:
                    items_list = json.loads(sales.items_data)
                except:
                    continue

                for item in items_list:
                    match = False
                    if tracked.item_code.startswith("NAME:"):
                        tracked_name = tracked.item_code[5:].lower()
                        match = tracked_name in (item.get("name") or "").lower()
                    elif tracked.item_code.startswith("CAT:"):
                        tracked_cat = tracked.item_code[4:].lower()
                        match = tracked_cat == (item.get("category") or "").lower()
                    else:
                        match = tracked.item_code == item.get("code")

                    if match:
                        item_stats[item_key]["qty"] += item.get("quantity", 0)
                        item_stats[item_key]["sales"] += item.get("sales", 0.0)

        return item_stats

    period_data = _query_period(date_from, date_to)
    baseline_data = _query_period(baseline_from, baseline_to)

    # Build response
    result_items = []
    for tracked in tracked_items:
        item_key = f"{tracked.id}"
        period = period_data.get(item_key, {"qty": 0, "sales": 0.0})
        baseline = baseline_data.get(item_key, {"qty": 0, "sales": 0.0})

        qty_change_pct = 0.0
        if baseline["qty"] > 0:
            qty_change_pct = round((period["qty"] - baseline["qty"]) / baseline["qty"] * 100, 1)

        sales_change_pct = 0.0
        if baseline["sales"] > 0:
            sales_change_pct = round((period["sales"] - baseline["sales"]) / baseline["sales"] * 100, 1)

        branch = db.query(Branch).filter(Branch.id == tracked.branch_id).first()
        item_type = "name" if tracked.item_code.startswith("NAME:") else \
                    "category" if tracked.item_code.startswith("CAT:") else "code"

        result_items.append({
            "tracked_item_id": tracked.id,
            "name": tracked.item_name,
            "type": item_type,
            "branch_id": tracked.branch_id,
            "branch_name": branch.name if branch else "Unknown",
            "qty": period["qty"],
            "sales": round(period["sales"], 2),
            "baseline_qty": baseline["qty"],
            "baseline_sales": round(baseline["sales"], 2),
            "qty_change_pct": qty_change_pct,
            "sales_change_pct": sales_change_pct,
        })

    return {
        "period": {"from": str(date_from), "to": str(date_to)},
        "baseline": {"from": str(baseline_from), "to": str(baseline_to)},
        "items": sorted(result_items, key=lambda x: x["sales_change_pct"], reverse=True),
    }


# ============== BRANCH RANKING ==============

@router.get("/branch-ranking")
async def get_branch_ranking(
    date_from: date = Query(...),
    date_to: date = Query(...),
    metric: str = Query("sales", regex="^(sales|gc|atv|budget_ach)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get branch ranking leaderboard."""
    accessible_branch_ids = _get_accessible_branch_ids(current_user, db)

    # Get sales data grouped by branch
    sales_by_branch = {}
    for branch_id in accessible_branch_ids:
        sales_rows = db.query(DailySales).filter(
            DailySales.branch_id == branch_id,
            DailySales.date >= date_from,
            DailySales.date <= date_to,
        ).all()

        total_sales = sum(s.total_sales or 0 for s in sales_rows)
        total_gc = sum(s.transaction_count or 0 for s in sales_rows)
        total_atv_sum = sum((s.atv or 0) * (s.transaction_count or 1) for s in sales_rows)
        avg_atv = total_atv_sum / total_gc if total_gc > 0 else 0

        budget_rows = db.query(func.sum(func.coalesce(DailySales.total_sales, 0)).label("total")).filter(
            DailySales.branch_id == branch_id,
            DailySales.date >= date_from,
            DailySales.date <= date_to,
        ).first()

        from models.sales import DailyBudget
        budget_total = db.query(func.sum(DailyBudget.budget_amount)).filter(
            DailyBudget.branch_id == branch_id,
            DailyBudget.budget_date >= date_from,
            DailyBudget.budget_date <= date_to,
        ).scalar() or 0

        budget_ach_pct = round((total_sales / budget_total * 100), 1) if budget_total > 0 else 0

        sales_by_branch[branch_id] = {
            "total_sales": total_sales,
            "total_gc": total_gc,
            "avg_atv": round(avg_atv, 2),
            "budget_total": budget_total,
            "budget_ach_pct": budget_ach_pct,
        }

    # Calculate prior period for change_vs_prev
    period_length = (date_to - date_from).days
    prev_date_to = date_from - timedelta(days=1)
    prev_date_from = prev_date_to - timedelta(days=period_length)

    prev_sales_by_branch = {}
    for branch_id in accessible_branch_ids:
        prev_sales = db.query(func.sum(func.coalesce(DailySales.total_sales, 0))).filter(
            DailySales.branch_id == branch_id,
            DailySales.date >= prev_date_from,
            DailySales.date <= prev_date_to,
        ).scalar() or 0
        prev_sales_by_branch[branch_id] = prev_sales

    # Determine sort key based on metric
    metric_key = {"sales": "total_sales", "gc": "total_gc", "atv": "avg_atv", "budget_ach": "budget_ach_pct"}[metric]

    # Build ranking
    ranking_list = []
    for branch_id in accessible_branch_ids:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            continue

        stats = sales_by_branch[branch_id]
        prev_sales = prev_sales_by_branch[branch_id]

        change_vs_prev = 0.0
        if prev_sales > 0:
            change_vs_prev = round((stats["total_sales"] - prev_sales) / prev_sales * 100, 1)

        ranking_list.append({
            "branch_id": branch_id,
            "branch_name": branch.name,
            "total_sales": stats["total_sales"],
            "total_gc": stats["total_gc"],
            "avg_atv": stats["avg_atv"],
            "budget_total": stats["budget_total"],
            "budget_ach_pct": stats["budget_ach_pct"],
            "change_vs_prev": change_vs_prev if metric == "sales" else None,
        })

    # Sort by metric
    ranking_list.sort(key=lambda x: x[metric_key], reverse=True)

    # Add rank numbers
    for idx, item in enumerate(ranking_list, 1):
        item["rank"] = idx

    return {
        "metric": metric,
        "period": {"from": str(date_from), "to": str(date_to)},
        "ranking": ranking_list,
    }


# ============== CUSTOM SALES WINDOWS ==============

@router.get("/windows", response_model=dict)
async def get_available_windows(
    branch_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all available sales windows for a branch (fixed + custom)."""
    from models.sales import CustomSalesWindow

    # Check user has access to this branch
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # Fixed windows always available
    fixed_windows = ["3pm", "7pm", "9pm", "closing"]

    # Get custom windows for this branch
    custom_windows = db.query(CustomSalesWindow).filter(
        CustomSalesWindow.branch_id == branch_id,
        CustomSalesWindow.is_active == True,
    ).order_by(CustomSalesWindow.created_at).all()

    custom_list = [
        {
            "id": w.id,
            "window_name": w.window_name,
            "is_active": w.is_active,
            "created_at": w.created_at.isoformat(),
        }
        for w in custom_windows
    ]

    return {
        "branch_id": branch_id,
        "fixed_windows": fixed_windows,
        "custom_windows": custom_list,
    }


@router.post("/windows", response_model=dict)
async def create_custom_window(
    data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a custom sales window. Branch managers can only create for their branch."""
    from models.sales import CustomSalesWindow

    branch_id = data.get("branch_id")
    window_name = data.get("window_name", "").strip()

    if not branch_id or not window_name:
        raise HTTPException(status_code=400, detail="branch_id and window_name are required")

    # Check user has access to this branch
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # Permission check: managers can only create for their assigned branch
    if current_user.role == UserRole.ADMIN and current_user.branch_id != branch_id:
        raise HTTPException(status_code=403, detail="Managers can only create windows for their assigned branch")

    # Check window doesn't already exist
    existing = db.query(CustomSalesWindow).filter(
        CustomSalesWindow.branch_id == branch_id,
        CustomSalesWindow.window_name == window_name,
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail=f"Window '{window_name}' already exists for this branch")

    # Create new window
    new_window = CustomSalesWindow(
        branch_id=branch_id,
        window_name=window_name,
        created_by_id=current_user.id,
    )

    db.add(new_window)
    db.commit()
    db.refresh(new_window)

    return {
        "id": new_window.id,
        "branch_id": new_window.branch_id,
        "window_name": new_window.window_name,
        "is_active": new_window.is_active,
        "created_at": new_window.created_at.isoformat(),
    }


@router.delete("/windows/{window_id}")
async def delete_custom_window(
    window_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a custom sales window (soft delete - set inactive)."""
    from models.sales import CustomSalesWindow

    window = db.query(CustomSalesWindow).filter(CustomSalesWindow.id == window_id).first()
    if not window:
        raise HTTPException(status_code=404, detail="Window not found")

    # Permission check
    if current_user.role == UserRole.ADMIN and current_user.branch_id != window.branch_id:
        raise HTTPException(status_code=403, detail="Can only delete windows for your assigned branch")

    # Soft delete
    window.is_active = False
    db.commit()

    return {"success": True, "message": f"Window '{window.window_name}' deleted"}
