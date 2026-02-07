"""
Cake inventory schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models.cake import CakeStockChangeType


# ===== CakeProduct Schemas =====

class CakeProductBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    category: Optional[str] = None
    default_alert_threshold: int = Field(2, ge=0, le=100)


class CakeProductCreate(CakeProductBase):
    pass


class CakeProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = Field(None, min_length=2, max_length=50)
    description: Optional[str] = None
    category: Optional[str] = None
    default_alert_threshold: Optional[int] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None


class CakeProductResponse(CakeProductBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ===== CakeStock Schemas =====

class CakeStockResponse(BaseModel):
    id: int
    branch_id: int
    cake_product_id: int
    current_quantity: int
    last_updated_at: datetime
    cake_name: Optional[str] = None
    cake_code: Optional[str] = None
    category: Optional[str] = None
    alert_threshold: Optional[int] = None
    is_low_stock: Optional[bool] = None

    class Config:
        from_attributes = True


# ===== Stock Change Schemas =====

class CakeStockSaleItem(BaseModel):
    cake_product_id: int
    quantity: int = Field(..., ge=1, le=100)
    notes: Optional[str] = None


class CakeStockSaleBulk(BaseModel):
    branch_id: int
    items: List[CakeStockSaleItem]


class CakeStockReceiveItem(BaseModel):
    cake_product_id: int
    quantity: int = Field(..., ge=1, le=500)
    notes: Optional[str] = None


class CakeStockReceiveBulk(BaseModel):
    branch_id: int
    reference_number: Optional[str] = None
    items: List[CakeStockReceiveItem]


class CakeStockAdjustment(BaseModel):
    branch_id: int
    cake_product_id: int
    new_quantity: int = Field(..., ge=0, le=999)
    notes: Optional[str] = None


class CakeStockInitItem(BaseModel):
    cake_product_id: int
    quantity: int = Field(..., ge=0, le=999)


class CakeStockInitBulk(BaseModel):
    branch_id: int
    items: List[CakeStockInitItem]


# ===== CakeStockLog Schemas =====

class CakeStockLogResponse(BaseModel):
    id: int
    branch_id: int
    cake_product_id: int
    change_type: CakeStockChangeType
    quantity_change: int
    quantity_before: int
    quantity_after: int
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    recorded_by_id: int
    recorded_by_name: Optional[str] = None
    cake_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ===== CakeAlertConfig Schemas =====

class CakeAlertConfigItem(BaseModel):
    cake_product_id: int
    threshold: int = Field(..., ge=0, le=100)
    is_enabled: bool = True


class CakeAlertConfigCreate(BaseModel):
    branch_id: int
    cake_product_id: int
    threshold: int = Field(..., ge=0, le=100)
    is_enabled: bool = True


class CakeAlertConfigBulk(BaseModel):
    branch_id: int
    configs: List[CakeAlertConfigItem]


class CakeAlertConfigResponse(BaseModel):
    id: int
    branch_id: int
    cake_product_id: int
    threshold: int
    is_enabled: bool
    cake_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ===== Low Stock Alert Schemas =====

class LowStockAlert(BaseModel):
    cake_product_id: int
    cake_name: str
    cake_code: str
    branch_id: int
    branch_name: str
    current_quantity: int
    threshold: int
    severity: str  # "critical" (0 pcs) or "warning" (<=threshold)


class LowStockAlertList(BaseModel):
    alerts: List[LowStockAlert]
    total_count: int
    critical_count: int
    warning_count: int
