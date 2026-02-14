"""
User model for authentication and authorization
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from utils.database import Base


class UserRole(str, enum.Enum):
    """User role enumeration"""
    SUPREME_ADMIN = "supreme_admin"  # Office/HQ - sees everything
    SUPER_ADMIN = "super_admin"      # Territory Manager
    ADMIN = "admin"                   # Area Manager
    STAFF = "staff"                   # Flavor Expert


class User(Base):
    """User model"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)

    # Role and permissions
    role = Column(Enum(UserRole), default=UserRole.STAFF, nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=False)

    # Email verification
    verification_code = Column(String(6), nullable=True)
    verification_code_expires = Column(DateTime(timezone=True), nullable=True)

    # Relationships - which entity this user manages/belongs to
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=True)
    territory_id = Column(Integer, ForeignKey("territories.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    branch = relationship("Branch", back_populates="staff")
    area = relationship("Area", back_populates="managers")
    territory = relationship("Territory", back_populates="managers")

    def __repr__(self):
        return f"<User {self.username} ({self.role.value})>"

    @property
    def can_view_all_territories(self):
        """Check if user can view all territories"""
        return self.role == UserRole.SUPREME_ADMIN

    @property
    def can_manage_users(self):
        """Check if user can manage other users"""
        return self.role in [UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADMIN]

    @property
    def can_enter_inventory(self):
        """Check if user can enter inventory data"""
        return self.role == UserRole.STAFF
