"""
Sales schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


class CategorySales(BaseModel):
    """Schema for a single category in the sales breakdown"""
    name: str
    qty: int = 0
    sales: float = 0
    pct: float = 0


class DailySalesCreate(BaseModel):
    """Schema for creating a daily sales entry"""
    branch_id: int
    date: date
    sales_window: str  # 3pm, 7pm, 9pm, closing
    # POS fields (manual entry)
    total_sales: float = Field(..., ge=0)  # Net sales
    transaction_count: int = Field(default=0, ge=0)  # TY GC
    gross_sales: Optional[float] = 0
    cash_sales: Optional[float] = 0
    ly_sale: Optional[float] = 0  # Last Year Sale
    cake_units: Optional[int] = 0
    hand_pack_units: Optional[int] = 0
    sundae_pct: Optional[float] = 0  # Sundae %
    cups_cones_pct: Optional[float] = 0  # Cups & Cones %
    category_data: Optional[str] = None  # JSON string (legacy)
    photo_url: Optional[str] = None
    notes: Optional[str] = None
    # Home Delivery fields (optional)
    hd_gross_sales: Optional[float] = 0
    hd_net_sales: Optional[float] = 0
    hd_orders: Optional[int] = 0
    hd_photo_url: Optional[str] = None


class DailySalesResponse(BaseModel):
    """Schema for daily sales response"""
    id: int
    branch_id: int
    date: date
    sales_window: str
    # POS fields
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
    # Home Delivery fields
    hd_gross_sales: Optional[float] = None
    hd_net_sales: Optional[float] = None
    hd_orders: Optional[int] = None
    hd_photo_url: Optional[str] = None
    submitted_by_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SalesExtractionResponse(BaseModel):
    """Schema for photo extraction response (legacy, kept for API compat)"""
    branch_name: Optional[str] = None
    branch_match: bool = False
    gross_sales: Optional[str] = None
    net_sales: Optional[str] = None
    guest_count: Optional[str] = None
    cash_sales: Optional[str] = None
    categories: List[CategorySales] = []
    confidence: Optional[str] = "low"


class PhotoUploadResponse(BaseModel):
    """Schema for photo upload response"""
    url: str
    filename: str
