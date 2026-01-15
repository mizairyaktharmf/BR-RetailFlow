"""
Inventory schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from models.inventory import InventoryEntryType


# Flavor Schemas
class FlavorBase(BaseModel):
    """Base flavor schema"""
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    category: Optional[str] = None
    standard_tub_size: float = 10.0


class FlavorCreate(FlavorBase):
    """Schema for creating a flavor"""
    pass


class FlavorUpdate(BaseModel):
    """Schema for updating a flavor"""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = Field(None, min_length=2, max_length=50)
    description: Optional[str] = None
    category: Optional[str] = None
    standard_tub_size: Optional[float] = None
    is_active: Optional[bool] = None


class FlavorResponse(FlavorBase):
    """Schema for flavor response"""
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Daily Inventory Schemas
class DailyInventoryBase(BaseModel):
    """Base daily inventory schema"""
    flavor_id: int
    entry_type: InventoryEntryType
    inches: float = Field(..., ge=0, le=100)  # 0 to 100 inches
    notes: Optional[str] = None


class DailyInventoryCreate(DailyInventoryBase):
    """Schema for creating a daily inventory entry"""
    branch_id: int
    date: date


class DailyInventoryResponse(DailyInventoryBase):
    """Schema for daily inventory response"""
    id: int
    branch_id: int
    date: date
    entered_by_id: int
    created_at: datetime
    flavor_name: Optional[str] = None
    entered_by_name: Optional[str] = None

    class Config:
        from_attributes = True


# Bulk inventory entry (for entering multiple flavors at once)
class InventoryItem(BaseModel):
    """Single inventory item for bulk entry"""
    flavor_id: int
    inches: float = Field(..., ge=0, le=100)
    notes: Optional[str] = None


class InventoryEntryBulk(BaseModel):
    """Schema for bulk inventory entry (opening or closing)"""
    branch_id: int
    date: date
    entry_type: InventoryEntryType
    items: List[InventoryItem]


# Tub Receipt Schemas
class TubReceiptBase(BaseModel):
    """Base tub receipt schema"""
    flavor_id: int
    quantity: int = Field(..., ge=1)
    inches_per_tub: float = 10.0
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class TubReceiptCreate(TubReceiptBase):
    """Schema for creating a tub receipt"""
    branch_id: int
    date: date


class TubReceiptResponse(TubReceiptBase):
    """Schema for tub receipt response"""
    id: int
    branch_id: int
    date: date
    recorded_by_id: int
    created_at: datetime
    total_inches: float
    flavor_name: Optional[str] = None
    recorded_by_name: Optional[str] = None

    class Config:
        from_attributes = True


# Bulk tub receipt entry
class TubReceiptItem(BaseModel):
    """Single tub receipt item for bulk entry"""
    flavor_id: int
    quantity: int = Field(..., ge=1)
    inches_per_tub: float = 10.0
    notes: Optional[str] = None


class TubReceiptBulk(BaseModel):
    """Schema for bulk tub receipt entry"""
    branch_id: int
    date: date
    reference_number: Optional[str] = None
    items: List[TubReceiptItem]


# Daily Summary (combines opening, closing, receipts)
class FlavorDailySummary(BaseModel):
    """Daily summary for a single flavor"""
    flavor_id: int
    flavor_name: str
    opening_inches: float
    received_inches: float
    closing_inches: float
    consumed_inches: float  # Calculated: opening + received - closing


class DailySummary(BaseModel):
    """Complete daily summary for a branch"""
    branch_id: int
    branch_name: str
    date: date
    flavors: List[FlavorDailySummary]
    total_consumed: float
    entry_complete: bool  # True if both opening and closing are entered
