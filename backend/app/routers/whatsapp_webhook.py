"""Meta WhatsApp Cloud API verification and event receiver."""

import asyncio
import hashlib
import hmac
import json
from asyncio import to_thread
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import (
    APIRouter,
    Depends,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import ReplyJob, WhatsAppMessage
from app.db.session import get_engine
from app.logging_conf import logger
from app.services.security import check_phone_rate_limit, mask_phone
from app.services.whatsapp import mark_whatsapp_message_read

router = APIRouter(prefix="/webhooks", tags=["Meta WhatsApp"])
MAX_WEBHOOK_BYTES = 3 * 1024 * 1024


def _verify_signature(raw_body: bytes, signature: str | None, secret: str) -> bool:
    if not signature or not secret or not signature.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature[7:], expected)


@router.get(
    "/whatsapp",
    summary="Verify the Meta WhatsApp webhook",
    description=(
        "Handles Meta's subscription handshake. The supplied `hub.verify_token` "
        "must match `WHATSAPP_VERIFY_TOKEN`; a successful request echoes "
        "`hub.challenge` as plain text."
    ),
    response_description="The verification challenge supplied by Meta.",
    responses={403: {"description": "Mode or verification token is invalid."}},
)
def verify_whatsapp_webhook(
    mode: str | None = Query(default=None, alias="hub.mode"),
    challenge: str | None = Query(default=None, alias="hub.challenge"),
    verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    settings: Settings = Depends(get_settings),
) -> Response:
    logger.info(
        "Meta WhatsApp webhook verification attempt",
        extra={"step": "whatsapp_webhook_verification", "mode": mode},
    )
    expected = settings.whatsapp_verify_token.get_secret_value()
    if (
        mode == "subscribe"
        and challenge is not None
        and expected
        and verify_token
        and hmac.compare_digest(verify_token, expected)
    ):
        return Response(content=challenge, media_type="text/plain", status_code=200)
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Verification failed",
    )


@router.post(
    "/whatsapp",
    summary="Receive Meta WhatsApp events",
    description=(
        "Receives batched incoming-message and delivery-status events from Meta. "
        "The request must carry a valid raw-body HMAC signature in "
        "`X-Hub-Signature-256`. Accepted events and reply jobs are persisted before acknowledgement; "
        "AI replies run separately with durable retries. Incoming IDs are deduplicated. Maximum payload: 3 MB."
    ),
    response_description="Acknowledgement after durable storage; AI and sending run separately.",
    responses={
        400: {"description": "The request body is not valid JSON."},
        403: {"description": "The Meta signature is missing or invalid."},
        413: {"description": "The payload exceeds 3 MB."},
        503: {"description": "Persistence unavailable; Meta should retry."},
    },
)
async def receive_whatsapp_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(
        default=None, alias="X-Hub-Signature-256"
    ),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    raw_body = await request.body()
    logger.info(
        "Meta WhatsApp webhook payload received",
        extra={
            "step": "whatsapp_webhook_received",
            "payload_bytes": len(raw_body),
        },
    )
    if len(raw_body) > MAX_WEBHOOK_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Payload is too large",
        )
    if not _verify_signature(
        raw_body,
        x_hub_signature_256,
        settings.whatsapp_app_secret.get_secret_value(),
    ):
        logger.warning(
            "Meta WhatsApp webhook signature verification failed",
            extra={"step": "whatsapp_signature_check", "status": "rejected"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid webhook signature",
        )
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed webhook payload",
        ) from exc

    if not isinstance(payload, dict) or payload.get("object") != "whatsapp_business_account":
        raise HTTPException(status_code=400, detail="Malformed webhook payload")
    try:
        _validate_payload(payload)
        read_receipts = await to_thread(process_whatsapp_payload, payload, settings)
        for message_id, phone_number_id in read_receipts:
            asyncio.create_task(
                mark_whatsapp_message_read(message_id, phone_number_id, settings)
            )
        wakeup = getattr(request.app.state, "reply_wakeup", None)
        if wakeup is not None:
            wakeup.set()
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=400, detail="Malformed webhook payload") from None
    except Exception:
        logger.error("Meta event persistence unavailable", extra={"step": "whatsapp_webhook_persistence"})
        raise HTTPException(status_code=503, detail="Please try again shortly") from None
    return {"status": "accepted"}


def _validate_payload(payload):
    def records(value):
        if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
            raise ValueError("Malformed events")
        return value

    for entry in records(payload.get("entry", [])):
        for change in records(entry.get("changes", [])):
            if change.get("field") != "messages":
                continue
            value = change.get("value")
            if not isinstance(value, dict):
                raise ValueError("Malformed event")
            metadata = value.get("metadata", {})
            if not isinstance(metadata, dict):
                raise ValueError("Malformed metadata")
            phone_number_id = metadata.get("phone_number_id", "")
            if value.get("messages") and (
                not isinstance(phone_number_id, str)
                or not phone_number_id.isdigit()
                or len(phone_number_id) > 40
            ):
                raise ValueError("Malformed phone number id")
            for field in ("phone_number_id", "display_phone_number"):
                if not isinstance(metadata.get(field, ""), str) or len(metadata.get(field, "")) > 40:
                    raise ValueError("Malformed sender")
            for event in records(value.get("messages", [])) + records(value.get("statuses", [])):
                for field, limit in (("id", 255), ("from", 30), ("recipient_id", 30), ("type", 30), ("status", 30)):
                    if not isinstance(event.get(field, ""), str) or len(event.get(field, "")) > limit:
                        raise ValueError("Malformed event field")
                if event.get("type") in {"text", "audio"}:
                    if not event.get("id") or not event.get("from"):
                        raise ValueError("Missing message identity")
                    content = event.get(event.get("type"))
                    if not isinstance(content, dict):
                        raise ValueError("Malformed message")
                    if event.get("type") == "text" and not isinstance(content.get("body"), str):
                        raise ValueError("Malformed text")
                    if event.get("type") == "audio" and not isinstance(content.get("id"), str):
                        raise ValueError("Malformed audio")


def _wa_datetime(value: Any) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(value), tz=UTC)
    except (TypeError, ValueError, OSError):
        return None


def _message_body(message: dict[str, Any]) -> str | None:
    message_type = str(message.get("type", "unknown"))
    typed = message.get(message_type)
    if message_type == "text" and isinstance(typed, dict):
        return str(typed.get("body", ""))
    if typed is None:
        return None
    return json.dumps(typed, separators=(",", ":"), default=str)


def process_whatsapp_payload(
    payload: dict[str, Any], settings: Settings | None = None
) -> list[tuple[str, str]]:
    """Commit incoming events and jobs before acknowledging; never call AI here."""
    settings = settings or get_settings()
    try:
        with Session(get_engine()) as session:
            read_receipts: list[tuple[str, str]] = []
            for entry in payload.get("entry", []):
                for change in entry.get("changes", []):
                    if change.get("field") != "messages":
                        continue
                    value = change.get("value", {})
                    for _, message in _persist_messages(session, value):
                        read_receipts.append((
                            str(message["id"]),
                            str(value.get("metadata", {}).get("phone_number_id", "")),
                        ))
                    _persist_statuses(session, value)
            session.commit()
            return read_receipts
    except Exception:
        logger.error(
            "Meta WhatsApp background persistence failed",
            extra={"step": "whatsapp_webhook_persistence"},
        )
        raise


def _persist_messages(
    session: Session, value: dict[str, Any]
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    inserted: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for message in value.get("messages", []):
        message_id = message.get("id")
        if not message_id:
            continue
        statement = (
            insert(WhatsAppMessage)
            .values(
                message_id=str(message_id),
                from_number=str(message.get("from", "")) or None,
                message_type=str(message.get("type", "unknown")),
                body=_message_body(message),
                status="received",
                wa_timestamp=_wa_datetime(message.get("timestamp")),
                raw_payload=message,
            )
            .on_conflict_do_nothing(index_elements=[WhatsAppMessage.message_id])
            .returning(WhatsAppMessage.message_id)
        )
        inserted_id = session.execute(statement).scalar_one_or_none()
        if inserted_id is not None:
            inserted.append((value, message))
            if message.get("type") in {"text", "audio"}:
                metadata = value.get("metadata", {})
                phone = str(message.get("from", ""))
                allowed = check_phone_rate_limit(phone)
                session.add(ReplyJob(
                    message_id=str(message_id), customer_phone=phone,
                    display_number=str(metadata.get("display_phone_number", "")),
                    phone_number_id=str(metadata.get("phone_number_id", "")),
                    state="pending" if allowed else "needs_review",
                    failure_category=None if allowed else "intake_rate_limit",
                    attempts=0, transcript=[],
                ))
    return inserted


def _send_meta_message(to: str, body: str, settings: Settings) -> None:
    access_token = settings.whatsapp_access_token.get_secret_value()
    phone_number_id = settings.whatsapp_phone_number_id
    if not access_token or not phone_number_id:
        logger.error(
            "Meta outbound messaging is not configured",
            extra={"step": "meta_message_send", "status": "not_configured"},
        )
        return
    response = httpx.post(
        f"https://graph.facebook.com/v23.0/{phone_number_id}/messages",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {"preview_url": False, "body": body},
        },
        timeout=20,
    )
    response.raise_for_status()
    logger.info(
        "Meta WhatsApp reply sent",
        extra={"step": "meta_message_send", "customer_phone": mask_phone(to)},
    )


def _persist_statuses(session: Session, value: dict[str, Any]) -> None:
    for item in value.get("statuses", []):
        message_id = item.get("id")
        if not message_id:
            continue
        _update_reply_status(session, item)
        values = {
            "from_number": str(item.get("recipient_id", "")) or None,
            "message_type": "status",
            "status": str(item.get("status", "unknown")),
            "wa_timestamp": _wa_datetime(item.get("timestamp")),
            "raw_payload": item,
        }
        statement = insert(WhatsAppMessage).values(message_id=str(message_id), body=None, **values)
        session.execute(statement.on_conflict_do_update(
            index_elements=[WhatsAppMessage.message_id], set_=values,
            where=WhatsAppMessage.wa_timestamp.is_(None) | (WhatsAppMessage.wa_timestamp <= values["wa_timestamp"])
            if values["wa_timestamp"] is not None else WhatsAppMessage.wa_timestamp.is_(None),
        ))


def _update_reply_status(session: Session, item: dict[str, Any]) -> None:
    """Correlate accepted/delivered/read receipts without regressing final states."""
    from uuid import UUID

    job = session.scalar(select(ReplyJob).where(
        ReplyJob.outbound_message_id == str(item["id"])
    ).with_for_update())
    if job is None and item.get("biz_opaque_callback_data"):
        try:
            identifier = UUID(item["biz_opaque_callback_data"])
        except (ValueError, TypeError):
            return
        job = session.scalar(select(ReplyJob).where(ReplyJob.id == identifier).with_for_update())
    if job is None or job.state not in ("sending", "delivery_unknown", "accepted", "delivered", "read", "needs_review"):
        return
    if job.customer_phone != str(item.get("recipient_id", "")):
        return
    if job.outbound_message_id and job.outbound_message_id != str(item["id"]):
        return
    state = item.get("status")
    timestamp = _wa_datetime(item.get("timestamp")) or datetime.now(UTC)
    if state not in ("sent", "delivered", "read", "failed"):
        return
    job.outbound_message_id = str(item["id"])
    if state == "failed":
        if job.state not in ("delivered", "read"):
            job.state = "needs_review"
            job.failure_category = "meta_delivery_failed"
        return
    rank = {"accepted": 1, "delivered": 2, "read": 3}
    target = "accepted" if state == "sent" else state
    if rank.get(target, 0) >= rank.get(job.state, 0):
        job.state = target
        job.failure_category = None
    job.accepted_at = job.accepted_at or timestamp
    if state in ("delivered", "read"):
        job.delivered_at = job.delivered_at or timestamp
    if state == "read":
        job.read_at = job.read_at or timestamp
