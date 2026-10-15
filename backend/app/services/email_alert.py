"""Resilient email alert helper for manual transfer confirmations."""

import httpx

from app.logging_conf import logger


async def send_email(http_client: httpx.AsyncClient, url: str, to: str, subject: str, text: str) -> None:
    if not url or not to:
        return
    try:
        await http_client.post(url, json={"to": to, "subject": subject, "text": text}, timeout=10)
    except Exception:
        logger.exception("Failed to send email alert", extra={"step": "email_alert"})
