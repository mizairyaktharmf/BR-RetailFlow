"""
Expiry Tracking router
Area Managers create expiry check requests, branches respond with expiry data
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import List
from datetime import datetime

from utils.database import get_db
from utils.security import get_current_user, require_role
from models.user import User, UserRole
from models.location import Branch
from models.expiry import (
    ExpiryRequest, ExpiryRequestItem, ExpiryRequestBranch,
    ExpiryResponse, ExpiryRequestStatus, ExpiryBranchStatus,
)
from schemas.expiry import (
    ExpiryRequestCreate, ExpiryRequestUpdate,
    ExpiryResponseBulk,
    ExpiryRequestListResponse, ExpiryRequestDetailResponse,
)
from services.push_service import send_push_to_branch

router = APIRouter()


# ============== HELPER ==============

def get_admin_branch_ids(db: Session, user: User) -> List[int]:
    """Get branch IDs the admin has access to"""
    query = db.query(Branch.id).filter(Branch.is_active == True)
    if user.role == UserRole.ADMIN:
        query = query.filter(Branch.manager_id == user.id)
    elif user.role == UserRole.SUPER_ADMIN:
        from models.location import Area
        area_ids = [a.id for a in db.query(Area.id).filter(Area.territory_id == user.territory_id).all()]
        query = query.filter(Branch.area_id.in_(area_ids))
    # SUPREME_ADMIN sees all
    return [r[0] for r in query.all()]


# ============== ADMIN ENDPOINTS ==============

@router.post("/requests", status_code=status.HTTP_201_CREATED)
async def create_expiry_request(
    data: ExpiryRequestCreate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Create a new expiry tracking request and notify assigned branches"""
    # Verify admin has access to these branches
    allowed_ids = get_admin_branch_ids(db, current_user)
    for bid in data.branch_ids:
        if bid not in allowed_ids:
            raise HTTPException(status_code=403, detail=f"No access to branch {bid}")

    # Create request
    req = ExpiryRequest(
        title=data.title,
        notes=data.notes,
        created_by_id=current_user.id,
    )
    db.add(req)
    db.flush()

    # Add items (support both string and object format)
    for i, item_data in enumerate(data.items):
        if isinstance(item_data, str):
            product_name = item_data.strip()
            expiry_date = None
        else:
            product_name = item_data.product_name.strip()
            expiry_date = item_data.expiry_date
        item = ExpiryRequestItem(
            expiry_request_id=req.id,
            product_name=product_name,
            expiry_date=expiry_date,
            sort_order=i,
        )
        db.add(item)

    # Add branches
    for bid in data.branch_ids:
        branch_assign = ExpiryRequestBranch(
            expiry_request_id=req.id,
            branch_id=bid,
        )
        db.add(branch_assign)

    db.commit()
    db.refresh(req)

    # Send push notification to each assigned branch
    for bid in data.branch_ids:
        try:
            send_push_to_branch(
                db, bid,
                title="Expiry Check Request",
                body=f"{data.title} - {len(data.items)} items to check",
                url="/expiry",
            )
        except Exception:
            pass  # Don't fail if push fails

    return {"id": req.id, "message": "Expiry request created and branches notified"}


@router.get("/requests")
async def list_expiry_requests(
    status_filter: str = None,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """List all expiry requests created by or visible to this admin"""
    query = db.query(ExpiryRequest).options(
        joinedload(ExpiryRequest.created_by),
        joinedload(ExpiryRequest.items),
        joinedload(ExpiryRequest.branches),
    )

    # Filter by role scope
    if current_user.role == UserRole.ADMIN:
        query = query.filter(ExpiryRequest.created_by_id == current_user.id)
    elif current_user.role == UserRole.SUPER_ADMIN:
        # Show requests from admins in same territory
        from models.location import Area
        territory_user_ids = [u.id for u in db.query(User.id).filter(User.territory_id == current_user.territory_id).all()]
        query = query.filter(ExpiryRequest.created_by_id.in_(territory_user_ids))

    if status_filter:
        query = query.filter(ExpiryRequest.status == status_filter)

    requests = query.order_by(ExpiryRequest.created_at.desc()).all()

    result = []
    for req in requests:
        responded = sum(1 for b in req.branches if b.status != ExpiryBranchStatus.PENDING)
        result.append({
            "id": req.id,
            "title": req.title,
            "notes": req.notes,
            "status": req.status.value if req.status else "open",
            "created_by_name": req.created_by.full_name if req.created_by else "Unknown",
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "item_count": len(req.items),
            "branch_count": len(req.branches),
            "responded_count": responded,
        })

    return result


@router.get("/requests/{request_id}")
async def get_expiry_request_detail(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get detailed view of an expiry request with all responses (column view)"""
    req = db.query(ExpiryRequest).options(
        joinedload(ExpiryRequest.created_by),
        joinedload(ExpiryRequest.items),
        joinedload(ExpiryRequest.branches).joinedload(ExpiryRequestBranch.branch),
        joinedload(ExpiryRequest.responses).joinedload(ExpiryResponse.submitted_by),
    ).filter(ExpiryRequest.id == request_id).first()

    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # Build items list
    items = [{"id": item.id, "product_name": item.product_name, "expiry_date": item.expiry_date.isoformat() if item.expiry_date else None, "sort_order": item.sort_order} for item in req.items]

    # Build branches list
    branches = []
    for rb in req.branches:
        branches.append({
            "branch_id": rb.branch_id,
            "branch_name": rb.branch.name if rb.branch else f"Branch {rb.branch_id}",
            "status": rb.status.value if rb.status else "pending",
            "submitted_at": rb.submitted_at.isoformat() if rb.submitted_at else None,
        })

    # Build responses matrix: { "branch_id": { "item_id": response_data } }
    responses = {}
    for resp in req.responses:
        bid_key = str(resp.branch_id)
        iid_key = str(resp.expiry_request_item_id)
        if bid_key not in responses:
            responses[bid_key] = {}
        responses[bid_key][iid_key] = {
            "id": resp.id,
            "quantity": resp.quantity,
            "expiry_date": resp.expiry_date.isoformat() if resp.expiry_date else None,
            "notes": resp.notes,
            "submitted_by_name": resp.submitted_by.full_name if resp.submitted_by else None,
            "updated_at": resp.updated_at.isoformat() if resp.updated_at else None,
        }

    return {
        "id": req.id,
        "title": req.title,
        "notes": req.notes,
        "status": req.status.value if req.status else "open",
        "created_by_name": req.created_by.full_name if req.created_by else "Unknown",
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "items": items,
        "branches": branches,
        "responses": responses,
    }


@router.put("/requests/{request_id}")
async def update_expiry_request(
    request_id: int,
    data: ExpiryRequestUpdate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Update an expiry request (title, notes, items, branches)"""
    req = db.query(ExpiryRequest).filter(ExpiryRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.created_by_id != current_user.id and current_user.role not in [UserRole.SUPREME_ADMIN]:
        raise HTTPException(status_code=403, detail="Only the creator can update this request")

    if data.title is not None:
        req.title = data.title
    if data.notes is not None:
        req.notes = data.notes

    # Update items if provided
    if data.items is not None:
        db.query(ExpiryRequestItem).filter(ExpiryRequestItem.expiry_request_id == request_id).delete()
        for i, item_data in enumerate(data.items):
            if isinstance(item_data, str):
                product_name = item_data.strip()
                expiry_date = None
            else:
                product_name = item_data.product_name.strip()
                expiry_date = item_data.expiry_date
            item = ExpiryRequestItem(
                expiry_request_id=request_id,
                product_name=product_name,
                expiry_date=expiry_date,
                sort_order=i,
            )
            db.add(item)

    # Update branches if provided
    if data.branch_ids is not None:
        allowed_ids = get_admin_branch_ids(db, current_user)
        for bid in data.branch_ids:
            if bid not in allowed_ids:
                raise HTTPException(status_code=403, detail=f"No access to branch {bid}")
        db.query(ExpiryRequestBranch).filter(ExpiryRequestBranch.expiry_request_id == request_id).delete()
        for bid in data.branch_ids:
            branch_assign = ExpiryRequestBranch(expiry_request_id=request_id, branch_id=bid)
            db.add(branch_assign)

    db.commit()
    return {"message": "Request updated"}


@router.post("/requests/{request_id}/close")
async def close_expiry_request(
    request_id: int,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Close an expiry request"""
    req = db.query(ExpiryRequest).filter(ExpiryRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.created_by_id != current_user.id and current_user.role not in [UserRole.SUPREME_ADMIN]:
        raise HTTPException(status_code=403, detail="Only the creator can close this request")

    req.status = ExpiryRequestStatus.CLOSED
    req.closed_at = datetime.utcnow()
    db.commit()
    return {"message": "Request closed"}


@router.delete("/requests/{request_id}")
async def delete_expiry_request(
    request_id: int,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    """Delete an expiry request"""
    req = db.query(ExpiryRequest).filter(ExpiryRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.created_by_id != current_user.id and current_user.role not in [UserRole.SUPREME_ADMIN]:
        raise HTTPException(status_code=403, detail="Only the creator can delete this request")

    db.delete(req)
    db.commit()
    return {"message": "Request deleted"}


# ============== BRANCH/STAFF ENDPOINTS ==============

@router.get("/branch-requests")
async def get_branch_expiry_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all open expiry requests assigned to the current user's branch"""
    if not current_user.branch_id:
        return []

    assigned = db.query(ExpiryRequestBranch).filter(
        ExpiryRequestBranch.branch_id == current_user.branch_id,
    ).all()

    request_ids = [a.expiry_request_id for a in assigned]
    if not request_ids:
        return []

    requests = db.query(ExpiryRequest).options(
        joinedload(ExpiryRequest.created_by),
        joinedload(ExpiryRequest.items),
    ).filter(
        ExpiryRequest.id.in_(request_ids),
        ExpiryRequest.status == ExpiryRequestStatus.OPEN,
    ).order_by(ExpiryRequest.created_at.desc()).all()

    # Get branch status for each request
    branch_statuses = {a.expiry_request_id: a.status.value for a in assigned}

    result = []
    for req in requests:
        result.append({
            "id": req.id,
            "title": req.title,
            "notes": req.notes,
            "created_by_name": req.created_by.full_name if req.created_by else "Unknown",
            "created_at": req.created_at.isoformat() if req.created_at else None,
            "item_count": len(req.items),
            "branch_status": branch_statuses.get(req.id, "pending"),
        })

    return result


@router.post("/responses")
async def submit_expiry_responses(
    data: ExpiryResponseBulk,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit or update expiry responses for a request"""
    if not current_user.branch_id:
        raise HTTPException(status_code=400, detail="User not assigned to a branch")

    # Verify branch is assigned to this request
    branch_assign = db.query(ExpiryRequestBranch).filter(
        and_(
            ExpiryRequestBranch.expiry_request_id == data.expiry_request_id,
            ExpiryRequestBranch.branch_id == current_user.branch_id,
        )
    ).first()

    if not branch_assign:
        raise HTTPException(status_code=403, detail="Branch not assigned to this request")

    # Check request is open
    req = db.query(ExpiryRequest).filter(ExpiryRequest.id == data.expiry_request_id).first()
    if not req or req.status == ExpiryRequestStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Request is closed")

    # Upsert responses
    for resp_data in data.responses:
        existing = db.query(ExpiryResponse).filter(
            and_(
                ExpiryResponse.expiry_request_item_id == resp_data.expiry_request_item_id,
                ExpiryResponse.branch_id == current_user.branch_id,
            )
        ).first()

        if existing:
            existing.quantity = resp_data.quantity
            existing.expiry_date = resp_data.expiry_date
            existing.notes = resp_data.notes
            existing.submitted_by_id = current_user.id
        else:
            new_resp = ExpiryResponse(
                expiry_request_id=data.expiry_request_id,
                expiry_request_item_id=resp_data.expiry_request_item_id,
                branch_id=current_user.branch_id,
                quantity=resp_data.quantity,
                expiry_date=resp_data.expiry_date,
                notes=resp_data.notes,
                submitted_by_id=current_user.id,
            )
            db.add(new_resp)

    # Update branch status
    is_update = branch_assign.status != ExpiryBranchStatus.PENDING
    branch_assign.status = ExpiryBranchStatus.UPDATED if is_update else ExpiryBranchStatus.SUBMITTED
    branch_assign.submitted_at = branch_assign.submitted_at or datetime.utcnow()

    db.commit()
    return {"message": "Responses submitted successfully"}


@router.get("/responses/{request_id}")
async def get_branch_responses(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current user's branch responses for a specific request"""
    if not current_user.branch_id:
        return []

    responses = db.query(ExpiryResponse).filter(
        and_(
            ExpiryResponse.expiry_request_id == request_id,
            ExpiryResponse.branch_id == current_user.branch_id,
        )
    ).all()

    return [{
        "expiry_request_item_id": r.expiry_request_item_id,
        "quantity": r.quantity,
        "expiry_date": r.expiry_date.isoformat() if r.expiry_date else None,
        "notes": r.notes,
    } for r in responses]
