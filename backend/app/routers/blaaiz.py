"""Authenticated Blaaiz collection initiation and signed webhook handling."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field, SecretStr, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import Account, Order
from app.db.session import get_db
from app.logging_conf import logger
from app.services.auth import get_current_account
from app.services.blaaiz import (
    BlaaizClient,
    BlaaizError,
    decimal_value,
    transaction_data,
)

router = APIRouter(prefix="/payments/blaaiz", tags=["Blaaiz"])
webhook_router = APIRouter(prefix="/webhooks", tags=["Blaaiz"])
REPLAY_WINDOW_SECONDS = 300


class CardCollectionRequest(BaseModel):
    order_code: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9_-]+$")
    customer_id: str = Field(min_length=1, max_length=255)
    card_holder_name: str = Field(min_length=2, max_length=120)
    card_number: SecretStr
    expiry: str = Field(pattern=r"^(0[1-9]|1[0-2])/\d{2}$")
    cvc: SecretStr
    phone: str | None = Field(default=None, pattern=r"^\+?[1-9]\d{7,14}$")

    @field_validator("card_number")
    @classmethod
    def validate_card_number(cls, value: SecretStr) -> SecretStr:
        digits = value.get_secret_value()
        if not (digits.isdigit() and len(digits) == 16):
            raise ValueError("card_number must contain exactly 16 digits")
        return value

    @field_validator("cvc")
    @classmethod
    def validate_cvc(cls, value: SecretStr) -> SecretStr:
        digits = value.get_secret_value()
        if not (digits.isdigit() and len(digits) == 3):
            raise ValueError("cvc must contain exactly 3 digits")
        return value


class CardCollectionResponse(BaseModel):
    transaction_id: str
    authorization_url: str


@router.post("/collections", response_model=CardCollectionResponse, status_code=201)
async def create_collection(
    request: CardCollectionRequest,
    current_account: Account = Depends(get_current_account),
    session: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> CardCollectionResponse:
    order = session.scalar(
        select(Order).where(
            Order.order_code == request.order_code,
            Order.vendor_id == current_account.vendor_id,
        ).with_for_update()
    )
    if not isinstance(order, Order):
        raise HTTPException(status_code=404, detail="Order not found")
    if order.payment_status != "pending_payment":
        raise HTTPException(status_code=409, detail="Order is not awaiting payment")
    try:
        result = await BlaaizClient(settings).create_card_collection(
            amount=Decimal(order.total),
            customer_id=request.customer_id,
            merchant_reference=order.order_code,
            card_holder_name=request.card_holder_name,
            card_number=request.card_number.get_secret_value(),
            expiry=request.expiry,
            cvc=request.cvc.get_secret_value(),
            phone=request.phone,
        )
    except BlaaizError:
        logger.warning("Blaaiz collection initiation failed", extra={"step": "blaaiz_collection_create"})
        raise HTTPException(status_code=502, detail="Payment provider unavailable") from None
    order.payment_provider = "blaaiz"
    order.payment_reference = result["transaction_id"]
    order.payment_transaction_id = result["transaction_id"]
    session.commit()
    return CardCollectionResponse(**result)


def verify_signature(raw_body: bytes, timestamp: str | None, signature: str | None, secret: str) -> bool:
    if not timestamp or not signature or not secret:
        return False
    try:
        signed_at = int(timestamp)
    except ValueError:
        return False
    if abs(int(time.time()) - signed_at) > REPLAY_WINDOW_SECONDS:
        return False
    expected = hmac.new(secret.encode(), timestamp.encode() + b"." + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected.lower(), signature.lower())


def _event_data(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


@webhook_router.post("/blaaiz")
async def receive_webhook(
    request: Request,
    x_blaaiz_timestamp: str | None = Header(default=None, alias="x-blaaiz-timestamp"),
    x_blaaiz_signature: str | None = Header(default=None, alias="x-blaaiz-signature"),
    session: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    raw_body = await request.body()
    if len(raw_body) > 256_000:
        raise HTTPException(status_code=413, detail="Webhook payload too large")
    secret = settings.blaaiz_webhook_signing_secret.get_secret_value()
    if not verify_signature(raw_body, x_blaaiz_timestamp, x_blaaiz_signature, secret):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Malformed JSON body") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Malformed webhook payload")
    data = _event_data(payload)
    event = str(payload.get("event") or data.get("event") or data.get("type") or "")
    transaction_status = str(data.get("transaction_status") or data.get("status") or "").upper()
    if event not in {"collection.completed", "collection"} or transaction_status != "SUCCESSFUL":
        return {"status": "ignored"}
    event_id = str(data.get("event_id") or payload.get("event_id") or "")
    transaction_id = str(data.get("transaction_id") or "")
    merchant_reference = str(data.get("merchant_reference") or "")
    if not event_id or not transaction_id or not merchant_reference:
        raise HTTPException(status_code=400, detail="Missing payment event identifier")
    order = session.scalar(
        select(Order).where(
            Order.order_code == merchant_reference,
            Order.payment_provider == "blaaiz",
        ).with_for_update()
    )
    if not isinstance(order, Order) or order.payment_status == "paid":
        return {"status": "ignored"}
    try:
        verified = transaction_data(await BlaaizClient(settings).get_transaction(transaction_id))
        verified_status = str(verified.get("transaction_status") or verified.get("status") or "").upper()
        verified_reference = str(verified.get("merchant_reference") or "")
        verified_currency = str(verified.get("transaction_currency") or verified.get("currency") or "").upper()
        verified_amount = decimal_value(
            verified.get("transaction_amount") if verified.get("transaction_amount") is not None else verified.get("amount")
        )
    except BlaaizError:
        raise HTTPException(status_code=503, detail="Payment verification unavailable") from None
    if (
        verified_status != "SUCCESSFUL"
        or verified_reference != order.order_code
        or verified_currency != order.currency.upper()
        or verified_amount != Decimal(order.total)
    ):
        raise HTTPException(status_code=400, detail="Payment verification failed")
    order.payment_status = "paid"
    order.status = "processing"
    order.payment_transaction_id = transaction_id
    order.payment_confirmed_at = datetime.now(UTC)
    order.payment_confirmation_source = "blaaiz_webhook"
    session.commit()
    return {"status": "success", "event_id": event_id}
