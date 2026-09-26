"""Paystack transaction operations used by customer checkout."""

from __future__ import annotations

import json
import re
from decimal import Decimal, InvalidOperation
from typing import Any

import httpx

from app.config import Settings
from app.logging_conf import logger

PAYSTACK_API = "https://api.paystack.co"
PAYSTACK_CHECKOUT_HOST = "checkout.paystack.com"


class PaystackError(RuntimeError):
    """Raised when Paystack cannot initialize or verify a transaction."""


def _headers(settings: Settings) -> dict[str, str]:
    secret = settings.paystack_secret_key.get_secret_value()
    if not secret:
        raise PaystackError("Paystack is not configured")
    return {"Authorization": f"Bearer {secret}", "Content-Type": "application/json"}


def _amount_in_kobo(value: Decimal) -> int:
    try:
        amount = (value * 100).to_integral_exact()
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise PaystackError("Order total is invalid") from exc
    if amount <= 0:
        raise PaystackError("Order total must be positive")
    return int(amount)


def _customer_email(order_code: str) -> str:
    safe_code = re.sub(r"[^a-z0-9-]", "", order_code.lower())
    return f"{safe_code}@checkout.shoppal.app"


def initialize_transaction(
    *, order_code: str, amount: Decimal, customer_phone: str, settings: Settings
) -> dict[str, str]:
    """Create a Paystack checkout using the server-side order amount."""
    if not order_code or len(order_code) > 20:
        raise PaystackError("Invalid order reference")
    payload = {
        "email": _customer_email(order_code),
        "amount": str(_amount_in_kobo(amount)),
        "currency": "NGN",
        "reference": order_code,
        "metadata": json.dumps({"order_code": order_code, "customer_phone": customer_phone}),
    }
    try:
        response = httpx.post(
            f"{PAYSTACK_API}/transaction/initialize",
            headers=_headers(settings),
            json=payload,
            timeout=20,
        )
        response.raise_for_status()
        body: Any = response.json()
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        logger.warning(
            "Paystack transaction initialization failed",
            extra={"step": "paystack_initialize", "status": "failed", "error_type": type(exc).__name__},
        )
        raise PaystackError("Payment checkout is temporarily unavailable") from exc
    if not isinstance(body, dict) or body.get("status") is not True:
        raise PaystackError("Payment checkout is temporarily unavailable")
    data = body.get("data")
    url = data.get("authorization_url") if isinstance(data, dict) else None
    reference = data.get("reference") if isinstance(data, dict) else None
    if (
        not isinstance(url, str)
        or not url.startswith(f"https://{PAYSTACK_CHECKOUT_HOST}/")
        or not isinstance(reference, str)
        or reference != order_code
    ):
        raise PaystackError("Paystack returned an invalid checkout response")
    return {"authorization_url": url, "reference": reference}


def verify_transaction(reference: str, settings: Settings) -> dict[str, Any]:
    """Verify a transaction server-to-server before fulfilling an order."""
    if not reference or len(reference) > 120:
        raise PaystackError("Invalid payment reference")
    try:
        response = httpx.get(
            f"{PAYSTACK_API}/transaction/verify/{reference}",
            headers=_headers(settings),
            timeout=20,
        )
        response.raise_for_status()
        body: Any = response.json()
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise PaystackError("Payment verification is temporarily unavailable") from exc
    data = body.get("data") if isinstance(body, dict) else None
    if not isinstance(body, dict) or body.get("status") is not True or not isinstance(data, dict):
        raise PaystackError("Payment verification failed")
    return data
