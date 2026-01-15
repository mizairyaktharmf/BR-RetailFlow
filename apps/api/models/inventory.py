"""
Inventory models: Flavor, DailyInventory, TubReceipt
Core models for tracking ice cream inventory
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Date, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from utils.database import Base


class Flavor(Base):
    """
    Flavor model - Master list of ice cream flavors
    Each flavor can be tracked across all branches
    """
    __tablename__ = "flavors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    code = Column(String(50), unique=True, nullable=False)  # e.g., "PRALINE", "CHOC-CHIP"
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)  # e.g., "Classic", "Seasonal", "Premium"
    is_active = Column(Boolean, default=True)

    # Standard tub size in inches
    standard_tub_size = Column(Float, default=10.0)  # 10 inches per full tub

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    daily_inventory = relationship("DailyInventory", back_populates="flavor")
    tub_receipts = relationship("TubReceipt", back_populates="flavor")

    def __repr__(self):
        return f"<Flavor {self.name}>"


class InventoryEntryType(str, enum.Enum):
    """Type of inventory entry"""
    OPENING = "opening"
    CLOSING = "closing"


class DailyInventory(Base):
    """
    Daily Inventory model
    Records opening and closing inventory for each flavor at each branch
    """
    __tablename__ = "daily_inventory"

    id = Column(Integer, primary_key=True, index=True)

    # Which branch and date
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)

    # Which flavor
    flavor_id = Column(Integer, ForeignKey("flavors.id"), nullable=False)

    # Entry type and measurement
    entry_type = Column(Enum(InventoryEntryType), nullable=False)
    inches = Column(Float, nullable=False)  # Measured in inches

    # Who entered this record
    entered_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Optional notes (e.g., wastage explanation)
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    branch = relationship("Branch", back_populates="daily_inventory")
    flavor = relationship("Flavor", back_populates="daily_inventory")
    entered_by = relationship("User")

    def __repr__(self):
        return f"<DailyInventory {self.branch_id} {self.date} {self.flavor_id} {self.entry_type.value}>"


class TubReceipt(Base):
    """
    Tub Receipt model
    Records when new tubs are received at a branch
    """
    __tablename__ = "tub_receipts"

    id = Column(Integer, primary_key=True, index=True)

    # Which branch and date
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)

    # Which flavor and quantity
    flavor_id = Column(Integer, ForeignKey("flavors.id"), nullable=False)
    quantity = Column(Integer, nullable=False)  # Number of tubs received
    inches_per_tub = Column(Float, default=10.0)  # Usually 10 inches per tub

    # Calculated total inches
    @property
    def total_inches(self):
        return self.quantity * self.inches_per_tub

    # Who recorded this receipt
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Optional reference number (delivery note, invoice, etc.)
    reference_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    branch = relationship("Branch", back_populates="tub_receipts")
    flavor = relationship("Flavor", back_populates="tub_receipts")
    recorded_by = relationship("User")

    def __repr__(self):
        return f"<TubReceipt {self.branch_id} {self.date} {self.flavor_id} x{self.quantity}>"
