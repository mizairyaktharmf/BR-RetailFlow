"""
Web Push Notification Service using VAPID (no Firebase needed)
Uses pywebpush to send notifications directly to browser push endpoints.
"""

import json
import logging
from typing import Optional

from sqlalchemy.orm import Session
from pywebpush import webpush, WebPushException

from models.notification import PushSubscription
from models.user import User, UserRole
from models.location import Branch
from utils.config import settings

logger = logging.getLogger(__name__)


def _send_to_subscriptions(db: Session, subscriptions: list, payload: str):
    """Send a push payload to a list of subscriptions. Cleans up stale ones."""
    sent_count = 0
    stale_ids = []

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh_key,
                        "auth": sub.auth_key,
                    },
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{settings.VAPID_MAILTO}"},
            )
            sent_count += 1
        except WebPushException as e:
            if hasattr(e, "response") and e.response is not None:
                status_code = e.response.status_code
                if status_code in (404, 410):
                    stale_ids.append(sub.id)
                    logger.info(f"Push subscription {sub.id} expired (HTTP {status_code}), marking inactive")
                else:
                    logger.warning(f"Push failed for sub {sub.id}: HTTP {status_code} - {e}")
            else:
                logger.warning(f"Push failed for sub {sub.id}: {e}")
        except Exception as e:
            logger.error(f"Unexpected push error for sub {sub.id}: {e}")

    if stale_ids:
        db.query(PushSubscription).filter(PushSubscription.id.in_(stale_ids)).update(
            {"is_active": False}, synchronize_session=False
        )
        db.commit()

    return sent_count


def send_push_to_branch(
    db: Session,
    branch_id: int,
    title: str,
    body: str,
    url: str = "/cake/stock",
    exclude_user_id: Optional[int] = None,
):
    """
    Send push notification to all subscribed devices of a branch (Flavor Experts).
    """
    query = db.query(PushSubscription).filter(
        PushSubscription.branch_id == branch_id,
        PushSubscription.is_active == True,
    )
    if exclude_user_id:
        query = query.filter(PushSubscription.user_id != exclude_user_id)

    subscriptions = query.all()

    if not subscriptions:
        logger.info(f"No push subscriptions for branch {branch_id}")
        return 0

    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/icons/cake-alert.png",
        "badge": "/icons/badge.png",
        "url": url,
        "timestamp": int(__import__("time").time() * 1000),
    })

    sent = _send_to_subscriptions(db, subscriptions, payload)
    logger.info(f"Sent {sent}/{len(subscriptions)} push notifications for branch {branch_id}")
    return sent


def send_push_to_managers(
    db: Session,
    branch_id: int,
    title: str,
    body: str,
    url: str = "/dashboard/cake-alerts",
):
    """
    Send push notification to all managers responsible for this branch:
    - Area manager whose area contains this branch
    - Territory manager whose territory contains this area
    - All supreme admins (HQ)
    Managers subscribe with branch_id=NULL so we find them by user_id.
    """
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        return 0

    # Collect user IDs of all managers in the chain
    manager_user_ids = set()

    # Area manager
    if branch.area_id:
        area_managers = db.query(User).filter(
            User.area_id == branch.area_id,
            User.role == UserRole.ADMIN,
            User.is_active == True,
        ).all()
        for u in area_managers:
            manager_user_ids.add(u.id)

    # Also check branch.manager_id directly
    if branch.manager_id:
        manager_user_ids.add(branch.manager_id)

    # Territory managers
    if branch.territory_id:
        territory_managers = db.query(User).filter(
            User.territory_id == branch.territory_id,
            User.role == UserRole.SUPER_ADMIN,
            User.is_active == True,
        ).all()
        for u in territory_managers:
            manager_user_ids.add(u.id)

    # Supreme admins (HQ) — always notify
    hq_admins = db.query(User).filter(
        User.role == UserRole.SUPREME_ADMIN,
        User.is_active == True,
    ).all()
    for u in hq_admins:
        manager_user_ids.add(u.id)

    if not manager_user_ids:
        return 0

    # Find push subscriptions for these managers (branch_id IS NULL = admin subscriptions)
    subscriptions = db.query(PushSubscription).filter(
        PushSubscription.user_id.in_(list(manager_user_ids)),
        PushSubscription.is_active == True,
    ).all()

    if not subscriptions:
        logger.info(f"No manager push subscriptions for branch {branch_id} managers")
        return 0

    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/icons/cake-alert.png",
        "badge": "/icons/badge.png",
        "url": url,
        "timestamp": int(__import__("time").time() * 1000),
    })

    sent = _send_to_subscriptions(db, subscriptions, payload)
    logger.info(f"Sent {sent}/{len(subscriptions)} manager push notifications for branch {branch_id}")
    return sent


def check_and_notify_low_stock(
    db: Session,
    branch_id: int,
    cake_name: str,
    cake_code: str,
    current_quantity: int,
    threshold: int,
    triggered_by_user_id: Optional[int] = None,
):
    """
    Check if stock is at/below threshold and send push notifications:
    - Branch staff (Flavor Experts)
    - All managers in the chain (Area Manager, Territory Manager, HQ)
    Called after every sale or stock adjustment.
    """
    if current_quantity > threshold:
        return

    # Get branch name for context
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    branch_name = branch.name if branch else f"Branch {branch_id}"

    if current_quantity == 0:
        title = f"OUT OF STOCK: {cake_name}"
        body = f"{branch_name} — {cake_name} ({cake_code}) is completely out of stock!"
    else:
        title = f"⚠️ Low Stock: {cake_name}"
        body = f"{branch_name} — {cake_name} ({cake_code}): only {current_quantity} left (min: {threshold})"

    try:
        # Notify branch staff (Flavor Experts at this branch)
        send_push_to_branch(
            db=db,
            branch_id=branch_id,
            title=title,
            body=body,
            url="/cake/stock",
            exclude_user_id=triggered_by_user_id,
        )
    except Exception as e:
        logger.error(f"Failed to send branch low stock push: {e}")

    try:
        # Notify managers (Area Manager, Territory Manager, HQ)
        send_push_to_managers(
            db=db,
            branch_id=branch_id,
            title=title,
            body=body,
            url="/dashboard/cake-alerts",
        )
    except Exception as e:
        logger.error(f"Failed to send manager low stock push: {e}")
