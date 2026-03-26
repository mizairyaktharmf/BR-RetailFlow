"""
Branch Visit schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


class BranchVisitCreate(BaseModel):
    branch_id: int
    visit_date: date
    swipe_in: datetime
    swipe_out: Optional[datetime] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None


class BranchVisitUpdate(BaseModel):
    swipe_in: Optional[datetime] = None
    swipe_out: Optional[datetime] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None


class BranchVisitResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    branch_id: int
    branch_name: Optional[str] = None
    visit_date: date
    swipe_in: datetime
    swipe_out: Optional[datetime] = None
    hours_spent: Optional[float] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VisitDailySummary(BaseModel):
    user_id: int
    user_name: str
    visit_date: date
    total_hours: float
    visit_count: int
    branches: List[str]
