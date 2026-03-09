"""
Web Push Notification Service using VAPID (no Firebase needed)
Uses pywebpush to send notifications directly to browser push endpoints.

Setup:
  1. pip install pywebpush
  2. Generate VAPID keys: python -c "from pywebpush import webpush; from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print('Private:', v.private_pem()); print('Public:', v.public_key)"
     OR use: vapid --gen
  3. Set VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_MAILTO in .env
"""

import json
import logging
from typing import List, Optional

from sqlalchemy.orm import Session
from pywebpush import webpush, WebPushException

from models.notification import PushSubscription
from utils.config import settings

logger = logging.getLogger(__name__)


def send_push_to_branch(
    db: Session,
    branch_id: int,
    title: str,
    body: str,
    url: str = "/cake/stock",
    exclude_user_id: Optional[int] = None,
):
    """
    Send web push notification to ALL subscribed devices of a branch.
    Optionally exclude the user who triggered the action (they already see the UI update).
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
            # 410 Gone or 404 = subscription expired, mark inactive
            if hasattr(e, "response") and e.response is not None:
                status = e.response.status_code
                if status in (404, 410):
                    stale_ids.append(sub.id)
                    logger.info(f"Push subscription {sub.id} expired (HTTP {status}), marking inactive")
                else:
                    logger.warning(f"Push failed for sub {sub.id}: HTTP {status} - {e}")
            else:
                logger.warning(f"Push failed for sub {sub.id}: {e}")
        except Exception as e:
            logger.error(f"Unexpected push error for sub {sub.id}: {e}")

    # Clean up expired subscriptions
    if stale_ids:
        db.query(PushSubscription).filter(PushSubscription.id.in_(stale_ids)).update(
            {"is_active": False}, synchronize_session=False
        )
        db.commit()

    logger.info(f"Sent {sent_count}/{len(subscriptions)} push notifications for branch {branch_id}")
    return sent_count


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
    Check if stock is at/below threshold and send push notification if so.
    Called after every sale operation.
    """
    if current_quantity > threshold:
        return  # stock is fine, no alert needed

    if current_quantity == 0:
        title = f"OUT OF STOCK: {cake_name}"
        body = f"{cake_name} ({cake_code}) is completely out of stock!"
    else:
        title = f"Low Stock: {cake_name}"
        body = f"{cake_name} ({cake_code}) — only {current_quantity} left (threshold: {threshold})"

    try:
        send_push_to_branch(
            db=db,
            branch_id=branch_id,
            title=title,
            body=body,
            url="/cake/stock",
            exclude_user_id=triggered_by_user_id,
        )
    except Exception as e:
        # Push notification failure should never break the sale flow
        logger.error(f"Failed to send low stock push notification: {e}")
