"""
Budget router — DAILY SALES TRACKER format
Handles budget sheet upload, extraction, confirmation, Smart Advisor, and tracker overview
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel
import logging
import json
import calendar

from utils.database import get_db
from utils.security import get_current_user
from models.user import User
from models.location import Branch
from models.sales import DailyBudget, BudgetUpload, DailySales

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== SCHEMAS ==============

class DailyBudgetDay(BaseModel):
    date: str  # YYYY-MM-DD
    day_name: Optional[str] = None
    day_of_week: Optional[str] = None
    budget: float = 0
    ly_sales: Optional[float] = 0
    ly_gc: Optional[int] = 0
    budget_gc: Optional[int] = 0
    mtd_ly_sales: Optional[float] = 0
    mtd_budget: Optional[float] = 0
    ly_atv: Optional[float] = 0
    notes: Optional[str] = None


class BudgetConfirmRequest(BaseModel):
    branch_id: int
    month: str  # YYYY-MM
    parlor_name: Optional[str] = None
    area_manager: Optional[str] = None
    kpis: Optional[dict] = None
    days: List[DailyBudgetDay]


class BudgetExtractionResponse(BaseModel):
    success: bool
    extracted: Optional[dict] = None
    calculated: Optional[dict] = None
    warnings: list = []
    error: Optional[str] = None


# ============== 1. UPLOAD BUDGET SHEET PHOTO ==============

@router.post("/upload", response_model=BudgetExtractionResponse)
async def upload_budget_sheet(
    file: UploadFile = File(...),
    branch_id: int = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a budget sheet photo and extract data using Gemini Vision.
    Photo is NOT saved — only used for extraction."""
    from services.gemini_vision import extract_budget_sheet

    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/heic"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Use JPEG, PNG, or WebP.")

    try:
        image_bytes = await file.read()
        extracted = await extract_budget_sheet(image_bytes)

        days = extracted.get("daily_data", [])
        warnings = []

        if len(days) == 0:
            warnings.append("No daily data found in the image")
        elif len(days) < 28:
            warnings.append(f"Only {len(days)} days extracted — expected 28-31")

        kpis = extracted.get("kpis", {})

        # Build calculated summary
        total_budget = sum((d.get("days_sales") or {}).get("budget") or 0 for d in days)
        total_ly_sales = sum((d.get("days_sales") or {}).get("ly_2025") or 0 for d in days)
        total_ly_gc = sum((d.get("days_guest_count") or {}).get("ly_2025") or 0 for d in days)
        total_budget_gc = sum(d.get("_budget_gc") or 0 for d in days)
        days_with_budget = [d for d in days if (d.get("days_sales") or {}).get("budget")]

        calculated = {
            "total_budget": total_budget,
            "total_ly_sales": total_ly_sales,
            "total_ly_gc": total_ly_gc,
            "total_budget_gc": total_budget_gc,
            "avg_daily_budget": round(total_budget / len(days_with_budget), 2) if days_with_budget else 0,
            "ly_kpis": kpis,
            "days_with_data": len(days_with_budget),
        }

        return BudgetExtractionResponse(
            success=True,
            extracted=extracted,
            calculated=calculated,
            warnings=warnings,
        )
    except Exception as e:
        logger.error(f"Budget extraction failed: {e}")
        return BudgetExtractionResponse(
            success=False,
            error=str(e),
        )


# ============== 2. CONFIRM & SAVE EXTRACTED BUDGET ==============

@router.post("/confirm")
async def confirm_budget(
    data: BudgetConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Confirm extracted budget data and save to database."""
    branch = db.query(Branch).filter(Branch.id == data.branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    saved_count = 0
    for day in data.days:
        try:
            budget_date = date.fromisoformat(day.date)
        except ValueError:
            continue

        existing = db.query(DailyBudget).filter(
            and_(
                DailyBudget.branch_id == data.branch_id,
                DailyBudget.budget_date == budget_date,
            )
        ).first()

        if existing:
            existing.budget_amount = day.budget
            existing.budget_gc = day.budget_gc or 0
            existing.ly_sales = day.ly_sales or 0
            existing.ly_gc = day.ly_gc or 0
            existing.day_name = day.day_name
            existing.day_of_week = day.day_of_week or day.day_name
            existing.mtd_ly_sales = day.mtd_ly_sales or 0
            existing.mtd_budget = day.mtd_budget or 0
            existing.ly_atv = day.ly_atv or 0
            existing.notes = day.notes
            existing.set_by = current_user.id
        else:
            entry = DailyBudget(
                branch_id=data.branch_id,
                budget_date=budget_date,
                budget_amount=day.budget,
                budget_gc=day.budget_gc or 0,
                ly_sales=day.ly_sales or 0,
                ly_gc=day.ly_gc or 0,
                day_name=day.day_name,
                day_of_week=day.day_of_week or day.day_name,
                mtd_ly_sales=day.mtd_ly_sales or 0,
                mtd_budget=day.mtd_budget or 0,
                ly_atv=day.ly_atv or 0,
                notes=day.notes,
                set_by=current_user.id,
            )
            db.add(entry)
        saved_count += 1

    # Log the upload with full KPIs
    kpis = data.kpis or {}
    upload_log = BudgetUpload(
        branch_id=data.branch_id,
        parlor_name=data.parlor_name,
        month=data.month,
        area_manager=data.area_manager,
        days_count=saved_count,
        total_budget=sum(d.budget for d in data.days),
        total_ly_sales=sum(d.ly_sales or 0 for d in data.days),
        total_ly_gc=sum(d.ly_gc or 0 for d in data.days),
        ly_atv=kpis.get("atv", {}).get("ly_2025") if kpis.get("atv") else None,
        ly_auv=kpis.get("auv", {}).get("ly_2025") if kpis.get("auv") else None,
        ly_cake_qty=kpis.get("cake_qty", {}).get("ly_2025") if kpis.get("cake_qty") else None,
        ly_hp_qty=kpis.get("hp_qty", {}).get("ly_2025") if kpis.get("hp_qty") else None,
        uploaded_by=current_user.id,
        status="confirmed",
    )
    db.add(upload_log)

    db.commit()

    return {
        "success": True,
        "message": f"Budget saved: {saved_count} days for {data.parlor_name or data.branch_id}",
        "summary": {
            "parlor_name": data.parlor_name,
            "month": data.month,
            "area_manager": data.area_manager,
            "days_saved": saved_count,
            "total_budget": sum(d.budget for d in data.days),
            "total_ly_sales": sum(d.ly_sales or 0 for d in data.days),
            "total_ly_gc": sum(d.ly_gc or 0 for d in data.days),
            "ly_kpis": kpis,
        },
    }


# ============== 3. GET DAILY BUDGET ==============

@router.get("/daily")
async def get_daily_budget(
    branch_id: int,
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get budget for a specific branch on a specific date."""
    budget = db.query(DailyBudget).filter(
        and_(
            DailyBudget.branch_id == branch_id,
            DailyBudget.budget_date == date,
        )
    ).first()

    if not budget:
        return None

    return {
        "branch_id": budget.branch_id,
        "budget_date": str(budget.budget_date),
        "budget_amount": budget.budget_amount,
        "budget_gc": budget.budget_gc,
        "ly_sales": budget.ly_sales,
        "ly_gc": budget.ly_gc,
        "day_name": budget.day_name,
        "day_of_week": budget.day_of_week,
        "mtd_ly_sales": budget.mtd_ly_sales,
        "mtd_budget": budget.mtd_budget,
        "ly_atv": budget.ly_atv,
        "notes": budget.notes,
    }


# ============== 4. GET MONTH BUDGET ==============

@router.get("/month")
async def get_month_budget(
    branch_id: int,
    month: str = Query(..., description="YYYY-MM format"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all budget days for a branch in a month."""
    try:
        year, mon = month.split("-")
        start = date(int(year), int(mon), 1)
        if int(mon) == 12:
            end = date(int(year) + 1, 1, 1)
        else:
            end = date(int(year), int(mon) + 1, 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")

    budgets = db.query(DailyBudget).filter(
        and_(
            DailyBudget.branch_id == branch_id,
            DailyBudget.budget_date >= start,
            DailyBudget.budget_date < end,
        )
    ).order_by(DailyBudget.budget_date).all()

    # Also get last upload info for KPIs
    upload = db.query(BudgetUpload).filter(
        and_(
            BudgetUpload.branch_id == branch_id,
            BudgetUpload.month == month,
        )
    ).order_by(BudgetUpload.created_at.desc()).first()

    return {
        "branch_id": branch_id,
        "month": month,
        "days_count": len(budgets),
        "total_budget": sum(b.budget_amount for b in budgets),
        "total_ly_sales": sum(b.ly_sales or 0 for b in budgets),
        "total_ly_gc": sum(b.ly_gc or 0 for b in budgets),
        "ly_kpis": {
            "atv": upload.ly_atv if upload else None,
            "auv": upload.ly_auv if upload else None,
            "cake_qty": upload.ly_cake_qty if upload else None,
            "hp_qty": upload.ly_hp_qty if upload else None,
        } if upload else None,
        "days": [
            {
                "date": str(b.budget_date),
                "day_name": b.day_name,
                "budget": b.budget_amount,
                "budget_gc": b.budget_gc,
                "ly_sales": b.ly_sales,
                "ly_gc": b.ly_gc,
                "mtd_ly_sales": b.mtd_ly_sales,
                "mtd_budget": b.mtd_budget,
                "ly_atv": b.ly_atv,
                "day_of_week": b.day_of_week,
                "notes": b.notes,
            }
            for b in budgets
        ],
    }


# ============== 5. BUDGET CHECK (is budget uploaded?) ==============

@router.get("/check/{branch_id}")
async def check_budget(
    branch_id: int,
    month: str = Query(..., description="YYYY-MM format"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if budget has been uploaded for a branch/month."""
    try:
        year, mon = month.split("-")
        start = date(int(year), int(mon), 1)
        if int(mon) == 12:
            end = date(int(year) + 1, 1, 1)
        else:
            end = date(int(year), int(mon) + 1, 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format")

    count = db.query(DailyBudget).filter(
        and_(
            DailyBudget.branch_id == branch_id,
            DailyBudget.budget_date >= start,
            DailyBudget.budget_date < end,
        )
    ).count()

    expected = calendar.monthrange(int(year), int(mon))[1]

    return {
        "branch_id": branch_id,
        "month": month,
        "budget_uploaded": count > 0,
        "days_loaded": count,
        "expected_days": expected,
    }


# ============== 6. SMART ADVISOR (Enhanced with MTD, categories, GP%) ==============

@router.get("/advisor/{branch_id}")
async def smart_advisor(
    branch_id: int,
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Smart Sales Advisor — calculates actionable advice based on budget vs actual."""

    # Get today's budget
    budget = db.query(DailyBudget).filter(
        and_(
            DailyBudget.branch_id == branch_id,
            DailyBudget.budget_date == date,
        )
    ).first()

    # Get today's sales (all windows)
    sales = db.query(DailySales).filter(
        and_(
            DailySales.branch_id == branch_id,
            DailySales.date == date,
        )
    ).all()

    # Get branch info
    branch = db.query(Branch).filter(Branch.id == branch_id).first()

    # Get latest upload KPIs
    upload = db.query(BudgetUpload).filter(
        BudgetUpload.branch_id == branch_id,
    ).order_by(BudgetUpload.created_at.desc()).first()

    # Aggregate sales across all windows
    actual_gross = sum(getattr(s, 'gross_sales', 0) or 0 for s in sales)
    actual_net = sum(s.total_sales or 0 for s in sales)
    actual_gc = sum(s.transaction_count or 0 for s in sales)
    hd_gross = sum(getattr(s, 'hd_gross_sales', 0) or 0 for s in sales)
    hd_net = sum(getattr(s, 'hd_net_sales', 0) or 0 for s in sales)
    hd_orders = sum(getattr(s, 'hd_orders', 0) or 0 for s in sales)
    del_gross = sum(getattr(s, 'deliveroo_gross_sales', 0) or 0 for s in sales)
    del_net = sum(getattr(s, 'deliveroo_net_sales', 0) or 0 for s in sales)
    del_orders = sum(getattr(s, 'deliveroo_orders', 0) or 0 for s in sales)

    combined_gross = actual_gross + hd_gross + del_gross
    combined_net = actual_net + hd_net + del_net
    combined_gc = actual_gc + hd_orders + del_orders

    # Budget fields
    budget_amt = budget.budget_amount if budget else 0
    budget_gc_target = budget.budget_gc if budget else 0
    ly_sales = budget.ly_sales if budget else 0
    ly_gc = budget.ly_gc if budget else 0
    ly_atv_val = budget.ly_atv if budget else (upload.ly_atv if upload else 0) or 0
    day_name = budget.day_name if budget else ""
    budget_atv = budget_amt / budget_gc_target if budget_gc_target > 0 else 0

    # MTD from budget
    mtd_ly_sales = budget.mtd_ly_sales if budget else 0
    mtd_budget_val = budget.mtd_budget if budget else 0

    # Current metrics
    current_atv = combined_gross / combined_gc if combined_gc > 0 else 0

    # Achievement
    ach_pct = (combined_gross / budget_amt * 100) if budget_amt > 0 else 0
    remaining = max(0, budget_amt - combined_gross)
    gc_remaining = max(0, budget_gc_target - combined_gc)

    # Growth vs LY
    vs_ly_growth = ((combined_gross - ly_sales) / ly_sales * 100) if ly_sales > 0 else 0
    vs_ly_gc_growth = ((combined_gc - ly_gc) / ly_gc * 100) if ly_gc > 0 else 0

    # MTD actuals
    month_start = date.replace(day=1)
    mtd_sales_rows = db.query(DailySales).filter(
        and_(
            DailySales.branch_id == branch_id,
            DailySales.date >= month_start,
            DailySales.date <= date,
        )
    ).all()

    mtd_actual_gross = sum(
        (getattr(s, 'gross_sales', 0) or 0) +
        (getattr(s, 'hd_gross_sales', 0) or 0) +
        (getattr(s, 'deliveroo_gross_sales', 0) or 0)
        for s in mtd_sales_rows
    )
    mtd_actual_gc = sum(
        (s.transaction_count or 0) +
        (getattr(s, 'hd_orders', 0) or 0) +
        (getattr(s, 'deliveroo_orders', 0) or 0)
        for s in mtd_sales_rows
    )
    mtd_ach_pct = (mtd_actual_gross / mtd_budget_val * 100) if mtd_budget_val > 0 else 0
    mtd_growth = ((mtd_actual_gross - mtd_ly_sales) / mtd_ly_sales * 100) if mtd_ly_sales > 0 else 0

    # Parse category data from latest sales
    categories = []
    for s in sales:
        if s.category_data:
            try:
                cats = json.loads(s.category_data) if isinstance(s.category_data, str) else s.category_data
                if isinstance(cats, list):
                    categories = cats  # Use latest window's categories
            except (json.JSONDecodeError, TypeError):
                pass

    # ---- BUILD ADVICE ----
    advice = []

    # Achievement status
    if not sales:
        advice.append({
            "type": "no_data", "priority": "info", "icon": "clock",
            "title": f"No sales uploaded yet — Target: {budget_amt:,.0f} AED",
            "detail": f"{day_name} budget: {budget_amt:,.0f} AED | LY did {ly_sales:,.0f} AED with {ly_gc} guests",
        })
    elif ach_pct >= 100:
        advice.append({
            "type": "achievement", "priority": "success", "icon": "trophy",
            "title": f"Budget ACHIEVED! {ach_pct:.1f}%",
            "detail": f"{combined_gross:,.0f} vs {budget_amt:,.0f} target. Exceeded by {(combined_gross - budget_amt):,.0f} AED!",
        })
    elif ach_pct >= 75:
        advice.append({
            "type": "achievement", "priority": "warning", "icon": "fire",
            "title": f"{ach_pct:.1f}% — Only {remaining:,.0f} AED to go!",
            "detail": f"Push hard! {combined_gross:,.0f} / {budget_amt:,.0f} AED",
        })
    else:
        advice.append({
            "type": "achievement", "priority": "critical", "icon": "alert",
            "title": f"{ach_pct:.1f}% achieved — Need {remaining:,.0f} AED more",
            "detail": f"Current: {combined_gross:,.0f} → Target: {budget_amt:,.0f} AED",
        })

    # ATV Focus
    if sales:
        if current_atv >= budget_atv and budget_atv > 0:
            advice.append({
                "type": "atv", "priority": "success", "icon": "trending_up",
                "title": f"ATV is {current_atv:.2f} AED — ABOVE budget ({budget_atv:.2f})",
                "detail": f"LY ATV was {ly_atv_val:.2f} AED. Spend per customer is strong! Focus on getting more guests.",
            })
        elif budget_atv > 0:
            atv_gap = budget_atv - current_atv
            advice.append({
                "type": "atv", "priority": "warning", "icon": "trending_up",
                "title": f"Boost ATV by {atv_gap:.2f} AED ({current_atv:.2f} → {budget_atv:.2f})",
                "detail": f"LY ATV: {ly_atv_val:.2f}. Upsell: suggest doubles, add toppings, push sundaes over scoops.",
            })

        # Guest Count strategy
        if gc_remaining > 0:
            projected = combined_gross + (gc_remaining * current_atv)
            advice.append({
                "type": "gc", "priority": "info", "icon": "users",
                "title": f"Need {gc_remaining} more guests to hit target GC ({budget_gc_target})",
                "detail": f"At current ATV ({current_atv:.2f}), {gc_remaining} guests = {(gc_remaining * current_atv):,.0f} AED more → Total: {projected:,.0f} AED",
            })

        # Remaining hours strategy
        if remaining > 0 and gc_remaining > 0:
            needed_atv = remaining / gc_remaining
            advice.append({
                "type": "strategy", "priority": "critical" if remaining > budget_amt * 0.3 else "info", "icon": "target",
                "title": "Remaining Hours: ATV x IR Strategy",
                "detail": f"Need: {gc_remaining} guests × {needed_atv:.2f} AED each = {remaining:,.0f} AED. {'MUST increase ATV — push premium items!' if needed_atv > current_atv else 'Maintain current ATV — focus on footfall!'}",
            })

        # Top category push
        if categories:
            sorted_cats = sorted(categories, key=lambda c: float(c.get("contribution_pct", c.get("pct", 0)) or 0), reverse=True)
            if sorted_cats:
                top = sorted_cats[0]
                cat_name = top.get("name", "Unknown")
                cat_pct = top.get("contribution_pct", top.get("pct", 0))
                cat_qty = top.get("quantity", top.get("qty", 0))
                cat_sales = top.get("sales", 0)
                advice.append({
                    "type": "category", "priority": "info", "icon": "ice_cream",
                    "title": f"Top seller: {cat_name} ({cat_pct}%)",
                    "detail": f"{cat_qty} sold, {float(cat_sales):,.0f} AED. Leverage this — suggest add-ons and upgrades.",
                })

    # vs Last Year
    if sales and ly_sales > 0:
        advice.append({
            "type": "ly", "priority": "success" if vs_ly_growth >= 0 else "warning",
            "icon": "trending_up" if vs_ly_growth >= 0 else "trending_down",
            "title": f"vs LY: {'+' if vs_ly_growth >= 0 else ''}{vs_ly_growth:.1f}% sales | {'+' if vs_ly_gc_growth >= 0 else ''}{vs_ly_gc_growth:.1f}% GC",
            "detail": f"LY {day_name}: {ly_sales:,.0f} AED ({ly_gc} GC) → Today: {combined_gross:,.0f} AED ({combined_gc} GC)",
        })

    # MTD summary
    if mtd_actual_gross > 0:
        advice.append({
            "type": "mtd", "priority": "success" if mtd_ach_pct >= 90 else "info", "icon": "calendar",
            "title": f"MTD: {mtd_actual_gross:,.0f} / {mtd_budget_val:,.0f} AED ({mtd_ach_pct:.1f}%)",
            "detail": f"MTD Growth vs LY: {'+' if mtd_growth >= 0 else ''}{mtd_growth:.1f}% | MTD GC: {mtd_actual_gc}",
        })

    return {
        "success": True,
        "date": str(date),
        "branch_id": branch_id,
        "parlor_name": branch.branch_name if branch else None,
        "day_name": day_name,
        "windows_submitted": len(sales),

        "daily": {
            "budget": budget_amt,
            "budget_gc": budget_gc_target,
            "budget_atv": round(budget_atv, 2),
            "ly_sales": ly_sales,
            "ly_gc": ly_gc,
            "ly_atv": round(ly_atv_val, 2),
            "actual_gross": round(combined_gross, 2),
            "actual_net": round(combined_net, 2),
            "actual_gc": combined_gc,
            "current_atv": round(current_atv, 2),
            "achievement_pct": round(ach_pct, 1),
            "remaining": round(remaining, 2),
            "remaining_gc": gc_remaining,
            "growth_vs_ly": round(vs_ly_growth, 1),
            "gc_growth_vs_ly": round(vs_ly_gc_growth, 1),
            "has_sales": len(sales) > 0,
        },

        "mtd": {
            "actual_sales": round(mtd_actual_gross, 2),
            "budget": mtd_budget_val,
            "ly_sales": mtd_ly_sales,
            "achievement_pct": round(mtd_ach_pct, 1),
            "growth_vs_ly": round(mtd_growth, 1),
            "actual_gc": mtd_actual_gc,
        },

        "ly_kpis": {
            "atv": upload.ly_atv if upload else ly_atv_val,
            "auv": upload.ly_auv if upload else 0,
            "cake_qty": upload.ly_cake_qty if upload else 0,
            "hp_qty": upload.ly_hp_qty if upload else 0,
        },

        "advice": advice,

        "categories": [
            {
                "name": c.get("name", ""),
                "qty": c.get("quantity", c.get("qty", 0)),
                "sales": float(c.get("sales", 0)),
                "pct": float(c.get("contribution_pct", c.get("pct", 0)) or 0),
            }
            for c in categories
        ],

        "budget_loaded": budget is not None,
    }


# ============== 7. TRACKER OVERVIEW (All branches for a date) ==============

@router.get("/tracker-overview")
async def tracker_overview(
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All branches overview — shows budget vs actual for every branch on a given date."""

    branches = db.query(Branch).filter(Branch.is_active == True).all()

    # Bulk fetch budgets + sales for the date
    budgets = db.query(DailyBudget).filter(DailyBudget.budget_date == date).all()
    all_sales = db.query(DailySales).filter(DailySales.date == date).all()

    b_map = {b.branch_id: b for b in budgets}
    # Group sales by branch
    s_map = {}
    for s in all_sales:
        if s.branch_id not in s_map:
            s_map[s.branch_id] = []
        s_map[s.branch_id].append(s)

    overview = []
    for br in branches:
        bud = b_map.get(br.id)
        sal_list = s_map.get(br.id, [])

        budget_amt = bud.budget_amount if bud else 0
        ly_sales_val = bud.ly_sales if bud else 0
        ly_gc_val = bud.ly_gc if bud else 0

        actual_gross = sum(
            (getattr(s, 'gross_sales', 0) or 0) +
            (getattr(s, 'hd_gross_sales', 0) or 0) +
            (getattr(s, 'deliveroo_gross_sales', 0) or 0)
            for s in sal_list
        )
        actual_gc = sum(
            (s.transaction_count or 0) +
            (getattr(s, 'hd_orders', 0) or 0) +
            (getattr(s, 'deliveroo_orders', 0) or 0)
            for s in sal_list
        )

        ach_pct = (actual_gross / budget_amt * 100) if budget_amt > 0 else 0
        growth_vs_ly = ((actual_gross - ly_sales_val) / ly_sales_val * 100) if ly_sales_val > 0 else 0
        atv = actual_gross / actual_gc if actual_gc > 0 else 0
        ly_atv_branch = ly_sales_val / ly_gc_val if ly_gc_val > 0 else 0

        # Determine status
        if not bud:
            status = "no_budget"
        elif ach_pct >= 100:
            status = "achieved"
        elif ach_pct >= 75:
            status = "on_track"
        elif ach_pct >= 50:
            status = "behind"
        else:
            status = "critical"

        overview.append({
            "branch_id": br.id,
            "branch_code": br.branch_code,
            "branch_name": br.branch_name,
            "day_name": bud.day_name if bud else None,
            "budget": budget_amt,
            "ly_sales": ly_sales_val,
            "ly_gc": ly_gc_val,
            "actual_gross": round(actual_gross, 2),
            "actual_gc": actual_gc,
            "achievement_pct": round(ach_pct, 1),
            "remaining": round(budget_amt - actual_gross, 2),
            "atv": round(atv, 2),
            "ly_atv": round(ly_atv_branch, 2),
            "growth_vs_ly": round(growth_vs_ly, 1),
            "budget_loaded": bud is not None,
            "has_sales": len(sal_list) > 0,
            "windows": len(sal_list),
            "status": status,
        })

    # Sort: critical first, then behind, no_budget, on_track, achieved
    order = {"critical": 0, "behind": 1, "no_budget": 2, "on_track": 3, "achieved": 4}
    overview.sort(key=lambda x: order.get(x["status"], 5))

    return {
        "success": True,
        "date": str(date),
        "summary": {
            "total": len(overview),
            "achieved": sum(1 for b in overview if b["status"] == "achieved"),
            "on_track": sum(1 for b in overview if b["status"] == "on_track"),
            "behind": sum(1 for b in overview if b["status"] == "behind"),
            "critical": sum(1 for b in overview if b["status"] == "critical"),
            "no_budget": sum(1 for b in overview if b["status"] == "no_budget"),
        },
        "branches": overview,
    }
