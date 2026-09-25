"""Meta WhatsApp Cloud API outbound message sender."""

import time
from typing import Any

import httpx

from app.logging_conf import log_external_call, logger


async def send_whatsapp_text(
    to_phone: str,
    message: str,
    settings: Any,
) -> None:
    """
    Sends a plain-text message to a WhatsApp user via the Meta Graph API.

    Uses WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN from settings.

    Args:
        to_phone: Recipient phone number in E.164 format (e.g. "+2348011112222").
        message: The text body to send.
        settings: App Settings instance.

    Raises:
        httpx.HTTPStatusError: If the Graph API returns a non-2xx status.
    """
    phone_number_id = settings.whatsapp_phone_number_id
    access_token = settings.whatsapp_access_token.get_secret_value()

    if not phone_number_id or not access_token:
        logger.warning(
            "WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN not configured; "
            "skipping outbound message"
        )
        return

    url = f"https://graph.facebook.com/v25.0/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "text",
        "text": {"body": message},
    }

    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()

        log_external_call(
            service="whatsapp_cloud",
            operation="send_text",
            start_time=start,
            success=True,
        )

    except httpx.HTTPStatusError as exc:
        log_external_call(
            service="whatsapp_cloud",
            operation="send_text",
            start_time=start,
            success=False,
            error=exc,
        )
        logger.error(
            f"WhatsApp Cloud API error {exc.response.status_code}: "
            f"{exc.response.text[:300]}"
        )
        raise

    except Exception as exc:
        log_external_call(
            service="whatsapp_cloud",
            operation="send_text",
            start_time=start,
            success=False,
            error=exc,
        )
        raise


async def mark_whatsapp_message_read(
    message_id: str,
    phone_number_id: str,
    settings: Any,
) -> None:
    """Mark an inbound Meta message as read without delaying webhook acknowledgement."""
    access_token = settings.whatsapp_access_token.get_secret_value()
    configured_phone_id = settings.whatsapp_phone_number_id
    target_phone_id = phone_number_id or configured_phone_id
    if not access_token or not target_phone_id:
        logger.warning(
            "WhatsApp read receipt skipped; credentials are not configured",
            extra={"step": "meta_message_read", "status": "not_configured"},
        )
        return

    url = f"https://graph.facebook.com/v25.0/{target_phone_id}/messages"
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "messaging_product": "whatsapp",
                    "status": "read",
                    "message_id": message_id,
                },
            )
            response.raise_for_status()
        log_external_call(
            service="whatsapp_cloud",
            operation="mark_read",
            start_time=start,
            success=True,
        )
    except Exception as exc:
        log_external_call(
            service="whatsapp_cloud",
            operation="mark_read",
            start_time=start,
            success=False,
            error=exc,
        )
        logger.warning(
            "WhatsApp read receipt failed",
            extra={"step": "meta_message_read", "status": "failed", "message_id": message_id},
        )

async def send_whatsapp_template(
    to_phone: str,
    template_name: str,
    language_code: str,
    settings: Any,
) -> None:
    """
    Sends a pre-approved WhatsApp template message.
    Useful for the first outbound message to a user (outside 24-hour window).

    Args:
        to_phone: Recipient phone number in E.164 format.
        template_name: Approved template name (e.g. "3p_direct_integration_test_template").
        language_code: Template language (e.g. "en_US").
        settings: App Settings instance.
    """
    phone_number_id = settings.whatsapp_phone_number_id
    access_token = settings.whatsapp_access_token.get_secret_value()

    if not phone_number_id or not access_token:
        logger.warning("WhatsApp credentials not configured; skipping template send")
        return

    url = f"https://graph.facebook.com/v25.0/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
        },
    }

    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()

        log_external_call(
            service="whatsapp_cloud",
            operation="send_template",
            start_time=start,
            success=True,
            extra={"template": template_name},
        )

    except Exception as exc:
        log_external_call(
            service="whatsapp_cloud",
            operation="send_template",
            start_time=start,
            success=False,
            error=exc,
        )
        raise
