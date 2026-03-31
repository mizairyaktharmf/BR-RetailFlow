"""
Email service
Sends HTML emails via SMTP (supports TLS on port 587)
"""

import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from utils.config import settings

logger = logging.getLogger(__name__)


def send_email(to_emails: list[str], subject: str, html_body: str):
    """
    Send an HTML email to one or more recipients.
    Raises ValueError if SMTP is not configured.
    Raises smtplib exceptions on connection / auth failures.
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        raise ValueError("SMTP not configured")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = ", ".join(to_emails)
    msg.attach(MIMEText(html_body, "html"))

    logger.info(f"Sending email '{subject}' to {to_emails} via {settings.SMTP_HOST}:{settings.SMTP_PORT}")

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.sendmail(settings.SMTP_FROM, to_emails, msg.as_string())

    logger.info(f"Email sent successfully to {to_emails}")
