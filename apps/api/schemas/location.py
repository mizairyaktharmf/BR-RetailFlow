"""
Location schemas for request/response validation
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# Territory Schemas
class TerritoryBase(BaseModel):
    """Base territory schema"""
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None


class TerritoryCreate(TerritoryBase):
    """Schema for creating a territory"""
    pass


class TerritoryUpdate(BaseModel):
    """Schema for updating a territory"""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = Field(None, min_length=2, max_length=50)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class TerritoryResponse(TerritoryBase):
    """Schema for territory response"""
    id: int
    is_active: bool
    created_at: datetime
    areas_count: Optional[int] = None
    branches_count: Optional[int] = None
    users_count: Optional[int] = None

    class Config:
        from_attributes = True


# Area Schemas
class AreaBase(BaseModel):
    """Base area schema"""
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    territory_id: int


class AreaCreate(AreaBase):
    """Schema for creating an area"""
    pass


class AreaUpdate(BaseModel):
    """Schema for updating an area"""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = Field(None, min_length=2, max_length=50)
    description: Optional[str] = None
    territory_id: Optional[int] = None
    is_active: Optional[bool] = None


class AreaResponse(AreaBase):
    """Schema for area response"""
    id: int
    is_active: bool
    created_at: datetime
    territory_name: Optional[str] = None
    branches_count: Optional[int] = None
    users_count: Optional[int] = None

    class Config:
        from_attributes = True


# Branch Schemas
class BranchBase(BaseModel):
    """Base branch schema"""
    name: str = Field(..., min_length=2, max_length=255)
    code: str = Field(..., min_length=2, max_length=50)
    address: Optional[str] = None
    phone: Optional[str] = None
    territory_id: int
    area_id: Optional[int] = None  # Set when TM assigns to AM


class BranchCreate(BranchBase):
    """Schema for creating a branch"""
    pass


class BranchUpdate(BaseModel):
    """Schema for updating a branch"""
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    code: Optional[str] = Field(None, min_length=2, max_length=50)
    address: Optional[str] = None
    phone: Optional[str] = None
    territory_id: Optional[int] = None
    area_id: Optional[int] = None
    is_active: Optional[bool] = None


class BranchResponse(BranchBase):
    """Schema for branch response"""
    id: int
    is_active: bool
    created_at: datetime
    manager_id: Optional[int] = None
    area_name: Optional[str] = None
    territory_name: Optional[str] = None
    manager_name: Optional[str] = None
    staff_count: Optional[int] = None

    class Config:
        from_attributes = True


# Nested responses for detailed views
class AreaWithBranches(AreaResponse):
    """Area with nested branches"""
    branches: List[BranchResponse] = []


class TerritoryWithAreas(TerritoryResponse):
    """Territory with nested areas"""
    areas: List[AreaWithBranches] = []
