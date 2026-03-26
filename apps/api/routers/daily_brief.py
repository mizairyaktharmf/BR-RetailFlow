"""
AI Daily Brief router
Aggregates data from sales, budget, visits, expiry, cake alerts
and uses Gemini to generate a natural-language summary.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func
from typing import Optional
from datetime import date, datetime, timedelta
import json
import logging

from utils.database import get_db
from utils.security import get_current_user
from utils.config import settings
from models.user import User, UserRole
from models.location import Branch
from models.sales import DailyBudget, DailySales
from models.branch_visit import BranchVisit
from models.expiry import ExpiryRequest, ExpiryRequestBranch, ExpiryBranchStatus

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_today():
    """Get today's date (UTC+4 Dubai)."""
    return (datetime.utcnow() + timedelta(hours=4)).date()


def _gather_admin_data(db: Session, current_user: User, target_date: date) -> dict:
    """Gather all data for admin/TM/AM daily brief."""

    # Determine branch scope
    branch_query = db.query(Branch).filter(Branch.is_active == True)
    if current_user.role == UserRole.SUPER_ADMIN:
        branch_query = branch_query.filter(Branch.territory_id == current_user.territory_id)
    elif current_user.role == UserRole.ADMIN:
        branch_query = branch_query.filter(Branch.manager_id == current_user.id)
    branches = branch_query.all()
    branch_ids = [b.id for b in branches]

    if not branch_ids:
        return {"branches": [], "budget": {}, "visits": {}, "expiry": {}}

    # --- Budget vs Actual ---
    budgets = db.query(DailyBudget).filter(
        and_(DailyBudget.branch_id.in_(branch_ids), DailyBudget.budget_date == target_date)
    ).all()
    all_sales = db.query(DailySales).filter(
        and_(DailySales.branch_id.in_(branch_ids), DailySales.date == target_date)
    ).all()

    b_map = {b.branch_id: b for b in budgets}
    s_map = {}
    for s in all_sales:
        if s.branch_id not in s_map:
            s_map[s.branch_id] = []
        s_map[s.branch_id].append(s)

    budget_data = []
    total_budget = 0
    total_actual = 0
    for br in branches:
        bud = b_map.get(br.id)
        sal_list = s_map.get(br.id, [])
        budget_amt = bud.budget_amount if bud else 0
        actual_gross = sum(
            (getattr(s, 'gross_sales', 0) or 0) +
            (getattr(s, 'hd_gross_sales', 0) or 0) +
            (getattr(s, 'deliveroo_gross_sales', 0) or 0)
            for s in sal_list
        )
        ach_pct = round((actual_gross / budget_amt * 100), 1) if budget_amt > 0 else 0
        total_budget += budget_amt
        total_actual += actual_gross

        if budget_amt > 0 or actual_gross > 0:
            budget_data.append({
                "branch": br.name,
                "budget": round(budget_amt),
                "actual": round(actual_gross),
                "achievement": ach_pct,
                "status": "achieved" if ach_pct >= 100 else "on_track" if ach_pct >= 75 else "behind" if ach_pct >= 50 else "critical",
            })

    # --- Visits ---
    visits = db.query(BranchVisit).filter(BranchVisit.visit_date == target_date)
    if current_user.role == UserRole.ADMIN:
        visits = visits.filter(BranchVisit.user_id == current_user.id)
    elif current_user.role == UserRole.SUPER_ADMIN:
        visits = visits.join(User, BranchVisit.user_id == User.id).filter(
            User.territory_id == current_user.territory_id
        )
    visits = visits.all()

    visit_data = {
        "total_visits": len(visits),
        "total_hours": round(sum(v.hours_spent or 0 for v in visits), 1),
        "unique_users": len(set(v.user_id for v in visits)),
        "branches_visited": len(set(v.branch_id for v in visits)),
    }

    # Check AMs who didn't visit (for TM/HQ)
    if current_user.role in [UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN]:
        am_query = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active == True)
        if current_user.role == UserRole.SUPER_ADMIN:
            am_query = am_query.filter(User.territory_id == current_user.territory_id)
        all_ams = am_query.all()
        visited_user_ids = set(v.user_id for v in visits)
        no_visit_ams = [am.full_name for am in all_ams if am.id not in visited_user_ids]
        visit_data["ams_no_visit"] = no_visit_ams

    # --- Expiry Tracking ---
    expiry_requests = db.query(ExpiryRequest).filter(ExpiryRequest.status == "open").all()
    pending_branches = db.query(ExpiryRequestBranch).filter(
        ExpiryRequestBranch.status == ExpiryBranchStatus.PENDING
    ).count()
    expiry_data = {
        "open_requests": len(expiry_requests),
        "pending_branch_responses": pending_branches,
    }

    # --- Cake Alerts (try, may not have model) ---
    cake_data = []
    try:
        from models.cake import CakeStock, CakeAlertConfig, CakeProduct
        stocks = db.query(CakeStock).filter(CakeStock.branch_id.in_(branch_ids)).all()
        for stock in stocks:
            config = db.query(CakeAlertConfig).filter(
                and_(CakeAlertConfig.branch_id == stock.branch_id,
                     CakeAlertConfig.cake_product_id == stock.cake_product_id)
            ).first()
            threshold = config.low_stock_threshold if config else 5
            if stock.current_quantity <= threshold:
                product = db.query(CakeProduct).filter(CakeProduct.id == stock.cake_product_id).first()
                branch = next((b for b in branches if b.id == stock.branch_id), None)
                cake_data.append({
                    "product": product.name if product else "Unknown",
                    "branch": branch.name if branch else "Unknown",
                    "qty": stock.current_quantity,
                    "threshold": threshold,
                })
    except Exception:
        pass

    return {
        "branch_count": len(branches),
        "budget": {
            "branches": budget_data,
            "total_budget": round(total_budget),
            "total_actual": round(total_actual),
            "overall_achievement": round((total_actual / total_budget * 100), 1) if total_budget > 0 else 0,
        },
        "visits": visit_data,
        "expiry": expiry_data,
        "cake_alerts": cake_data,
    }


def _gather_staff_data(db: Session, current_user: User, target_date: date) -> dict:
    """Gather data for flavor expert (staff) daily brief."""
    branch_id = current_user.branch_id
    if not branch_id:
        return {}

    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    branch_name = branch.name if branch else "My Branch"

    # Budget vs Actual
    bud = db.query(DailyBudget).filter(
        and_(DailyBudget.branch_id == branch_id, DailyBudget.budget_date == target_date)
    ).first()
    sal_list = db.query(DailySales).filter(
        and_(DailySales.branch_id == branch_id, DailySales.date == target_date)
    ).all()

    budget_amt = bud.budget_amount if bud else 0
    actual_gross = sum(
        (getattr(s, 'gross_sales', 0) or 0) +
        (getattr(s, 'hd_gross_sales', 0) or 0) +
        (getattr(s, 'deliveroo_gross_sales', 0) or 0)
        for s in sal_list
    )
    remaining = budget_amt - actual_gross

    # Expiry requests pending
    pending_expiry = db.query(ExpiryRequestBranch).filter(
        and_(
            ExpiryRequestBranch.branch_id == branch_id,
            ExpiryRequestBranch.status == ExpiryBranchStatus.PENDING,
        )
    ).count()

    # Cake alerts
    cake_alerts = []
    try:
        from models.cake import CakeStock, CakeAlertConfig, CakeProduct
        stocks = db.query(CakeStock).filter(CakeStock.branch_id == branch_id).all()
        for stock in stocks:
            config = db.query(CakeAlertConfig).filter(
                and_(CakeAlertConfig.branch_id == branch_id,
                     CakeAlertConfig.cake_product_id == stock.cake_product_id)
            ).first()
            threshold = config.low_stock_threshold if config else 5
            if stock.current_quantity <= threshold:
                product = db.query(CakeProduct).filter(CakeProduct.id == stock.cake_product_id).first()
                cake_alerts.append({
                    "product": product.name if product else "Unknown",
                    "qty": stock.current_quantity,
                })
    except Exception:
        pass

    return {
        "branch_name": branch_name,
        "budget": budget_amt,
        "actual_sales": round(actual_gross),
        "achievement": round((actual_gross / budget_amt * 100), 1) if budget_amt > 0 else 0,
        "remaining": round(remaining),
        "sales_windows_submitted": len(sal_list),
        "pending_expiry_requests": pending_expiry,
        "cake_alerts": cake_alerts,
    }


async def _generate_brief_with_gemini(data: dict, role: str, user_name: str, target_date: str) -> str:
    """Send aggregated data to Gemini and get a natural language summary."""
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        if role == "staff":
            prompt = f"""You are an AI assistant for a food & beverage retail branch.
Generate a concise daily brief for a Flavor Expert (branch staff member) named {user_name}.
Date: {target_date}

Branch data:
{json.dumps(data, indent=2)}

Write a brief, friendly summary in 4-6 bullet points covering:
- Today's sales vs budget (if data available)
- How much more they need to hit target
- Pending expiry requests they need to respond to
- Low cake stock warnings
- A motivational note if they're doing well, or encouragement if behind

Keep each bullet to 1 short sentence. Use simple language. No markdown headers.
Start directly with the bullet points using • symbol.
If no sales data yet, mention to submit sales when the window opens."""
        else:
            role_label = "HQ Admin" if role == "supreme_admin" else "Territory Manager" if role == "super_admin" else "Area Manager"
            prompt = f"""You are an AI assistant for a food & beverage retail management system.
Generate a concise daily brief for {user_name} ({role_label}).
Date: {target_date}

Today's data:
{json.dumps(data, indent=2)}

Write a brief, actionable summary in 5-8 bullet points covering:
- Overall budget achievement across branches (which are doing well, which need attention)
- Branch visit compliance (who visited, who didn't)
- Pending expiry tracking responses
- Low cake stock alerts
- Top performer and weakest branch
- Any action items that need immediate attention

Keep each bullet to 1 short sentence. Be specific with names and numbers.
Use • symbol for bullets. No markdown headers. No greeting.
Start directly with the most important insight."""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt],
            config=types.GenerateContentConfig(temperature=0.3),
        )
        return response.text.strip()
    except Exception as e:
        logger.error(f"Gemini daily brief failed: {e}")
        return None


@router.get("/daily-brief")
async def get_daily_brief(
    target_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate AI-powered daily brief based on user role."""
    today = target_date or _get_today()

    if current_user.role == UserRole.STAFF:
        data = _gather_staff_data(db, current_user, today)
    else:
        data = _gather_admin_data(db, current_user, today)

    if not data:
        return {
            "success": True,
            "date": str(today),
            "brief": "No data available for today's brief.",
            "data": {},
        }

    # Generate AI summary
    role_str = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    brief_text = await _generate_brief_with_gemini(
        data, role_str, current_user.full_name, str(today)
    )

    # Fallback if Gemini fails
    if not brief_text:
        if current_user.role == UserRole.STAFF:
            brief_text = f"• Today's sales: AED {data.get('actual_sales', 0):,} of AED {data.get('budget', 0):,} budget ({data.get('achievement', 0)}%)"
            if data.get('pending_expiry_requests', 0) > 0:
                brief_text += f"\n• You have {data['pending_expiry_requests']} pending expiry request(s) to respond to"
            if data.get('cake_alerts'):
                brief_text += f"\n• {len(data['cake_alerts'])} cake item(s) running low on stock"
        else:
            budget = data.get("budget", {})
            brief_text = f"• Overall achievement: {budget.get('overall_achievement', 0)}% (AED {budget.get('total_actual', 0):,} of AED {budget.get('total_budget', 0):,})"
            visits = data.get("visits", {})
            brief_text += f"\n• {visits.get('total_visits', 0)} branch visits logged today ({visits.get('total_hours', 0)} hours)"
            if visits.get('ams_no_visit'):
                brief_text += f"\n• No visits from: {', '.join(visits['ams_no_visit'][:3])}"
            expiry = data.get("expiry", {})
            if expiry.get('pending_branch_responses', 0) > 0:
                brief_text += f"\n• {expiry['pending_branch_responses']} expiry responses still pending"

    return {
        "success": True,
        "date": str(today),
        "brief": brief_text,
        "data": data,
    }
