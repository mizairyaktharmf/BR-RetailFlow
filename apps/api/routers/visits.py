"""
Branch Visits router
Swipe In / Swipe Out tracking for Area Managers visiting branches
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func as sqlfunc
from typing import Optional
from datetime import date
import base64

from utils.database import get_db
from utils.security import get_current_user, require_role
from models.user import User, UserRole
from models.location import Branch
from models.branch_visit import BranchVisit
from schemas.branch_visit import BranchVisitCreate, BranchVisitUpdate

router = APIRouter()


# ============== CRUD ==============

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_visit(
    data: BranchVisitCreate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Create a new branch visit (swipe in)"""
    # Verify branch exists
    branch = db.query(Branch).filter(Branch.id == data.branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    # Calculate hours if swipe_out provided
    hours = None
    if data.swipe_out and data.swipe_in:
        hours = (data.swipe_out - data.swipe_in).total_seconds() / 3600
        if hours < 0:
            raise HTTPException(status_code=400, detail="Swipe out must be after swipe in")

    visit = BranchVisit(
        user_id=current_user.id,
        branch_id=data.branch_id,
        visit_date=data.visit_date,
        swipe_in=data.swipe_in,
        swipe_out=data.swipe_out,
        hours_spent=round(hours, 2) if hours else None,
        photo_url=data.photo_url,
        notes=data.notes,
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)

    return {
        "id": visit.id,
        "message": "Visit logged successfully",
        "hours_spent": visit.hours_spent,
    }


@router.put("/{visit_id}")
async def update_visit(
    visit_id: int,
    data: BranchVisitUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a visit (add swipe out, photo, notes)"""
    visit = db.query(BranchVisit).filter(BranchVisit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    if visit.user_id != current_user.id and current_user.role not in [UserRole.SUPREME_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    if data.swipe_in is not None:
        visit.swipe_in = data.swipe_in
    if data.swipe_out is not None:
        visit.swipe_out = data.swipe_out
    if data.photo_url is not None:
        visit.photo_url = data.photo_url
    if data.notes is not None:
        visit.notes = data.notes

    # Recalculate hours
    if visit.swipe_out and visit.swipe_in:
        hours = (visit.swipe_out - visit.swipe_in).total_seconds() / 3600
        visit.hours_spent = round(hours, 2) if hours >= 0 else None

    db.commit()
    return {"message": "Visit updated", "hours_spent": visit.hours_spent}


@router.get("/")
async def list_visits(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    user_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List visits with role-based filtering"""
    query = db.query(BranchVisit).options(
        joinedload(BranchVisit.user),
        joinedload(BranchVisit.branch),
    )

    # Role-based scoping
    if current_user.role == UserRole.ADMIN:
        query = query.filter(BranchVisit.user_id == current_user.id)
    elif current_user.role == UserRole.SUPER_ADMIN:
        query = query.join(User, BranchVisit.user_id == User.id).filter(
            User.territory_id == current_user.territory_id
        )
    elif current_user.role == UserRole.STAFF:
        return []

    # Filters
    if date_from:
        query = query.filter(BranchVisit.visit_date >= date_from)
    if date_to:
        query = query.filter(BranchVisit.visit_date <= date_to)
    if user_id and current_user.role != UserRole.ADMIN:
        query = query.filter(BranchVisit.user_id == user_id)
    if branch_id:
        query = query.filter(BranchVisit.branch_id == branch_id)

    visits = query.order_by(BranchVisit.visit_date.desc(), BranchVisit.swipe_in.desc()).all()

    return [{
        "id": v.id,
        "user_id": v.user_id,
        "user_name": v.user.full_name if v.user else "Unknown",
        "branch_id": v.branch_id,
        "branch_name": v.branch.name if v.branch else f"Branch {v.branch_id}",
        "visit_date": v.visit_date.isoformat(),
        "swipe_in": v.swipe_in.isoformat() if v.swipe_in else None,
        "swipe_out": v.swipe_out.isoformat() if v.swipe_out else None,
        "hours_spent": v.hours_spent,
        "photo_url": v.photo_url,
        "notes": v.notes,
        "created_at": v.created_at.isoformat() if v.created_at else None,
    } for v in visits]


@router.delete("/{visit_id}")
async def delete_visit(
    visit_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a visit"""
    visit = db.query(BranchVisit).filter(BranchVisit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    if visit.user_id != current_user.id and current_user.role not in [UserRole.SUPREME_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(visit)
    db.commit()
    return {"message": "Visit deleted"}


@router.get("/summary")
async def visit_summary(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Daily summary: total hours per AM per day"""
    query = db.query(BranchVisit).options(
        joinedload(BranchVisit.user),
        joinedload(BranchVisit.branch),
    )

    # Role-based scoping
    if current_user.role == UserRole.ADMIN:
        query = query.filter(BranchVisit.user_id == current_user.id)
    elif current_user.role == UserRole.SUPER_ADMIN:
        query = query.join(User, BranchVisit.user_id == User.id).filter(
            User.territory_id == current_user.territory_id
        )

    if date_from:
        query = query.filter(BranchVisit.visit_date >= date_from)
    if date_to:
        query = query.filter(BranchVisit.visit_date <= date_to)

    visits = query.order_by(BranchVisit.visit_date.desc()).all()

    # Group by user + date
    summary = {}
    for v in visits:
        key = f"{v.user_id}_{v.visit_date}"
        if key not in summary:
            summary[key] = {
                "user_id": v.user_id,
                "user_name": v.user.full_name if v.user else "Unknown",
                "visit_date": v.visit_date.isoformat(),
                "total_hours": 0,
                "visit_count": 0,
                "branches": [],
            }
        summary[key]["total_hours"] += (v.hours_spent or 0)
        summary[key]["visit_count"] += 1
        branch_name = v.branch.name if v.branch else f"Branch {v.branch_id}"
        if branch_name not in summary[key]["branches"]:
            summary[key]["branches"].append(branch_name)

    # Round hours
    for s in summary.values():
        s["total_hours"] = round(s["total_hours"], 2)

    return list(summary.values())


@router.post("/extract-times")
async def extract_visit_times_from_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Extract swipe in/out times from a POS photo using Gemini Vision"""
    try:
        from services.gemini_vision import extract_visit_times
        image_bytes = await file.read()
        result = await extract_visit_times(image_bytes)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")
