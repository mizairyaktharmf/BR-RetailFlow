"""
Sales models: DailySales, SalesSnapshot, CupUsage, Promotion
Models for tracking sales performance and promotions
"""

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Date, Text, Enum, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from utils.database import Base


class SalesWindowType(str, enum.Enum):
    """Sales reporting windows"""
    WINDOW_3PM = "3pm"      # 3:00 PM - 4:00 PM
    WINDOW_7PM = "7pm"      # 7:00 PM - 8:00 PM
    WINDOW_9PM = "9pm"      # 9:00 PM - 10:00 PM
    CLOSING = "closing"     # End of day


class DailySales(Base):
    """
    Daily Sales model
    Records sales data submitted at specific time windows
    """
    __tablename__ = "daily_sales"

    id = Column(Integer, primary_key=True, index=True)

    # Which branch and date
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)

    # Sales window (3pm, 7pm, 9pm, closing)
    sales_window = Column(Enum(SalesWindowType), nullable=False)

    # Sales figures
    gross_sales = Column(Float, nullable=True, default=0)  # Gross sales before discounts
    total_sales = Column(Float, nullable=False, default=0)  # Net sales amount in AED
    transaction_count = Column(Integer, nullable=False, default=0)  # Guest count
    cash_sales = Column(Float, nullable=True, default=0)  # Cash sales amount

    # Category sales data (JSON: [{name, qty, sales, pct}, ...])
    category_data = Column(Text, nullable=True)

    # Home Delivery data
    hd_gross_sales = Column(Float, nullable=True, default=0)
    hd_net_sales = Column(Float, nullable=True, default=0)
    hd_orders = Column(Integer, nullable=True, default=0)
    hd_photo_url = Column(Text, nullable=True)

    # Deliveroo data
    deliveroo_gross_sales = Column(Float, nullable=True, default=0)
    deliveroo_net_sales = Column(Float, nullable=True, default=0)
    deliveroo_orders = Column(Integer, nullable=True, default=0)
    deliveroo_photo_url = Column(Text, nullable=True)

    # Items breakdown (JSON: [{code, name, category, qty, sales, pct}, ...])
    items_data = Column(Text, nullable=True)

    # POS manual entry fields (kept for backward compat)
    ly_sale = Column(Float, nullable=True, default=0)
    cake_units = Column(Integer, nullable=True, default=0)
    hand_pack_units = Column(Integer, nullable=True, default=0)
    sundae_pct = Column(Float, nullable=True, default=0)
    cups_cones_pct = Column(Float, nullable=True, default=0)

    # Scoop counts by type (legacy, kept for backward compat)
    kids_scoop_count = Column(Integer, default=0)
    single_scoop_count = Column(Integer, default=0)
    double_scoop_count = Column(Integer, default=0)
    triple_scoop_count = Column(Integer, default=0)

    # Other products (legacy, kept for backward compat)
    sundae_count = Column(Integer, default=0)
    shake_count = Column(Integer, default=0)
    cake_count = Column(Integer, default=0)
    take_home_count = Column(Integer, default=0)

    # Photo proof (comma-separated URLs for multiple images)
    photo_url = Column(Text, nullable=True)

    # Who submitted
    submitted_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Notes
    notes = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    branch = relationship("Branch")
    submitted_by = relationship("User")

    def __repr__(self):
        return f"<DailySales {self.branch_id} {self.date} {self.sales_window.value}>"


class CupUsage(Base):
    """
    Cup Usage model
    Tracks cups used for promotions and regular sales
    """
    __tablename__ = "cup_usage"

    id = Column(Integer, primary_key=True, index=True)

    # Which branch and date
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)

    # Cup types and quantities
    cup_type = Column(String(50), nullable=False)  # e.g., "kids", "regular", "large", "promo"
    quantity_used = Column(Integer, nullable=False, default=0)
    quantity_received = Column(Integer, nullable=False, default=0)

    # Opening and closing stock
    opening_stock = Column(Integer, default=0)
    closing_stock = Column(Integer, default=0)

    # Who recorded
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    branch = relationship("Branch")
    recorded_by = relationship("User")

    def __repr__(self):
        return f"<CupUsage {self.branch_id} {self.date} {self.cup_type}>"


class Promotion(Base):
    """
    Promotion model
    Tracks active promotions and their usage
    """
    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)

    # Validity period
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    # Discount details
    discount_type = Column(String(20), nullable=False)  # "percentage" or "fixed"
    discount_value = Column(Float, nullable=False)

    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Promotion {self.name}>"


class PromotionUsage(Base):
    """
    Promotion Usage model
    Tracks how many times a promotion was used per branch per day
    """
    __tablename__ = "promotion_usage"

    id = Column(Integer, primary_key=True, index=True)

    # Which branch, date, and promotion
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    promotion_id = Column(Integer, ForeignKey("promotions.id"), nullable=False)

    # Usage count
    usage_count = Column(Integer, nullable=False, default=0)
    total_discount_given = Column(Float, nullable=False, default=0)

    # Who recorded
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    branch = relationship("Branch")
    promotion = relationship("Promotion")
    recorded_by = relationship("User")


class BranchBudget(Base):
    """
    Branch Budget model
    Monthly budget targets for each branch
    """
    __tablename__ = "branch_budgets"

    id = Column(Integer, primary_key=True, index=True)

    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)  # 1-12

    # Budget figures
    target_sales = Column(Float, nullable=False)  # Target sales in AED
    target_transactions = Column(Integer, nullable=True)

    # Last year comparison (stored for quick access)
    last_year_sales = Column(Float, nullable=True)
    last_year_transactions = Column(Integer, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    branch = relationship("Branch")

    def __repr__(self):
        return f"<BranchBudget {self.branch_id} {self.year}-{self.month}>"


class DailyBudget(Base):
    """
    Daily Budget model
    Per-day budget targets extracted from DAILY SALES TRACKER sheet photos
    """
    __tablename__ = "daily_budgets"

    id = Column(Integer, primary_key=True, index=True)

    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    budget_date = Column(Date, nullable=False, index=True)
    day_name = Column(String(3), nullable=True)  # Sun, Mon, Tue...

    # Days Sales
    ly_sales = Column(Float, nullable=True, default=0)  # 2025 actual
    budget_amount = Column(Float, nullable=False, default=0)  # 2026 target

    # Days Guest Count
    ly_gc = Column(Integer, nullable=True, default=0)  # 2025 guest count
    budget_gc = Column(Integer, nullable=True, default=0)  # Calculated target GC

    # MTD (Month-To-Date cumulative)
    mtd_ly_sales = Column(Float, nullable=True, default=0)
    mtd_budget = Column(Float, nullable=True, default=0)

    # LY KPIs for reference
    ly_atv = Column(Float, nullable=True, default=0)  # LY ATV for that day

    # Day info (legacy compat)
    day_of_week = Column(String(10), nullable=True)
    notes = Column(Text, nullable=True)

    # Who uploaded
    set_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    branch = relationship("Branch")

    def __repr__(self):
        return f"<DailyBudget {self.branch_id} {self.budget_date}>"


class BudgetUpload(Base):
    """
    Budget Upload log
    Tracks each budget sheet photo upload with KPIs from sheet footer
    """
    __tablename__ = "budget_uploads"

    id = Column(Integer, primary_key=True, index=True)

    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    parlor_name = Column(String(100), nullable=True)
    month = Column(String(7), nullable=False)  # YYYY-MM
    area_manager = Column(String(100), nullable=True)
    days_count = Column(Integer, nullable=True)
    total_budget = Column(Float, nullable=True)
    total_ly_sales = Column(Float, nullable=True)
    total_ly_gc = Column(Integer, nullable=True)

    # KPIs from sheet footer
    ly_atv = Column(Float, nullable=True)
    ly_auv = Column(Float, nullable=True)
    ly_cake_qty = Column(Float, nullable=True)
    ly_hp_qty = Column(Float, nullable=True)

    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), nullable=True, default="confirmed")

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    branch = relationship("Branch")

    def __repr__(self):
        return f"<BudgetUpload {self.branch_id} {self.month}>"
