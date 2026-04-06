"""
Customer Feedback model
Allows customers to submit ratings and feedback for a branch
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from utils.database import Base


class CustomerFeedback(Base):
    """
    CustomerFeedback - Public-facing feedback submitted by customers at a branch
    """
    __tablename__ = "customer_feedback"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    feedback_type = Column(String(20), nullable=False)  # compliment, complaint, suggestion
    message = Column(Text, nullable=True)
    customer_name = Column(String(100), nullable=True)
    customer_email = Column(String(200), nullable=True)
    customer_phone = Column(String(30), nullable=True)
    served_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    served_by_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    branch = relationship("Branch")

    def __repr__(self):
        return f"<CustomerFeedback branch={self.branch_id} rating={self.rating} type={self.feedback_type}>"
