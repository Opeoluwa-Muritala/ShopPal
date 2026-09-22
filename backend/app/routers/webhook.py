"""Webhook routers for Twilio WhatsApp and Paystack with signature verification, rate limiting, and replay defense."""

import json
from typing import Any

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
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import Order
from app.db.session import get_db
from app.logging_conf import logger
from app.services.security import (
    check_phone_rate_limit,
    is_paystack_event_processed,
    mark_paystack_event_processed,
    mask_phone,
    validate_media_url,
    verify_paystack_signature,
    verify_twilio_signature,
)

router = APIRouter(prefix="/webhook", tags=["webhooks"])


@router.post("/whatsapp")
async def twilio_whatsapp_webhook(
    request: Request,
    From: str = Form(default=""),
    Body: str = Form(default=""),
    MediaUrl0: str | None = Form(default=None),
    x_twilio_signature: str | None = Header(default=None, alias="X-Twilio-Signature"),
    settings: Settings = Depends(get_settings),
):
    """
    Twilio WhatsApp inbound webhook:
    1. Enforces Twilio X-Twilio-Signature validation.
    2. Enforces per-phone rate limiting (prevents cost & LLM abuse).
    3. Enforces media URL allowlisting (SSRF protection).
    """
    phone = From.replace("whatsapp:", "").strip()
    masked_phone = mask_phone(phone)

    # 1. Twilio Signature Verification
    auth_token = settings.twilio_auth_token.get_secret_value()
    if auth_token:
        form_data = await request.form()
        form_params = {k: str(v) for k, v in form_data.items()}
        full_url = str(request.url)
        is_valid = verify_twilio_signature(
            auth_token, x_twilio_signature, full_url, form_params
        )
        if not is_valid:
            logger.warning(
                f"Twilio webhook signature verification failed for sender {masked_phone}",
                extra={
                    "step": "twilio_signature_check",
                    "status": "rejected",
                    "customer_phone": masked_phone,
                },
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid Twilio signature header",
            )

    # 2. Rate Limiting Check (Cost & abuse control)
    if not check_phone_rate_limit(phone):
        logger.warning(
            f"Rate limit exceeded for sender {masked_phone}; dropping LLM execution",
            extra={"step": "rate_limit_exceeded", "customer_phone": masked_phone},
        )
        slow_down_twiml = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            "<Response><Message>Hold on small! You dey send message too fast. Please wait a minute before sending another message.</Message></Response>"
        )
        return Response(
            content=slow_down_twiml, media_type="application/xml", status_code=200
        )

    # 3. Media URL SSRF Validation
    if MediaUrl0:
        if not validate_media_url(MediaUrl0):
            logger.error(
                f"SSRF vector blocked: MediaUrl0 domain '{MediaUrl0}' is not allowlisted",
                extra={
                    "step": "media_url_validation",
                    "status": "blocked",
                    "customer_phone": masked_phone,
                },
            )
            twiml = (
                '<?xml version="1.0" encoding="UTF-8"?>'
                "<Response><Message>Sorry, we cannot accept media from unverified external links.</Message></Response>"
            )
            return Response(
                content=twiml, media_type="application/xml", status_code=200
            )

    # Return standard successful acknowledgement
    response_twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response><Message>Welcome to Naija Marketplace! Wetin you wan buy today?</Message></Response>"
    )
    return Response(
        content=response_twiml, media_type="application/xml", status_code=200
    )


@router.post("/paystack")
async def paystack_webhook(
    request: Request,
    x_paystack_signature: str | None = Header(
        default=None, alias="x-paystack-signature"
    ),
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
        if not verify_paystack_signature(
            paystack_secret, x_paystack_signature, raw_body
        ):
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
            extra={
                "step": "paystack_idempotency",
                "status": "ignored_replay",
                "order_code": reference,
            },
        )
        return {"status": "ignored_duplicate", "event_id": event_id}

    if event_type == "charge.success" and reference and session is not None:
        # Mark order as paid
        stmt = (
            update(Order)
            .where(Order.order_code == reference)
            .values(payment_status="paid", status="processing")
        )
        session.execute(stmt)
        session.commit()

    # Record event ID in idempotency store
    mark_paystack_event_processed(event_id)

    return {"status": "success", "event_id": event_id}
