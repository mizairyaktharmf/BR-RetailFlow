"""
Expiry Tracking models: ExpiryRequest, ExpiryRequestItem, ExpiryRequestBranch, ExpiryResponse
Area Managers create expiry check requests, branches respond with expiry data
"""

from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Date, ForeignKey, Text, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from utils.database import Base


class ExpiryRequestStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class ExpiryBranchStatus(str, enum.Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    UPDATED = "updated"


class ExpiryRequest(Base):
    """
    ExpiryRequest - Created by Area Manager/Admin to request expiry checks from branches
    """
    __tablename__ = "expiry_requests"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(Enum(ExpiryRequestStatus), default=ExpiryRequestStatus.OPEN, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    template_file_data = Column(Text, nullable=True)      # base64 encoded Excel file
    template_filename = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id])
    items = relationship("ExpiryRequestItem", back_populates="expiry_request", cascade="all, delete-orphan", order_by="ExpiryRequestItem.sort_order")
    branches = relationship("ExpiryRequestBranch", back_populates="expiry_request", cascade="all, delete-orphan")
    responses = relationship("ExpiryResponse", back_populates="expiry_request", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ExpiryRequest {self.title}>"


class ExpiryRequestItem(Base):
    """
    ExpiryRequestItem - Product names the admin wants branches to check
    """
    __tablename__ = "expiry_request_items"

    id = Column(Integer, primary_key=True, index=True)
    expiry_request_id = Column(Integer, ForeignKey("expiry_requests.id", ondelete="CASCADE"), nullable=False)
    product_name = Column(String(255), nullable=False)
    expiry_date = Column(Date, nullable=True)  # Manager can set expected expiry date
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    expiry_request = relationship("ExpiryRequest", back_populates="items")
    responses = relationship("ExpiryResponse", back_populates="item", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('expiry_request_id', 'product_name', name='uq_expiry_request_item'),
    )

    def __repr__(self):
        return f"<ExpiryRequestItem {self.product_name}>"


class ExpiryRequestBranch(Base):
    """
    ExpiryRequestBranch - Which branches are assigned to a request
    """
    __tablename__ = "expiry_request_branches"

    id = Column(Integer, primary_key=True, index=True)
    expiry_request_id = Column(Integer, ForeignKey("expiry_requests.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    status = Column(Enum(ExpiryBranchStatus), default=ExpiryBranchStatus.PENDING, nullable=False)

    submitted_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    expiry_request = relationship("ExpiryRequest", back_populates="branches")
    branch = relationship("Branch")

    __table_args__ = (
        UniqueConstraint('expiry_request_id', 'branch_id', name='uq_expiry_request_branch'),
    )

    def __repr__(self):
        return f"<ExpiryRequestBranch request={self.expiry_request_id} branch={self.branch_id}>"


class ExpiryResponse(Base):
    """
    ExpiryResponse - Branch staff's response for each item
    """
    __tablename__ = "expiry_responses"

    id = Column(Integer, primary_key=True, index=True)
    expiry_request_id = Column(Integer, ForeignKey("expiry_requests.id", ondelete="CASCADE"), nullable=False)
    expiry_request_item_id = Column(Integer, ForeignKey("expiry_request_items.id", ondelete="CASCADE"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    quantity = Column(Float, nullable=True)
    expiry_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    submitted_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    expiry_request = relationship("ExpiryRequest", back_populates="responses")
    item = relationship("ExpiryRequestItem", back_populates="responses")
    branch = relationship("Branch")
    submitted_by = relationship("User", foreign_keys=[submitted_by_id])

    __table_args__ = (
        UniqueConstraint('expiry_request_item_id', 'branch_id', name='uq_expiry_response_item_branch'),
    )

    def __repr__(self):
        return f"<ExpiryResponse item={self.expiry_request_item_id} branch={self.branch_id}>"
