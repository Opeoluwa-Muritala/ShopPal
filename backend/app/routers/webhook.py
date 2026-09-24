"""Webhook routers for Twilio WhatsApp and Paystack with signature verification, rate limiting, and replay defense."""

import json
from asyncio import to_thread
from datetime import UTC, datetime
from html import escape
from typing import Any

import httpx
from fastapi import (
    APIRouter,
    Depends,
    Form,
    Header,
    HTTPException,
    Request,
    Response,
    status,
)
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import Conversation, Order, Product, Vendor
from app.db.session import get_db
from app.logging_conf import logger
from app.services.customer_tools import CustomerToolDispatcher
from app.services.llm import GemmaError, LLMService
from app.services.security import (
    check_phone_rate_limit,
    is_paystack_event_processed,
    mark_paystack_event_processed,
    mask_phone,
    validate_media_url,
    verify_paystack_signature,
    verify_twilio_signature,
)
from app.services.transcription import TranscriptionError, transcribe_audio

router = APIRouter(prefix="/webhook", tags=["Provider Webhooks"])


@router.post("/whatsapp", tags=["Twilio WhatsApp"])
async def twilio_whatsapp_webhook(
    request: Request,
    From: str = Form(default=""),
    To: str = Form(default=""),
    Body: str = Form(default=""),
    MediaUrl0: str | None = Form(default=None),
    MediaContentType0: str | None = Form(default=None),
    x_twilio_signature: str | None = Header(default=None, alias="X-Twilio-Signature"),
    settings: Settings = Depends(get_settings),
    session: Session = Depends(get_db),
):
    """
    Twilio WhatsApp inbound webhook:
    1. Enforces per-phone rate limiting (prevents cost & LLM abuse).
    2. Enforces Twilio X-Twilio-Signature validation.
    3. Enforces media URL allowlisting (SSRF protection).
    """
    phone = From.replace("whatsapp:", "").strip()
    masked_phone = mask_phone(phone)

    # 1. Rate Limiting Check — runs first to short-circuit abusive senders
    #    before any crypto work or DB access.
    if not check_phone_rate_limit(phone):
        logger.warning(
            f"Rate limit exceeded for sender {masked_phone}; dropping LLM execution",
            extra={"step": "rate_limit_exceeded", "customer_phone": masked_phone},
        )
        slow_down_twiml = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            "<Response><Message>Hold on small! You dey send message too fast. Please wait a minute before sending another message.</Message></Response>"
        )
        return Response(content=slow_down_twiml, media_type="application/xml", status_code=200)

    # 2. Twilio Signature Verification
    auth_token = settings.twilio_auth_token.get_secret_value()
    if auth_token:
        form_data = await request.form()
        form_params = {k: str(v) for k, v in form_data.items()}
        full_url = str(request.url)
        is_valid = verify_twilio_signature(auth_token, x_twilio_signature, full_url, form_params)
        if not is_valid:
            logger.warning(
                f"Twilio webhook signature verification failed for sender {masked_phone}",
                extra={"step": "twilio_signature_check", "status": "rejected", "customer_phone": masked_phone},
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid Twilio signature header",
            )

    # 3. Media URL SSRF Validation
    if MediaUrl0:
        if not validate_media_url(MediaUrl0):
            logger.error(
                f"SSRF vector blocked: MediaUrl0 domain '{MediaUrl0}' is not allowlisted",
                extra={"step": "media_url_validation", "status": "blocked", "customer_phone": masked_phone},
            )
            twiml = (
                '<?xml version="1.0" encoding="UTF-8"?>'
                "<Response><Message>Sorry, we cannot accept media from unverified external links.</Message></Response>"
            )
            return Response(content=twiml, media_type="application/xml", status_code=200)

    bot_number = To.replace("whatsapp:", "").strip()
    vendor = session.scalar(
        select(Vendor).where(Vendor.bot_number == bot_number, Vendor.is_active.is_(True))
    )
    if vendor is None:
        return _twiml("This shop assistant is unavailable right now. Please try again later.")

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

    service = LLMService(settings)
    message = Body.strip()
    try:
        if MediaUrl0:
            media = await _download_twilio_media(MediaUrl0, settings)
            content_type = (MediaContentType0 or media.headers.get("content-type", "")).lower()
            if content_type.startswith("audio/"):
                try:
                    message = await to_thread(
                        transcribe_audio, media.content, content_type, settings
                    )
                except TranscriptionError:
                    return _twiml(
                        "I couldn't understand that voice note. Please type your message instead."
                    )
            elif content_type.startswith("image/"):
                products = session.scalars(
                    select(Product).where(
                        Product.vendor_id == vendor.id,
                        Product.status == "active",
                    )
                ).all()
                catalog = [
                    {
                        "id": str(product.id),
                        "name": product.name,
                        "price": str(product.price),
                        "description": product.description,
                    }
                    for product in products
                ]
                reply = await to_thread(
                    service.match_product_image,
                    media.content,
                    content_type,
                    catalog,
                )
                _persist_exchange(session, conversation, "[customer image]", reply)
                return _twiml(reply)
            else:
                return _twiml(
                    "I can only help with a text, voice note, or product image."
                )

        if not message:
            return _twiml("Send me a product name, voice note, or image to start shopping.")

        history = list(conversation.message_history or [])[-12:]
        dispatcher = CustomerToolDispatcher(session, vendor.id, phone)
        reply, _calls = await to_thread(service.ask, message, dispatcher, history)
        _persist_exchange(session, conversation, message, reply)
        return _twiml(reply)
    except (GemmaError, httpx.HTTPError):
        logger.exception(
            "Customer assistant provider failed",
            extra={"step": "customer_ai", "customer_phone": masked_phone},
        )
        return _twiml("I can't complete that request right now. Please try again shortly.")


def _twiml(message: str) -> Response:
    content = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f"<Response><Message>{escape(message)}</Message></Response>"
    )
    return Response(content=content, media_type="application/xml", status_code=200)


async def _download_twilio_media(url: str, settings: Settings) -> httpx.Response:
    async with httpx.AsyncClient(
        auth=(settings.twilio_account_sid, settings.twilio_auth_token.get_secret_value()),
        timeout=20,
        follow_redirects=False,
    ) as client:
        response = await client.get(url)
        response.raise_for_status()
        if len(response.content) > 10 * 1024 * 1024:
            raise httpx.HTTPError("Media exceeds the maximum size")
        return response


def _persist_exchange(
    session: Session,
    conversation: Conversation,
    customer_message: str,
    assistant_message: str,
) -> None:
    history = list(conversation.message_history or [])
    history.extend(
        [
            {"role": "user", "content": customer_message},
            {"role": "assistant", "content": assistant_message},
        ]
    )
    conversation.message_history = history[-40:]
    conversation.messages_this_session = (
        int(conversation.messages_this_session or 0) + 2
    )
    session.commit()


@router.post("/paystack", tags=["Paystack"])
async def paystack_webhook(
    request: Request,
    x_paystack_signature: str | None = Header(default=None, alias="x-paystack-signature"),
    settings: Settings = Depends(get_settings),
    session: Session = Depends(get_db),
):
    """
    Paystack payment webhook:
    1. Validates HMAC-SHA512 signature using PAYSTACK_SECRET_KEY.
    2. Enforces idempotency to prevent double-fulfillment on replayed events.
    """
    raw_body = await request.body()
    paystack_secret = settings.paystack_secret_key.get_secret_value()

    # Signature verification
    if paystack_secret:
        if not verify_paystack_signature(paystack_secret, x_paystack_signature, raw_body):
            logger.warning(
                "Paystack webhook signature verification failed",
                extra={"step": "paystack_signature_check", "status": "rejected"},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Paystack signature header",
            )

    try:
        payload: dict[str, Any] = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed JSON body",
        ) from exc

    event_type = payload.get("event")
    data = payload.get("data", {})
    reference = data.get("reference")
    event_id = str(payload.get("id") or reference)

    # Idempotency check: prevent duplicate fulfillment on event replay
    if is_paystack_event_processed(event_id):
        logger.info(
            f"Paystack event '{event_id}' already processed; ignoring replay",
            extra={"step": "paystack_idempotency", "status": "ignored_replay", "order_code": reference},
        )
        return {"status": "ignored_duplicate", "event_id": event_id}

    if event_type == "charge.success" and reference and session is not None:
        # Mark order as paid
        stmt = (
            update(Order)
            .where(Order.order_code == reference)
            .values(
                payment_status="paid",
                status="processing",
                payment_confirmed_at=datetime.now(UTC),
                payment_confirmation_source="paystack_webhook",
            )
        )
        session.execute(stmt)
        session.commit()

    # Record event ID in idempotency store
    mark_paystack_event_processed(event_id)

    return {"status": "success", "event_id": event_id}
