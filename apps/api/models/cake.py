"""
Cake Inventory models: CakeProduct, CakeStock, CakeStockLog, CakeAlertConfig
Real-time cake inventory tracking with low-stock alerts
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from utils.database import Base


class CakeProduct(Base):
    """
    CakeProduct model - Master list of cake types
    Tracked in pieces (integer quantity)
    """
    __tablename__ = "cake_products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    default_alert_threshold = Column(Integer, default=2)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    stocks = relationship("CakeStock", back_populates="cake_product")
    stock_logs = relationship("CakeStockLog", back_populates="cake_product")
    alert_configs = relationship("CakeAlertConfig", back_populates="cake_product")

    def __repr__(self):
        return f"<CakeProduct {self.name}>"


class CakeStockChangeType(str, enum.Enum):
    SALE = "sale"
    RECEIVED = "received"
    ADJUSTMENT = "adjustment"
    WASTAGE = "wastage"
    INITIAL = "initial"


class CakeStock(Base):
    """
    CakeStock model - Live current stock per cake per branch
    Updated atomically with every sale/receipt
    """
    __tablename__ = "cake_stock"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    cake_product_id = Column(Integer, ForeignKey("cake_products.id"), nullable=False)
    current_quantity = Column(Integer, nullable=False, default=0)
    last_updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    last_updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('branch_id', 'cake_product_id', name='uq_cake_stock_branch_product'),
    )

    branch = relationship("Branch", back_populates="cake_stocks")
    cake_product = relationship("CakeProduct", back_populates="stocks")
    last_updated_by = relationship("User")

    def __repr__(self):
        return f"<CakeStock {self.branch_id} {self.cake_product_id} qty={self.current_quantity}>"


class CakeStockLog(Base):
    """
    CakeStockLog model - Immutable transaction log for every stock change
    """
    __tablename__ = "cake_stock_logs"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    cake_product_id = Column(Integer, ForeignKey("cake_products.id"), nullable=False)
    change_type = Column(Enum(CakeStockChangeType), nullable=False)
    quantity_change = Column(Integer, nullable=False)
    quantity_before = Column(Integer, nullable=False)
    quantity_after = Column(Integer, nullable=False)
    reference_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    branch = relationship("Branch", back_populates="cake_stock_logs")
    cake_product = relationship("CakeProduct", back_populates="stock_logs")
    recorded_by = relationship("User")

    def __repr__(self):
        return f"<CakeStockLog {self.change_type.value} {self.quantity_change}>"


class CakeAlertConfig(Base):
    """
    CakeAlertConfig model - Per-cake per-branch alert threshold
    """
    __tablename__ = "cake_alert_configs"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    cake_product_id = Column(Integer, ForeignKey("cake_products.id"), nullable=False)
    threshold = Column(Integer, nullable=False, default=2)
    is_enabled = Column(Boolean, default=True)
    configured_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint('branch_id', 'cake_product_id', name='uq_cake_alert_branch_product'),
    )

    branch = relationship("Branch", back_populates="cake_alert_configs")
    cake_product = relationship("CakeProduct", back_populates="alert_configs")
    configured_by = relationship("User")

    def __repr__(self):
        return f"<CakeAlertConfig {self.branch_id} {self.cake_product_id} threshold={self.threshold}>"
