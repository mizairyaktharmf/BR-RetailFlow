"""
Push Notification router
Handles Web Push subscription registration and VAPID public key endpoint
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel
from typing import Optional

from utils.database import get_db
from utils.security import get_current_user
from utils.config import settings
from models.user import User
from models.notification import PushSubscription

router = APIRouter()


# ---- Schemas ----

class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str

class PushSubscriptionData(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys

class SubscribeRequest(BaseModel):
    subscription: PushSubscriptionData

class UnsubscribeRequest(BaseModel):
    endpoint: str


# ---- Endpoints ----

@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """
    Returns the VAPID public key so the browser can subscribe to push.
    This is called by the frontend before requesting notification permission.
    No auth required — the key is public.
    """
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=503, detail="Push notifications not configured")
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe")
async def subscribe_push(
    data: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Register a browser push subscription for the current user's branch.
    Called after the user grants notification permission.
    If the endpoint already exists, update it (device re-subscribed).
    """
    sub = data.subscription

    # Check if this endpoint already exists
    existing = db.query(PushSubscription).filter(
        PushSubscription.endpoint == sub.endpoint
    ).first()

    if existing:
        # Update existing subscription (keys may have changed)
        existing.p256dh_key = sub.keys.p256dh
        existing.auth_key = sub.keys.auth
        existing.branch_id = current_user.branch_id
        existing.user_id = current_user.id
        existing.is_active = True
        db.commit()
        return {"status": "updated", "message": "Push subscription updated"}

    # Create new subscription
    new_sub = PushSubscription(
        branch_id=current_user.branch_id,
        user_id=current_user.id,
        endpoint=sub.endpoint,
        p256dh_key=sub.keys.p256dh,
        auth_key=sub.keys.auth,
        is_active=True,
    )
    db.add(new_sub)
    db.commit()

    return {"status": "subscribed", "message": "Push subscription registered"}


@router.post("/unsubscribe")
async def unsubscribe_push(
    data: UnsubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Remove a push subscription (user logged out or revoked permission).
    """
    sub = db.query(PushSubscription).filter(
        PushSubscription.endpoint == data.endpoint
    ).first()

    if sub:
        sub.is_active = False
        db.commit()

    return {"status": "unsubscribed"}
