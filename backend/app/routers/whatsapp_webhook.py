"""Meta WhatsApp Cloud API verification and event receiver."""

import hashlib
import hmac
import json
from datetime import UTC, datetime
from typing import Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import WhatsAppMessage
from app.db.session import get_engine
from app.logging_conf import logger

router = APIRouter(prefix="/webhooks", tags=["meta-whatsapp"])
MAX_WEBHOOK_BYTES = 3 * 1024 * 1024


def _verify_signature(raw_body: bytes, signature: str | None, secret: str) -> bool:
    if not signature or not secret or not signature.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature[7:], expected)


@router.get("/whatsapp")
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


@router.post("/whatsapp")
async def receive_whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
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

    background_tasks.add_task(process_whatsapp_payload, payload)
    return {"status": "accepted"}


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


def process_whatsapp_payload(payload: dict[str, Any]) -> None:
    """Persist every entry/change in a separate post-response DB session."""
    try:
        with Session(get_engine()) as session:
            for entry in payload.get("entry", []):
                for change in entry.get("changes", []):
                    if change.get("field") != "messages":
                        continue
                    value = change.get("value", {})
                    _persist_messages(session, value)
                    _persist_statuses(session, value)
            session.commit()
    except Exception:
        logger.exception(
            "Meta WhatsApp background persistence failed",
            extra={"step": "whatsapp_webhook_persistence"},
        )


def _persist_messages(session: Session, value: dict[str, Any]) -> None:
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
        )
        session.execute(statement)


def _persist_statuses(session: Session, value: dict[str, Any]) -> None:
    for item in value.get("statuses", []):
        message_id = item.get("id")
        if not message_id:
            continue
        values = {
            "from_number": str(item.get("recipient_id", "")) or None,
            "message_type": "status",
            "status": str(item.get("status", "unknown")),
            "wa_timestamp": _wa_datetime(item.get("timestamp")),
            "raw_payload": item,
        }
        result = session.execute(
            update(WhatsAppMessage)
            .where(WhatsAppMessage.message_id == str(message_id))
            .values(**values)
        )
        if result.rowcount == 0:
            session.execute(
                insert(WhatsAppMessage)
                .values(message_id=str(message_id), body=None, **values)
                .on_conflict_do_nothing(
                    index_elements=[WhatsAppMessage.message_id]
                )
            )
