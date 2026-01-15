"""
Analytics router
Handles consumption reports, trending flavors, and insights
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
from typing import List, Optional
from datetime import date, timedelta
from pydantic import BaseModel

from utils.database import get_db
from utils.security import get_current_user, require_role
from models.user import User, UserRole
from models.location import Branch, Area, Territory
from models.inventory import DailyInventory, TubReceipt, Flavor, InventoryEntryType

router = APIRouter()


# Response schemas for analytics
class FlavorConsumption(BaseModel):
    """Flavor consumption data"""
    flavor_id: int
    flavor_name: str
    total_consumed: float
    avg_daily_consumed: float
    days_tracked: int


class BranchPerformance(BaseModel):
    """Branch performance metrics"""
    branch_id: int
    branch_name: str
    total_consumed: float
    top_flavor: str
    days_reported: int
    completion_rate: float  # Percentage of days with both opening and closing


class TrendingFlavor(BaseModel):
    """Trending flavor with movement data"""
    flavor_id: int
    flavor_name: str
    current_period_consumption: float
    previous_period_consumption: float
    change_percentage: float
    trend: str  # "up", "down", "stable"


class ConsumptionSummary(BaseModel):
    """Overall consumption summary"""
    total_consumption: float
    period_days: int
    branches_count: int
    flavors_tracked: int
    top_flavors: List[FlavorConsumption]
    bottom_flavors: List[FlavorConsumption]


@router.get("/consumption", response_model=List[FlavorConsumption])
async def get_consumption_by_flavor(
    date_from: date,
    date_to: date,
    branch_id: Optional[int] = None,
    area_id: Optional[int] = None,
    territory_id: Optional[int] = None,
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get consumption data grouped by flavor
    Results are filtered based on user's role
    """
    # Build base query for branches user can access
    branch_ids = get_accessible_branch_ids(current_user, db, branch_id, area_id, territory_id)

    if not branch_ids:
        return []

    # Calculate consumption for each flavor
    # Consumption = Sum of (Opening + Received - Closing) for each day
    results = []

    flavors = db.query(Flavor).filter(Flavor.is_active == True).all()

    days_in_period = (date_to - date_from).days + 1

    for flavor in flavors:
        # Get total opening
        total_opening = db.query(func.sum(DailyInventory.inches)).filter(
            and_(
                DailyInventory.branch_id.in_(branch_ids),
                DailyInventory.flavor_id == flavor.id,
                DailyInventory.date >= date_from,
                DailyInventory.date <= date_to,
                DailyInventory.entry_type == InventoryEntryType.OPENING
            )
        ).scalar() or 0

        # Get total closing
        total_closing = db.query(func.sum(DailyInventory.inches)).filter(
            and_(
                DailyInventory.branch_id.in_(branch_ids),
                DailyInventory.flavor_id == flavor.id,
                DailyInventory.date >= date_from,
                DailyInventory.date <= date_to,
                DailyInventory.entry_type == InventoryEntryType.CLOSING
            )
        ).scalar() or 0

        # Get total received
        total_received = db.query(
            func.sum(TubReceipt.quantity * TubReceipt.inches_per_tub)
        ).filter(
            and_(
                TubReceipt.branch_id.in_(branch_ids),
                TubReceipt.flavor_id == flavor.id,
                TubReceipt.date >= date_from,
                TubReceipt.date <= date_to
            )
        ).scalar() or 0

        total_consumed = total_opening + total_received - total_closing

        if total_consumed > 0:
            # Count days with data
            days_tracked = db.query(func.count(func.distinct(DailyInventory.date))).filter(
                and_(
                    DailyInventory.branch_id.in_(branch_ids),
                    DailyInventory.flavor_id == flavor.id,
                    DailyInventory.date >= date_from,
                    DailyInventory.date <= date_to
                )
            ).scalar() or 1

            results.append(FlavorConsumption(
                flavor_id=flavor.id,
                flavor_name=flavor.name,
                total_consumed=round(total_consumed, 2),
                avg_daily_consumed=round(total_consumed / max(days_tracked, 1), 2),
                days_tracked=days_tracked
            ))

    # Sort by total consumed descending
    results.sort(key=lambda x: x.total_consumed, reverse=True)
    return results[:limit]


@router.get("/trending", response_model=List[TrendingFlavor])
async def get_trending_flavors(
    period_days: int = Query(7, ge=1, le=90),
    branch_id: Optional[int] = None,
    area_id: Optional[int] = None,
    territory_id: Optional[int] = None,
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get trending flavors comparing current period vs previous period
    """
    today = date.today()
    current_start = today - timedelta(days=period_days - 1)
    previous_start = current_start - timedelta(days=period_days)
    previous_end = current_start - timedelta(days=1)

    branch_ids = get_accessible_branch_ids(current_user, db, branch_id, area_id, territory_id)

    if not branch_ids:
        return []

    results = []
    flavors = db.query(Flavor).filter(Flavor.is_active == True).all()

    for flavor in flavors:
        # Current period consumption
        current_consumption = calculate_consumption(
            db, branch_ids, flavor.id, current_start, today
        )

        # Previous period consumption
        previous_consumption = calculate_consumption(
            db, branch_ids, flavor.id, previous_start, previous_end
        )

        if current_consumption > 0 or previous_consumption > 0:
            if previous_consumption > 0:
                change_pct = ((current_consumption - previous_consumption) / previous_consumption) * 100
            else:
                change_pct = 100 if current_consumption > 0 else 0

            if change_pct > 10:
                trend = "up"
            elif change_pct < -10:
                trend = "down"
            else:
                trend = "stable"

            results.append(TrendingFlavor(
                flavor_id=flavor.id,
                flavor_name=flavor.name,
                current_period_consumption=round(current_consumption, 2),
                previous_period_consumption=round(previous_consumption, 2),
                change_percentage=round(change_pct, 1),
                trend=trend
            ))

    # Sort by change percentage
    results.sort(key=lambda x: x.change_percentage, reverse=True)
    return results[:limit]


@router.get("/branch-performance", response_model=List[BranchPerformance])
async def get_branch_performance(
    date_from: date,
    date_to: date,
    area_id: Optional[int] = None,
    territory_id: Optional[int] = None,
    current_user: User = Depends(require_role([
        UserRole.SUPREME_ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN
    ])),
    db: Session = Depends(get_db)
):
    """
    Get performance metrics for all branches
    Admin+ only
    """
    branch_ids = get_accessible_branch_ids(current_user, db, None, area_id, territory_id)

    if not branch_ids:
        return []

    days_in_period = (date_to - date_from).days + 1
    results = []

    for branch_id in branch_ids:
        branch = db.query(Branch).filter(Branch.id == branch_id).first()
        if not branch:
            continue

        # Calculate total consumption for branch
        total_consumption = 0
        flavor_consumption = {}

        flavors = db.query(Flavor).filter(Flavor.is_active == True).all()
        for flavor in flavors:
            consumption = calculate_consumption(db, [branch_id], flavor.id, date_from, date_to)
            if consumption > 0:
                flavor_consumption[flavor.name] = consumption
                total_consumption += consumption

        # Get top flavor
        top_flavor = max(flavor_consumption.items(), key=lambda x: x[1])[0] if flavor_consumption else "N/A"

        # Count days with both opening and closing
        complete_days = db.query(func.count(func.distinct(DailyInventory.date))).filter(
            and_(
                DailyInventory.branch_id == branch_id,
                DailyInventory.date >= date_from,
                DailyInventory.date <= date_to
            )
        ).scalar() or 0

        # Simplistic completion rate calculation
        completion_rate = (complete_days / days_in_period) * 100 if days_in_period > 0 else 0

        results.append(BranchPerformance(
            branch_id=branch_id,
            branch_name=branch.name,
            total_consumed=round(total_consumption, 2),
            top_flavor=top_flavor,
            days_reported=complete_days,
            completion_rate=round(completion_rate, 1)
        ))

    # Sort by total consumption
    results.sort(key=lambda x: x.total_consumed, reverse=True)
    return results


@router.get("/summary", response_model=ConsumptionSummary)
async def get_consumption_summary(
    date_from: date,
    date_to: date,
    branch_id: Optional[int] = None,
    area_id: Optional[int] = None,
    territory_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get overall consumption summary with top and bottom flavors
    """
    branch_ids = get_accessible_branch_ids(current_user, db, branch_id, area_id, territory_id)

    if not branch_ids:
        return ConsumptionSummary(
            total_consumption=0,
            period_days=0,
            branches_count=0,
            flavors_tracked=0,
            top_flavors=[],
            bottom_flavors=[]
        )

    # Get all consumption data
    all_consumption = await get_consumption_by_flavor(
        date_from=date_from,
        date_to=date_to,
        branch_id=branch_id,
        area_id=area_id,
        territory_id=territory_id,
        limit=100,
        current_user=current_user,
        db=db
    )

    total = sum(f.total_consumed for f in all_consumption)
    days = (date_to - date_from).days + 1

    return ConsumptionSummary(
        total_consumption=round(total, 2),
        period_days=days,
        branches_count=len(branch_ids),
        flavors_tracked=len(all_consumption),
        top_flavors=all_consumption[:5],
        bottom_flavors=all_consumption[-5:][::-1] if len(all_consumption) >= 5 else []
    )


# ============== HELPER FUNCTIONS ==============

def get_accessible_branch_ids(
    user: User,
    db: Session,
    branch_id: Optional[int] = None,
    area_id: Optional[int] = None,
    territory_id: Optional[int] = None
) -> List[int]:
    """
    Get list of branch IDs the user can access
    Applies role-based filtering
    """
    query = db.query(Branch.id)

    # Apply role-based filter
    if user.role == UserRole.STAFF:
        query = query.filter(Branch.id == user.branch_id)
    elif user.role == UserRole.ADMIN:
        query = query.filter(Branch.area_id == user.area_id)
    elif user.role == UserRole.SUPER_ADMIN:
        query = query.join(Area).filter(Area.territory_id == user.territory_id)
    # Supreme admin sees all

    # Apply additional filters
    if branch_id:
        query = query.filter(Branch.id == branch_id)
    if area_id:
        query = query.filter(Branch.area_id == area_id)
    if territory_id:
        query = query.join(Area).filter(Area.territory_id == territory_id)

    return [r[0] for r in query.all()]


def calculate_consumption(
    db: Session,
    branch_ids: List[int],
    flavor_id: int,
    date_from: date,
    date_to: date
) -> float:
    """
    Calculate total consumption for a flavor across branches and dates
    """
    total_opening = db.query(func.sum(DailyInventory.inches)).filter(
        and_(
            DailyInventory.branch_id.in_(branch_ids),
            DailyInventory.flavor_id == flavor_id,
            DailyInventory.date >= date_from,
            DailyInventory.date <= date_to,
            DailyInventory.entry_type == InventoryEntryType.OPENING
        )
    ).scalar() or 0

    total_closing = db.query(func.sum(DailyInventory.inches)).filter(
        and_(
            DailyInventory.branch_id.in_(branch_ids),
            DailyInventory.flavor_id == flavor_id,
            DailyInventory.date >= date_from,
            DailyInventory.date <= date_to,
            DailyInventory.entry_type == InventoryEntryType.CLOSING
        )
    ).scalar() or 0

    total_received = db.query(
        func.sum(TubReceipt.quantity * TubReceipt.inches_per_tub)
    ).filter(
        and_(
            TubReceipt.branch_id.in_(branch_ids),
            TubReceipt.flavor_id == flavor_id,
            TubReceipt.date >= date_from,
            TubReceipt.date <= date_to
        )
    ).scalar() or 0

    return max(0, total_opening + total_received - total_closing)
