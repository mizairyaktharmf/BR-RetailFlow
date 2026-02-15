"""
User schemas for request/response validation
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from models.user import UserRole


class UserBase(BaseModel):
    """Base user schema with common fields"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=100)
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = None


class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.STAFF
    branch_id: Optional[int] = None
    area_id: Optional[int] = None
    territory_id: Optional[int] = None


class UserUpdate(BaseModel):
    """Schema for updating a user"""
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[UserRole] = None
    branch_id: Optional[int] = None
    area_id: Optional[int] = None
    territory_id: Optional[int] = None


class UserResponse(UserBase):
    """Schema for user response"""
    id: int
    role: UserRole
    is_active: bool
    is_verified: bool
    is_approved: bool = False
    branch_id: Optional[int] = None
    area_id: Optional[int] = None
    territory_id: Optional[int] = None
    branch_name: Optional[str] = None
    area_name: Optional[str] = None
    territory_name: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    """Schema for user login"""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Schema for token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenRefresh(BaseModel):
    """Schema for token refresh"""
    refresh_token: str


class PasswordChange(BaseModel):
    """Schema for password change"""
    current_password: str
    new_password: str = Field(..., min_length=6)


class VerifyAccount(BaseModel):
    """Schema for account verification"""
    email: EmailStr
    verification_code: str = Field(..., min_length=6, max_length=6)


class ApprovalAction(BaseModel):
    """Schema for approving/rejecting a user"""
    reason: Optional[str] = None
