"""Meta WhatsApp Cloud API verification and event receiver."""

import hashlib
import hmac
import json
from datetime import UTC, datetime
from typing import Any

import httpx
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
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import Conversation, Vendor, WhatsAppMessage
from app.db.session import get_engine
from app.logging_conf import logger
from app.services.customer_tools import CustomerToolDispatcher
from app.services.llm import GemmaError, LLMService
from app.services.security import check_phone_rate_limit, mask_phone

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
        "`X-Hub-Signature-256`. Accepted events are persisted in a background "
        "task and incoming message IDs are deduplicated. Maximum payload: 3 MB."
    ),
    response_description="Acknowledgement returned before background persistence.",
    responses={
        400: {"description": "The request body is not valid JSON."},
        403: {"description": "The Meta signature is missing or invalid."},
        413: {"description": "The payload exceeds 3 MB."},
    },
)
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

    background_tasks.add_task(process_whatsapp_payload, payload, settings)
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


def process_whatsapp_payload(
    payload: dict[str, Any], settings: Settings | None = None
) -> None:
    """Persist every entry/change in a separate post-response DB session."""
    settings = settings or get_settings()
    try:
        with Session(get_engine()) as session:
            new_messages: list[tuple[dict[str, Any], dict[str, Any]]] = []
            for entry in payload.get("entry", []):
                for change in entry.get("changes", []):
                    if change.get("field") != "messages":
                        continue
                    value = change.get("value", {})
                    new_messages.extend(_persist_messages(session, value))
                    _persist_statuses(session, value)
            session.commit()
            for value, message in new_messages:
                _process_customer_message(session, value, message, settings)
    except Exception:
        logger.exception(
            "Meta WhatsApp background persistence failed",
            extra={"step": "whatsapp_webhook_persistence"},
        )


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
        )
        result = session.execute(statement)
        if result.rowcount == 1:
            inserted.append((value, message))
    return inserted


def _process_customer_message(
    session: Session,
    value: dict[str, Any],
    message: dict[str, Any],
    settings: Settings,
) -> None:
    if message.get("type") != "text":
        return
    phone = str(message.get("from", "")).strip()
    text = str(message.get("text", {}).get("body", "")).strip()
    if not phone or not text:
        return
    if not check_phone_rate_limit(phone):
        _send_meta_message(
            phone,
            "Hold on small! You dey send message too fast. Please wait a minute.",
            settings,
        )
        return

    display_number = str(value.get("metadata", {}).get("display_phone_number", ""))
    normalized_number = display_number.replace("+", "").replace(" ", "")
    vendor = session.scalar(
        select(Vendor).where(
            Vendor.bot_number.in_([display_number, normalized_number]),
            Vendor.is_active.is_(True),
        )
    )
    if vendor is None:
        _send_meta_message(
            phone,
            "This shop assistant is unavailable right now. Please try again later.",
            settings,
        )
        return

    conversation = session.scalar(
        select(Conversation).where(
            Conversation.vendor_id == vendor.id,
            Conversation.customer_phone == phone,
        )
    )
    if conversation is None:
        conversation = Conversation(
            vendor_id=vendor.id,
            customer_phone=phone,
            message_history=[],
            conversation_state="browsing",
            messages_this_session=0,
        )
        session.add(conversation)
        session.flush()

    try:
        history = list(conversation.message_history or [])[-12:]
        dispatcher = CustomerToolDispatcher(session, vendor.id, phone)
        reply, _calls = LLMService(settings).ask(text, dispatcher, history)
    except (GemmaError, httpx.HTTPError):
        logger.exception(
            "Meta customer assistant provider failed",
            extra={
                "step": "meta_customer_ai",
                "customer_phone": mask_phone(phone),
            },
        )
        reply = "I can't complete that request right now. Please try again shortly."

    history = list(conversation.message_history or [])
    history.extend(
        [
            {"role": "user", "content": text},
            {"role": "assistant", "content": reply},
        ]
    )
    conversation.message_history = history[-40:]
    conversation.messages_this_session = (
        int(conversation.messages_this_session or 0) + 2
    )
    session.commit()
    _send_meta_message(phone, reply, settings)


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
