"""
Location models: Territory, Area, Branch
Represents the organizational hierarchy
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from utils.database import Base


class Territory(Base):
    """
    Territory model - Top level of hierarchy
    Managed by Super Admin (Territory Manager)
    """
    __tablename__ = "territories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)  # e.g., "DUBAI", "ABU-DHABI"
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    areas = relationship("Area", back_populates="territory", cascade="all, delete-orphan")
    managers = relationship("User", back_populates="territory")

    def __repr__(self):
        return f"<Territory {self.name}>"


class Area(Base):
    """
    Area model - Mid level of hierarchy
    Managed by Admin (Area Manager)
    Contains multiple branches
    """
    __tablename__ = "areas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)  # e.g., "DXB-KARAMA", "DXB-DEIRA"
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    # Foreign key to territory
    territory_id = Column(Integer, ForeignKey("territories.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    territory = relationship("Territory", back_populates="areas")
    branches = relationship("Branch", back_populates="area", cascade="all, delete-orphan")
    managers = relationship("User", back_populates="area")

    def __repr__(self):
        return f"<Area {self.name}>"


class Branch(Base):
    """
    Branch model - Lowest level of hierarchy
    Individual store location
    Flavor Experts belong to branches
    """
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)  # e.g., "BR-KARAMA-01"
    address = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)

    # Foreign key to area
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    area = relationship("Area", back_populates="branches")
    staff = relationship("User", back_populates="branch")
    daily_inventory = relationship("DailyInventory", back_populates="branch", cascade="all, delete-orphan")
    tub_receipts = relationship("TubReceipt", back_populates="branch", cascade="all, delete-orphan")
    cake_stocks = relationship("CakeStock", back_populates="branch", cascade="all, delete-orphan")
    cake_stock_logs = relationship("CakeStockLog", back_populates="branch", cascade="all, delete-orphan")
    cake_alert_configs = relationship("CakeAlertConfig", back_populates="branch", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Branch {self.name}>"
