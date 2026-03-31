"""
KPI Scorecards router
Returns per-branch KPI scorecard for a given date including sales, feedback, expiry, and visits
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from typing import Optional
from datetime import date, datetime, timedelta
import logging

from utils.database import get_db
from utils.security import get_current_user
from models.user import User, UserRole
from models.location import Branch
from models.sales import DailySales, BranchBudget, DailyBudget
from models.branch_visit import BranchVisit
from models.expiry import ExpiryRequestBranch, ExpiryBranchStatus, ExpiryResponse

logger = logging.getLogger(__name__)
router = APIRouter()

MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _status_sales(pct: float) -> str:
    if pct >= 100:
        return "green"
    elif pct >= 80:
        return "yellow"
    return "red"


def _status_feedback(avg_rating: float, complaints_7d: int) -> str:
    if avg_rating >= 4 and complaints_7d == 0:
        return "green"
    elif avg_rating >= 3:
        return "yellow"
    return "red"


def _status_expiry(near_expiry: int) -> str:
    if near_expiry == 0:
        return "green"
    elif near_expiry <= 3:
        return "yellow"
    return "red"


def _status_visits(count: int) -> str:
    if count >= 2:
        return "green"
    elif count == 1:
        return "yellow"
    return "red"


def _worst_status(*statuses: str) -> str:
    if "red" in statuses:
        return "red"
    elif "yellow" in statuses:
        return "yellow"
    return "green"


@router.get("/scorecards")
async def get_scorecards(
    target_date: Optional[date] = Query(None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return KPI scorecards for all branches the current user has access to.
    Scopes branches by role: SUPREME_ADMIN sees all, SUPER_ADMIN sees territory,
    ADMIN sees managed branches, STAFF sees their own branch only.
    """
    today = target_date or (datetime.utcnow() + timedelta(hours=4)).date()

    # --- Branch scoping ---
    branch_query = db.query(Branch).filter(Branch.is_active == True)
    if current_user.role == UserRole.SUPER_ADMIN:
        branch_query = branch_query.filter(Branch.territory_id == current_user.territory_id)
    elif current_user.role == UserRole.ADMIN:
        branch_query = branch_query.filter(Branch.manager_id == current_user.id)
    elif current_user.role == UserRole.STAFF:
        if current_user.branch_id:
            branch_query = branch_query.filter(Branch.id == current_user.branch_id)
        else:
            return []

    branches = branch_query.all()
    branch_ids = [b.id for b in branches]
    if not branch_ids:
        return []

    branch_map = {b.id: b for b in branches}

    # --- Sales: today ---
    today_sales_rows = (
        db.query(DailySales.branch_id, func.sum(DailySales.gross_sales).label("total"))
        .filter(
            DailySales.branch_id.in_(branch_ids),
            DailySales.date == today,
        )
        .group_by(DailySales.branch_id)
        .all()
    )
    today_sales_map = {r.branch_id: float(r.total or 0) for r in today_sales_rows}

    # --- Budget: today (DailyBudget) ---
    today_budget_rows = (
        db.query(DailyBudget.branch_id, DailyBudget.budget_amount)
        .filter(
            DailyBudget.branch_id.in_(branch_ids),
            DailyBudget.budget_date == today,
        )
        .all()
    )
    today_budget_map = {r.branch_id: float(r.budget_amount or 0) for r in today_budget_rows}

    # --- Sales: MTD ---
    mtd_start = today.replace(day=1)
    mtd_sales_rows = (
        db.query(DailySales.branch_id, func.sum(DailySales.gross_sales).label("total"))
        .filter(
            DailySales.branch_id.in_(branch_ids),
            DailySales.date >= mtd_start,
            DailySales.date <= today,
        )
        .group_by(DailySales.branch_id)
        .all()
    )
    mtd_sales_map = {r.branch_id: float(r.total or 0) for r in mtd_sales_rows}

    # --- Budget: MTD (BranchBudget monthly) ---
    mtd_budget_rows = (
        db.query(BranchBudget.branch_id, BranchBudget.target_sales)
        .filter(
            BranchBudget.branch_id.in_(branch_ids),
            BranchBudget.year == today.year,
            BranchBudget.month == today.month,
        )
        .all()
    )
    mtd_budget_map = {r.branch_id: float(r.target_sales or 0) for r in mtd_budget_rows}

    # --- Feedback: avg rating + complaints last 7 days ---
    feedback_map = {}
    try:
        from models.feedback import CustomerFeedback

        seven_days_ago = today - timedelta(days=7)

        fb_rows = (
            db.query(
                CustomerFeedback.branch_id,
                func.avg(CustomerFeedback.rating).label("avg_rating"),
            )
            .filter(CustomerFeedback.branch_id.in_(branch_ids))
            .group_by(CustomerFeedback.branch_id)
            .all()
        )
        avg_map = {r.branch_id: float(r.avg_rating or 0) for r in fb_rows}

        complaint_rows = (
            db.query(
                CustomerFeedback.branch_id,
                func.count(CustomerFeedback.id).label("cnt"),
            )
            .filter(
                CustomerFeedback.branch_id.in_(branch_ids),
                CustomerFeedback.feedback_type == "complaint",
                func.date(CustomerFeedback.created_at) >= seven_days_ago,
            )
            .group_by(CustomerFeedback.branch_id)
            .all()
        )
        complaint_map = {r.branch_id: int(r.cnt or 0) for r in complaint_rows}

        for bid in branch_ids:
            avg = avg_map.get(bid, 0.0)
            complaints = complaint_map.get(bid, 0)
            feedback_map[bid] = {
                "avg_rating": round(avg, 2),
                "complaints_7d": complaints,
                "status": _status_feedback(avg, complaints),
            }
    except Exception:
        for bid in branch_ids:
            feedback_map[bid] = {"avg_rating": 0.0, "complaints_7d": 0, "status": "green"}

    # --- Expiry: pending responses + near-expiry items (expiry_date within 30 days) ---
    pending_expiry_rows = (
        db.query(ExpiryRequestBranch.branch_id, func.count(ExpiryRequestBranch.id).label("cnt"))
        .filter(
            ExpiryRequestBranch.branch_id.in_(branch_ids),
            ExpiryRequestBranch.status == ExpiryBranchStatus.PENDING,
        )
        .group_by(ExpiryRequestBranch.branch_id)
        .all()
    )
    pending_expiry_map = {r.branch_id: int(r.cnt or 0) for r in pending_expiry_rows}

    near_expiry_cutoff = today + timedelta(days=30)
    near_expiry_rows = (
        db.query(ExpiryResponse.branch_id, func.count(ExpiryResponse.id).label("cnt"))
        .filter(
            ExpiryResponse.branch_id.in_(branch_ids),
            ExpiryResponse.expiry_date != None,
            ExpiryResponse.expiry_date <= near_expiry_cutoff,
            ExpiryResponse.expiry_date >= today,
        )
        .group_by(ExpiryResponse.branch_id)
        .all()
    )
    near_expiry_map = {r.branch_id: int(r.cnt or 0) for r in near_expiry_rows}

    # --- Visits: this month ---
    visit_rows = (
        db.query(BranchVisit.branch_id, func.count(BranchVisit.id).label("cnt"))
        .filter(
            BranchVisit.branch_id.in_(branch_ids),
            BranchVisit.visit_date >= mtd_start,
            BranchVisit.visit_date <= today,
        )
        .group_by(BranchVisit.branch_id)
        .all()
    )
    visit_map = {r.branch_id: int(r.cnt or 0) for r in visit_rows}

    # --- Build scorecards ---
    result = []
    for bid in branch_ids:
        branch = branch_map[bid]

        today_actual = today_sales_map.get(bid, 0.0)
        today_budget = today_budget_map.get(bid, 0.0)
        today_pct = round(today_actual / today_budget * 100, 1) if today_budget > 0 else 0.0

        mtd_actual = mtd_sales_map.get(bid, 0.0)
        mtd_budget = mtd_budget_map.get(bid, 0.0)
        mtd_pct = round(mtd_actual / mtd_budget * 100, 1) if mtd_budget > 0 else 0.0

        fb = feedback_map.get(bid, {"avg_rating": 0.0, "complaints_7d": 0, "status": "green"})

        pending_exp = pending_expiry_map.get(bid, 0)
        near_exp = near_expiry_map.get(bid, 0)
        exp_status = _status_expiry(near_exp)

        visit_count = visit_map.get(bid, 0)
        visit_status = _status_visits(visit_count)

        today_status = _status_sales(today_pct)
        mtd_status = _status_sales(mtd_pct)
        overall = _worst_status(today_status, mtd_status, fb["status"], exp_status, visit_status)

        result.append({
            "branch_id": bid,
            "branch_name": branch.name,
            "sales": {
                "today": today_actual,
                "budget_today": today_budget,
                "achievement_pct": today_pct,
                "status": today_status,
            },
            "mtd": {
                "actual": mtd_actual,
                "budget": mtd_budget,
                "achievement_pct": mtd_pct,
                "status": mtd_status,
            },
            "feedback": fb,
            "expiry": {
                "pending_responses": pending_exp,
                "near_expiry_items": near_exp,
                "status": exp_status,
            },
            "visits": {
                "this_month": visit_count,
                "status": visit_status,
            },
            "overall_status": overall,
        })

    return result
