"""Meta WhatsApp Cloud API outbound message sender."""

import io
import time
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Product, WhatsAppMedia
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


async def send_whatsapp_image_from_db(
    db: Session,
    media_row_id: str,
    recipient_number: str,
    caption: str | None = None,
) -> dict[str, Any]:
    """Upload a stored image to Meta and send it to a WhatsApp recipient.

    Meta media IDs are scoped to the direction and operation that created them.
    The outbound media_id from the upload step is different from any inbound
    media_id stored when the image was received, so it must not be cached or
    reused; re-upload the bytes for every outbound send.

    Database errors and a missing row are raised to the caller. Meta failures
    are logged with Meta's response body and returned as a small error result so
    a webhook or background worker is not crashed by an external API failure.
    """
    if not isinstance(db, Session):
        raise TypeError("db must be an active SQLAlchemy Session")
    try:
        media_uuid = UUID(str(media_row_id))
    except (TypeError, ValueError, AttributeError) as exc:
        raise ValueError("media_row_id must be a valid WhatsApp media row UUID") from exc

    media = db.scalar(
        select(WhatsAppMedia).where(WhatsAppMedia.id == media_uuid)
    )
    if media is None:
        raise LookupError(f"WhatsApp media row '{media_row_id}' was not found")
    if not media.content:
        raise ValueError(f"WhatsApp media row '{media_row_id}' has no image content")
    mime_type = (media.mime_type or "").split(";", 1)[0].strip().lower()
    if not mime_type.startswith("image/"):
        raise ValueError(f"WhatsApp media row '{media_row_id}' is not an image")
    if not recipient_number or len(recipient_number) > 30:
        raise ValueError("recipient_number must be a valid WhatsApp phone number")
    if caption is not None and len(caption) > 1024:
        raise ValueError("caption is too long for a WhatsApp image message")

    settings = get_settings()
    phone_number_id = settings.whatsapp_phone_number_id
    access_token = settings.whatsapp_access_token.get_secret_value()
    if not phone_number_id or not access_token:
        logger.warning(
            "WhatsApp image send skipped; Meta credentials are not configured",
            extra={"step": "whatsapp_image_send", "status": "not_configured"},
        )
        return {"ok": False, "error": "whatsapp_credentials_not_configured"}

    base_url = f"https://graph.facebook.com/v20.0/{phone_number_id}"
    headers = {"Authorization": f"Bearer {access_token}"}
    start = time.perf_counter()

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            upload_response = await client.post(
                f"{base_url}/media",
                headers=headers,
                data={"messaging_product": "whatsapp", "type": mime_type},
                files={
                    "file": ("outbound-image", io.BytesIO(media.content), mime_type)
                },
            )
            upload_response.raise_for_status()
            upload_payload = upload_response.json()
            if not isinstance(upload_payload, dict):
                raise ValueError("Meta media upload response was not a JSON object")
            outbound_media_id = upload_payload.get("id")
            if not isinstance(outbound_media_id, str) or not outbound_media_id:
                raise ValueError("Meta media upload response did not include an id")

            image_payload: dict[str, Any] = {"id": outbound_media_id}
            if caption is not None:
                image_payload["caption"] = caption
            send_response = await client.post(
                f"{base_url}/messages",
                headers={**headers, "Content-Type": "application/json"},
                json={
                    "messaging_product": "whatsapp",
                    "to": recipient_number,
                    "type": "image",
                    "image": image_payload,
                },
            )
            send_response.raise_for_status()
            result = send_response.json()
            if not isinstance(result, dict):
                raise ValueError("Meta image send response was not a JSON object")

        log_external_call(
            service="whatsapp_cloud",
            operation="send_image",
            start_time=start,
            success=True,
        )
        return result

    except httpx.HTTPStatusError as exc:
        response_body = exc.response.text.replace(access_token, "[redacted]").replace(recipient_number, "[redacted]")[:2000]
        log_external_call(
            service="whatsapp_cloud",
            operation="send_image",
            start_time=start,
            success=False,
            error=exc,
        )
        logger.error(
            "WhatsApp image API returned an error body: %s",
            response_body,
            extra={"step": "whatsapp_image_send", "status": "failed"},
        )
        return {
            "ok": False,
            "error": "whatsapp_meta_api_error",
            "status_code": exc.response.status_code,
        }
    except (httpx.HTTPError, ValueError) as exc:
        log_external_call(
            service="whatsapp_cloud",
            operation="send_image",
            start_time=start,
            success=False,
            error=exc,
        )
        logger.error(
            "WhatsApp image send failed: %s",
            str(exc),
            extra={"step": "whatsapp_image_send", "status": "failed"},
        )
        return {"ok": False, "error": "whatsapp_image_send_failed"}


async def send_whatsapp_product_image(
    db: Session,
    product_id: str,
    recipient_number: str,
    caption: str | None = None,
) -> dict[str, Any]:
    """Resolve a product's stored image and send its bytes through Meta."""
    try:
        product_uuid = UUID(str(product_id))
    except (TypeError, ValueError, AttributeError) as exc:
        raise ValueError("product_id must be a valid product UUID") from exc
    media_row_id = db.scalar(
        select(Product.image_media_id).where(Product.id == product_uuid)
    )
    if media_row_id is None:
        raise LookupError(f"Product '{product_id}' has no stored image")
    return await send_whatsapp_image_from_db(
        db,
        str(media_row_id),
        recipient_number,
        caption,
    )

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


# Example call from an async bot handler (use the existing request/session):
#
# result = await send_whatsapp_image_from_db(
#     db=session,
#     media_row_id="00000000-0000-0000-0000-000000000000",
#     recipient_number="+2348012345678",
#     caption="Your product image",
# )
