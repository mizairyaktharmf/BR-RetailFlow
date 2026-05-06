"""
Login Audit Log Viewer — SECRET TOKEN PROTECTED
Access: https://your-api.com/local/logs?secret=YOUR_LOG_SECRET
Set LOG_SECRET in your .env file.
"""

from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from utils.database import get_db
from utils.config import settings
from models.login_log import LoginLog

router = APIRouter()


def _check_secret(secret: str) -> bool:
    s = settings.LOG_SECRET.strip()
    if not s:
        return False  # No secret configured — deny all
    return secret == s


def _deny():
    return HTMLResponse("<h1>403 Forbidden</h1><p>Invalid or missing secret.</p>", status_code=403)


@router.get("/logs", response_class=HTMLResponse)
async def view_logs(
    request: Request,
    secret: str = Query(default=""),
    db: Session = Depends(get_db),
    limit: int = 200,
):
    if not _check_secret(secret):
        return _deny()

    logs = db.query(LoginLog).order_by(desc(LoginLog.timestamp)).limit(limit).all()

    rows = ""
    for log in logs:
        status_badge = (
            '<span style="background:#16a34a;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">✓ Success</span>'
            if log.success else
            f'<span style="background:#dc2626;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">✗ Failed</span>'
        )
        app_badge = (
            '<span style="background:#7c3aed;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">Admin</span>'
            if log.app == "admin_dashboard" else
            '<span style="background:#ea580c;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">Flavor Expert</span>'
        )
        ts = log.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC") if log.timestamp else "—"
        reason = f'<span style="color:#dc2626;font-size:11px">{log.failure_reason}</span>' if log.failure_reason else ""
        rows += f"""
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 12px;white-space:nowrap;color:#6b7280;font-size:12px">{ts}</td>
          <td style="padding:10px 12px">{app_badge}</td>
          <td style="padding:10px 12px;font-weight:500">{log.display_name or log.login_name}</td>
          <td style="padding:10px 12px;color:#6b7280;font-size:12px">{log.login_name}</td>
          <td style="padding:10px 12px;font-family:monospace;font-size:12px">{log.ip_address or "—"}</td>
          <td style="padding:10px 12px">{status_badge} {reason}</td>
          <td style="padding:10px 12px;color:#9ca3af;font-size:11px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{(log.user_agent or "")[:80]}</td>
        </tr>"""

    total = db.query(LoginLog).count()
    success = db.query(LoginLog).filter(LoginLog.success == True).count()
    failed = db.query(LoginLog).filter(LoginLog.success == False).count()
    admin_count = db.query(LoginLog).filter(LoginLog.app == "admin_dashboard").count()
    fe_count = db.query(LoginLog).filter(LoginLog.app == "flavor_expert").count()

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>BR-RetailFlow — Login Audit Logs</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;color:#111827}}
    .header{{background:#1e1b4b;color:#fff;padding:20px 32px;display:flex;align-items:center;gap:12px}}
    .header h1{{font-size:20px;font-weight:700}}
    .header p{{font-size:12px;color:#a5b4fc;margin-top:2px}}
    .badge-secret{{background:#fbbf24;color:#78350f;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;margin-left:auto}}
    .stats{{display:flex;gap:16px;padding:20px 32px;flex-wrap:wrap}}
    .stat{{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 20px;min-width:130px}}
    .stat .num{{font-size:28px;font-weight:700;line-height:1}}
    .stat .lbl{{font-size:11px;color:#6b7280;margin-top:4px}}
    .green{{color:#16a34a}}.red{{color:#dc2626}}.purple{{color:#7c3aed}}.orange{{color:#ea580c}}
    .container{{padding:0 32px 32px}}
    .card{{background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}}
    .card-header{{padding:14px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}}
    .card-header h2{{font-size:14px;font-weight:600}}
    .card-header span{{font-size:12px;color:#6b7280}}
    table{{width:100%;border-collapse:collapse}}
    th{{padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;background:#f9fafb;border-bottom:1px solid #e5e7eb}}
    tr:hover{{background:#f9fafb}}
    .refresh{{background:#4f46e5;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;cursor:pointer;text-decoration:none;display:inline-block}}
    .refresh:hover{{background:#4338ca}}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>🔒 BR-RetailFlow — Login Audit Logs</h1>
      <p>All login attempts across Admin Dashboard and Flavor Expert app</p>
    </div>
    <span class="badge-secret">🔑 SECRET PROTECTED</span>
  </div>

  <div class="stats">
    <div class="stat"><div class="num">{total}</div><div class="lbl">Total Attempts</div></div>
    <div class="stat"><div class="num green">{success}</div><div class="lbl">Successful</div></div>
    <div class="stat"><div class="num red">{failed}</div><div class="lbl">Failed</div></div>
    <div class="stat"><div class="num purple">{admin_count}</div><div class="lbl">Admin Logins</div></div>
    <div class="stat"><div class="num orange">{fe_count}</div><div class="lbl">Flavor Expert</div></div>
  </div>

  <div class="container">
    <div class="card">
      <div class="card-header">
        <h2>Login History (latest {limit})</h2>
        <a href="/local/logs?secret={secret}" class="refresh">↻ Refresh</a>
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>App</th>
              <th>Name</th>
              <th>Login ID</th>
              <th>IP Address</th>
              <th>Status</th>
              <th>User Agent</th>
            </tr>
          </thead>
          <tbody>
            {rows if rows else '<tr><td colspan="7" style="text-align:center;padding:40px;color:#9ca3af">No login records yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>"""
    return HTMLResponse(html)


@router.get("/logs/json")
async def logs_json(
    request: Request,
    secret: str = Query(default=""),
    db: Session = Depends(get_db),
    limit: int = 500,
):
    if not _check_secret(secret):
        return JSONResponse({"error": "Forbidden"}, status_code=403)

    logs = db.query(LoginLog).order_by(desc(LoginLog.timestamp)).limit(limit).all()
    return [{
        "id": l.id,
        "app": l.app,
        "login_name": l.login_name,
        "display_name": l.display_name,
        "ip_address": l.ip_address,
        "user_agent": l.user_agent,
        "success": l.success,
        "failure_reason": l.failure_reason,
        "timestamp": l.timestamp.isoformat() if l.timestamp else None,
    } for l in logs]
