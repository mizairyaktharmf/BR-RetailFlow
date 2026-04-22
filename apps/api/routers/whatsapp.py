"""
WhatsApp router
QR status, send test message, manage alert recipients
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import httpx

from utils.database import get_db
from utils.security import get_current_user, require_role
from models.user import User, UserRole

router = APIRouter()

WA_SERVICE_URL = "http://br-whatsapp:3005"


class RecipientConfig(BaseModel):
    branch_id: int
    phone_numbers: list[str]
    alert_types: list[str]  # sales, budget, stock, expiry, daily_brief


class TestMessageRequest(BaseModel):
    phone: str
    message: Optional[str] = "✅ BR RetailFlow WhatsApp alerts are working!"


# ============ STATUS & QR ============

@router.get("/status")
async def get_whatsapp_status(
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN]))
):
    """Get WhatsApp connection status and QR code."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{WA_SERVICE_URL}/status")
            return resp.json()
    except Exception:
        return {"status": "service_unavailable", "connected": False, "qr": None}


@router.post("/logout")
async def logout_whatsapp(
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN]))
):
    """Disconnect WhatsApp session."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(f"{WA_SERVICE_URL}/logout")
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ TEST MESSAGE ============

@router.post("/test")
async def send_test_message(
    data: TestMessageRequest,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN]))
):
    """Send a test WhatsApp message to verify connection."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{WA_SERVICE_URL}/send",
                json={"to": data.phone, "message": data.message}
            )
            if resp.status_code == 200:
                return {"success": True, "message": "Test message sent!"}
            detail = resp.json().get("error", "Send failed")
            raise HTTPException(status_code=400, detail=detail)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"WhatsApp service unavailable: {e}")


# ============ RECIPIENT SETTINGS ============

@router.get("/recipients")
async def get_recipients(
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN])),
    db: Session = Depends(get_db)
):
    """Get all WhatsApp alert recipient configurations."""
    from models.whatsapp_config import WhatsAppConfig
    configs = db.query(WhatsAppConfig).all()
    return [
        {
            "id": c.id,
            "branch_id": c.branch_id,
            "branch_name": c.branch.name if c.branch else f"Branch {c.branch_id}",
            "phone_numbers": c.phone_numbers.split(",") if c.phone_numbers else [],
            "alert_types": c.alert_types.split(",") if c.alert_types else [],
        }
        for c in configs
    ]


@router.post("/recipients")
async def save_recipients(
    data: RecipientConfig,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN, UserRole.SUPER_ADMIN])),
    db: Session = Depends(get_db)
):
    """Save WhatsApp alert recipient config for a branch."""
    from models.whatsapp_config import WhatsAppConfig
    existing = db.query(WhatsAppConfig).filter(WhatsAppConfig.branch_id == data.branch_id).first()
    phones = ",".join([p.strip() for p in data.phone_numbers if p.strip()])
    alerts = ",".join(data.alert_types)

    if existing:
        existing.phone_numbers = phones
        existing.alert_types = alerts
    else:
        db.add(WhatsAppConfig(
            branch_id=data.branch_id,
            phone_numbers=phones,
            alert_types=alerts,
        ))
    db.commit()
    return {"success": True}
