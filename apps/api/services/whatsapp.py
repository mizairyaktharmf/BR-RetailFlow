"""
WhatsApp notification service
Sends alerts via the br-whatsapp Baileys service
"""

import httpx
import logging
from typing import Union

logger = logging.getLogger(__name__)

WA_SERVICE_URL = "http://br-whatsapp:3005"


async def _send(to: Union[str, list], message: str) -> bool:
    """Send WhatsApp message(s). Returns True if sent, False if failed."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{WA_SERVICE_URL}/send",
                json={"to": to, "message": message},
            )
            if resp.status_code == 200:
                return True
            logger.warning(f"WhatsApp send failed: {resp.status_code} {resp.text}")
            return False
    except Exception as e:
        logger.warning(f"WhatsApp service unreachable: {e}")
        return False


async def send_sales_summary(branch_name: str, window: str, data: dict, recipients: list[str]):
    """Send sales window summary after submission."""
    if not recipients:
        return
    net = data.get("total_sales") or data.get("net_sales") or 0
    gc = data.get("transaction_count") or 0
    atv = data.get("atv") or 0
    msg = (
        f"📊 *Sales Report — {branch_name}*\n"
        f"🕐 Window: {window.upper()}\n"
        f"──────────────────\n"
        f"💰 Net Sales: AED {net:,.2f}\n"
        f"👥 Guest Count: {gc}\n"
        f"🧾 ATV: AED {atv:,.2f}\n"
        f"──────────────────\n"
        f"✅ Submitted successfully"
    )
    await _send(recipients, msg)


async def send_budget_alert(branch_name: str, budget: float, actual: float, recipients: list[str]):
    """Send alert when branch is behind budget."""
    if not recipients:
        return
    pct = (actual / budget * 100) if budget > 0 else 0
    gap = budget - actual
    msg = (
        f"⚠️ *Budget Alert — {branch_name}*\n"
        f"──────────────────\n"
        f"🎯 Budget: AED {budget:,.2f}\n"
        f"💰 Actual: AED {actual:,.2f}\n"
        f"📉 Achievement: {pct:.1f}%\n"
        f"❌ Gap: AED {gap:,.2f}\n"
        f"──────────────────\n"
        f"Action needed to close the gap!"
    )
    await _send(recipients, msg)


async def send_low_stock_alert(branch_name: str, low_items: list[dict], recipients: list[str]):
    """Send alert for low inventory items."""
    if not recipients or not low_items:
        return
    items_text = "\n".join(
        f"  • {item['flavor']}: {item['qty']} tubs remaining"
        for item in low_items[:10]
    )
    msg = (
        f"🚨 *Low Stock Alert — {branch_name}*\n"
        f"──────────────────\n"
        f"{items_text}\n"
        f"──────────────────\n"
        f"⚡ Please arrange replenishment"
    )
    await _send(recipients, msg)


async def send_expiry_alert(branch_name: str, expiry_items: list[dict], recipients: list[str]):
    """Send morning alert for items expiring soon."""
    if not recipients or not expiry_items:
        return
    items_text = "\n".join(
        f"  • {item['flavor']}: expires {item['expiry_date']}"
        for item in expiry_items[:10]
    )
    msg = (
        f"⏰ *Expiry Alert — {branch_name}*\n"
        f"──────────────────\n"
        f"{items_text}\n"
        f"──────────────────\n"
        f"Please check and take action today"
    )
    await _send(recipients, msg)


async def send_daily_brief(branch_name: str, brief_text: str, recipients: list[str]):
    """Send end-of-day AI brief."""
    if not recipients:
        return
    msg = f"🌙 *Daily Brief — {branch_name}*\n──────────────────\n{brief_text}"
    await _send(recipients, msg)
