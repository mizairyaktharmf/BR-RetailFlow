"""
Expiry tracking schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, date


# ===== Create Request =====

class ExpiryItemInput(BaseModel):
    product_name: str
    expiry_date: Optional[date] = None


class ExpiryRequestCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    notes: Optional[str] = None
    items: List[Union[ExpiryItemInput, str]] = Field(..., min_length=1)
    branch_ids: List[int] = Field(..., min_length=1)
    copy_from_id: Optional[int] = None  # Copy items from a previous request
    template_file_data: Optional[str] = None   # base64 encoded Excel file
    template_filename: Optional[str] = None


class ExpiryRequestUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    notes: Optional[str] = None
    items: Optional[List[Union[ExpiryItemInput, str]]] = None
    branch_ids: Optional[List[int]] = None


# ===== Response Submission =====

class ExpiryResponseItem(BaseModel):
    expiry_request_item_id: int
    quantity: Optional[float] = Field(None, ge=0)
    expiry_date: Optional[date] = None
    notes: Optional[str] = None


class ExpiryResponseBulk(BaseModel):
    expiry_request_id: int
    responses: List[ExpiryResponseItem]


# ===== API Response Models =====

class ExpiryRequestItemResponse(BaseModel):
    id: int
    product_name: str
    expiry_date: Optional[date] = None
    sort_order: int

    class Config:
        from_attributes = True


class ExpiryBranchResponse(BaseModel):
    branch_id: int
    branch_name: str
    status: str
    submitted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExpiryResponseData(BaseModel):
    id: int
    quantity: Optional[float] = None
    expiry_date: Optional[date] = None
    notes: Optional[str] = None
    submitted_by_name: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExpiryRequestListResponse(BaseModel):
    id: int
    title: str
    notes: Optional[str] = None
    status: str
    created_by_name: str
    created_at: datetime
    item_count: int
    branch_count: int
    responded_count: int

    class Config:
        from_attributes = True


class ExpiryRequestDetailResponse(BaseModel):
    id: int
    title: str
    notes: Optional[str] = None
    status: str
    created_by_name: str
    created_at: datetime
    items: List[ExpiryRequestItemResponse]
    branches: List[ExpiryBranchResponse]
    responses: Dict[str, Dict[str, Any]]  # { "branch_id": { "item_id": response_data } }

    class Config:
        from_attributes = True
