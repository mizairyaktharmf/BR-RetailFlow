"""
Push Notification models: PushSubscription
Stores Web Push VAPID subscriptions per user/branch for cake low-stock alerts
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.sql import func

from utils.database import Base


class PushSubscription(Base):
    """
    Stores browser push subscription data.
    Each device/browser registers a unique endpoint + keys.
    Linked to branch so we can notify all staff of a branch at once.
    """
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Web Push subscription fields (from browser PushSubscription JSON)
    endpoint = Column(Text, nullable=False, unique=True)
    p256dh_key = Column(Text, nullable=False)    # encryption key
    auth_key = Column(Text, nullable=False)       # auth secret

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
