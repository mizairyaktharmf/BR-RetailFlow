"""
Sales schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date


class DailySalesCreate(BaseModel):
    """Schema for creating a daily sales entry"""
    branch_id: int
    date: date
    sales_window: str  # 3pm, 7pm, 9pm, closing
    # POS
    total_sales: float = Field(default=0, ge=0)
    transaction_count: int = Field(default=0, ge=0)
    gross_sales: Optional[float] = 0
    cash_sales: Optional[float] = 0
    ly_sale: Optional[float] = 0
    cake_units: Optional[int] = 0
    hand_pack_units: Optional[int] = 0
    sundae_pct: Optional[float] = 0
    cups_cones_pct: Optional[float] = 0
    category_data: Optional[str] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None
    # Home Delivery (optional)
    hd_gross_sales: Optional[float] = 0
    hd_net_sales: Optional[float] = 0
    hd_orders: Optional[int] = 0
    hd_photo_url: Optional[str] = None
    # Deliveroo (optional)
    deliveroo_photo_url: Optional[str] = None


class DailySalesResponse(BaseModel):
    """Schema for daily sales response"""
    id: int
    branch_id: int
    date: date
    sales_window: str
    total_sales: float
    transaction_count: int
    gross_sales: Optional[float] = None
    cash_sales: Optional[float] = None
    ly_sale: Optional[float] = None
    cake_units: Optional[int] = None
    hand_pack_units: Optional[int] = None
    sundae_pct: Optional[float] = None
    cups_cones_pct: Optional[float] = None
    category_data: Optional[str] = None
    photo_url: Optional[str] = None
    notes: Optional[str] = None
    hd_gross_sales: Optional[float] = None
    hd_net_sales: Optional[float] = None
    hd_orders: Optional[int] = None
    hd_photo_url: Optional[str] = None
    deliveroo_photo_url: Optional[str] = None
    submitted_by_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PhotoUploadResponse(BaseModel):
    """Schema for photo upload response"""
    url: str
    filename: str
