"""
Branch Visit model: Swipe In / Swipe Out tracking for Area Managers
Tracks AM branch visits with time, duration, and optional photo proof
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from utils.database import Base


class BranchVisit(Base):
    """
    BranchVisit - Tracks when an AM visits a branch (swipe in/out)
    """
    __tablename__ = "branch_visits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    visit_date = Column(Date, nullable=False, index=True)
    swipe_in = Column(DateTime(timezone=True), nullable=False)
    swipe_out = Column(DateTime(timezone=True), nullable=True)
    hours_spent = Column(Float, nullable=True)
    photo_url = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User")
    branch = relationship("Branch")

    def __repr__(self):
        return f"<BranchVisit user={self.user_id} branch={self.branch_id} date={self.visit_date}>"
