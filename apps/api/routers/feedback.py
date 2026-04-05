"""
Customer Feedback router
Public submission of ratings and feedback; admin read/stats endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional
import logging

from utils.database import get_db
from utils.security import get_current_user
from models.user import User, UserRole
from models.location import Branch
from models.feedback import CustomerFeedback

logger = logging.getLogger(__name__)
router = APIRouter()

VALID_FEEDBACK_TYPES = {"compliment", "complaint", "suggestion"}


# ============== PUBLIC ==============

@router.post("/submit")
async def submit_feedback(
    data: dict,
    db: Session = Depends(get_db),
):
    """Public endpoint — no auth required. Accepts customer feedback for a branch."""
    branch_id = data.get("branch_id")
    rating = data.get("rating")
    feedback_type = data.get("feedback_type")
    message = data.get("message")
    customer_name = data.get("customer_name")
    customer_email = data.get("customer_email")
    customer_phone = data.get("customer_phone")

    # Validate required fields
    if not branch_id:
        raise HTTPException(status_code=400, detail="branch_id is required")
    if rating is None:
        raise HTTPException(status_code=400, detail="rating is required")
    if not isinstance(rating, int) or not (1 <= rating <= 5):
        raise HTTPException(status_code=400, detail="rating must be an integer between 1 and 5")
    if not feedback_type:
        raise HTTPException(status_code=400, detail="feedback_type is required")
    if feedback_type not in VALID_FEEDBACK_TYPES:
        raise HTTPException(status_code=400, detail=f"feedback_type must be one of: {', '.join(VALID_FEEDBACK_TYPES)}")

    # Validate branch exists
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # Validate email format if provided
    if customer_email:
        import re
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', customer_email):
            raise HTTPException(status_code=400, detail="Invalid email format")

    feedback = CustomerFeedback(
        branch_id=branch_id,
        rating=rating,
        feedback_type=feedback_type,
        message=message,
        customer_name=customer_name,
        customer_email=customer_email.strip().lower() if customer_email else None,
        customer_phone=customer_phone.strip() if customer_phone else None,
    )
    db.add(feedback)
    db.commit()

    return {"success": True, "message": "Thank you for your feedback!"}


# ============== ADMIN READ ==============

@router.get("/")
async def list_feedback(
    branch_id: Optional[int] = Query(None),
    feedback_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List customer feedback with optional filters. Requires any authenticated user."""
    query = db.query(CustomerFeedback)

    # Role-based branch scoping
    if current_user.role == UserRole.ADMIN:
        # Area managers see only their own branches
        managed_branch_ids = [
            b.id for b in db.query(Branch).filter(Branch.manager_id == current_user.id).all()
        ]
        if branch_id and branch_id not in managed_branch_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view this branch's feedback")
        if branch_id:
            query = query.filter(CustomerFeedback.branch_id == branch_id)
        else:
            query = query.filter(CustomerFeedback.branch_id.in_(managed_branch_ids))
    elif current_user.role == UserRole.SUPER_ADMIN:
        territory_branch_ids = [
            b.id for b in db.query(Branch).filter(Branch.territory_id == current_user.territory_id).all()
        ]
        if branch_id and branch_id not in territory_branch_ids:
            raise HTTPException(status_code=403, detail="Not authorized to view this branch's feedback")
        if branch_id:
            query = query.filter(CustomerFeedback.branch_id == branch_id)
        else:
            query = query.filter(CustomerFeedback.branch_id.in_(territory_branch_ids))
    elif current_user.role == UserRole.SUPREME_ADMIN:
        if branch_id:
            query = query.filter(CustomerFeedback.branch_id == branch_id)
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    if feedback_type:
        if feedback_type not in VALID_FEEDBACK_TYPES:
            raise HTTPException(status_code=400, detail=f"feedback_type must be one of: {', '.join(VALID_FEEDBACK_TYPES)}")
        query = query.filter(CustomerFeedback.feedback_type == feedback_type)

    feedbacks = query.order_by(CustomerFeedback.created_at.desc()).limit(limit).all()

    # Build branch name lookup
    branch_ids = list({f.branch_id for f in feedbacks})
    branches = db.query(Branch).filter(Branch.id.in_(branch_ids)).all()
    branch_map = {b.id: b.name for b in branches}

    return [
        {
            "id": f.id,
            "branch_id": f.branch_id,
            "branch_name": branch_map.get(f.branch_id, f"Branch {f.branch_id}"),
            "rating": f.rating,
            "feedback_type": f.feedback_type,
            "message": f.message,
            "customer_name": f.customer_name,
            "customer_email": f.customer_email,
            "customer_phone": f.customer_phone,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in feedbacks
    ]


@router.get("/stats")
async def feedback_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Per-branch feedback statistics. Requires any authenticated user."""
    from datetime import datetime, timedelta

    seven_days_ago = (datetime.utcnow() - timedelta(days=7)).date()

    # Scope branches by role
    branch_query = db.query(Branch).filter(Branch.is_active == True)
    if current_user.role == UserRole.ADMIN:
        branch_query = branch_query.filter(Branch.manager_id == current_user.id)
    elif current_user.role == UserRole.SUPER_ADMIN:
        branch_query = branch_query.filter(Branch.territory_id == current_user.territory_id)
    elif current_user.role not in [UserRole.SUPREME_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    branches = branch_query.all()
    branch_ids = [b.id for b in branches]
    branch_map = {b.id: b.name for b in branches}

    if not branch_ids:
        return []

    # Aggregate stats per branch using case() for conditional counts
    rows = (
        db.query(
            CustomerFeedback.branch_id,
            func.count(CustomerFeedback.id).label("total"),
            func.avg(CustomerFeedback.rating).label("avg_rating"),
            func.sum(
                case((CustomerFeedback.feedback_type == "complaint", 1), else_=0)
            ).label("complaints"),
            func.sum(
                case((CustomerFeedback.feedback_type == "compliment", 1), else_=0)
            ).label("compliments"),
            func.sum(
                case((CustomerFeedback.feedback_type == "suggestion", 1), else_=0)
            ).label("suggestions"),
        )
        .filter(CustomerFeedback.branch_id.in_(branch_ids))
        .group_by(CustomerFeedback.branch_id)
        .all()
    )

    # Recent 7 days counts per branch
    recent_rows = (
        db.query(
            CustomerFeedback.branch_id,
            func.count(CustomerFeedback.id).label("recent_count"),
        )
        .filter(
            CustomerFeedback.branch_id.in_(branch_ids),
            func.date(CustomerFeedback.created_at) >= seven_days_ago,
        )
        .group_by(CustomerFeedback.branch_id)
        .all()
    )
    recent_map = {r.branch_id: r.recent_count for r in recent_rows}

    stats_map = {r.branch_id: r for r in rows}

    result = []
    for bid in branch_ids:
        r = stats_map.get(bid)
        result.append({
            "branch_id": bid,
            "branch_name": branch_map.get(bid, f"Branch {bid}"),
            "total": r.total if r else 0,
            "avg_rating": round(float(r.avg_rating), 2) if r and r.avg_rating else 0.0,
            "complaints": int(r.complaints or 0) if r else 0,
            "compliments": int(r.compliments or 0) if r else 0,
            "suggestions": int(r.suggestions or 0) if r else 0,
            "recent_7_days": recent_map.get(bid, 0),
        })

    return result
