"""Flutterwave Standard checkout and server-side transaction verification."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import quote

import httpx

from app.config import Settings
from app.logging_conf import logger

FLUTTERWAVE_API = "https://api.flutterwave.com/v3"
FLUTTERWAVE_CHECKOUT_HOST = "checkout.flutterwave.com"


class FlutterwaveError(RuntimeError):
    """Raised when Flutterwave cannot initialize or verify a transaction."""


def _headers(settings: Settings) -> dict[str, str]:
    secret = settings.flutterwave_secret_key.get_secret_value()
    if not secret:
        raise FlutterwaveError("Flutterwave is not configured")
    return {"Authorization": f"Bearer {secret}", "Content-Type": "application/json"}


def _amount_in_minor_units(value: Decimal) -> int:
    try:
        amount = (value * 100).to_integral_exact()
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise FlutterwaveError("Order total is invalid") from exc
    if amount <= 0:
        raise FlutterwaveError("Order total must be positive")
    return int(amount)


def _customer_email(order_code: str) -> str:
    safe_code = "".join(ch for ch in order_code.lower() if ch.isalnum() or ch == "-")
    return f"{safe_code}@checkout.shoppal.app"


def initialize_transaction(
    *, order_code: str, amount: Decimal, customer_phone: str, subaccount_id: str, settings: Settings
) -> dict[str, str]:
    """Create a Flutterwave Standard hosted checkout using server-calculated totals."""
    if not order_code or len(order_code) > 20 or any(ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-" for ch in order_code):
        raise FlutterwaveError("Invalid order reference")
    if not subaccount_id or len(subaccount_id) > 80 or not subaccount_id.startswith("RS_"):
        raise FlutterwaveError("Vendor settlement account is not configured")
    payload = {
        "amount": _amount_in_minor_units(amount),
        "currency": "NGN",
        "tx_ref": order_code,
        "redirect_url": settings.flutterwave_redirect_url or "https://shoppal.app/payment/complete",
        "customer": {"email": _customer_email(order_code), "phone_number": customer_phone},
        "meta": {"order_code": order_code},
        "subaccounts": [{
            "id": subaccount_id,
            "transaction_charge_type": "percentage",
            "transaction_charge": settings.flutterwave_platform_fee_percent,
        }],
        "configuration": {"session_duration": 30, "max_retry_attempt": 5},
    }
    try:
        response = httpx.post(
            f"{FLUTTERWAVE_API}/payments",
            headers=_headers(settings),
            json=payload,
            timeout=20,
        )
        response.raise_for_status()
        body: Any = response.json()
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        logger.warning(
            "Flutterwave transaction initialization failed",
            extra={"step": "flutterwave_initialize", "status": "failed", "error_type": type(exc).__name__},
        )
        raise FlutterwaveError("Payment checkout is temporarily unavailable") from exc
    data = body.get("data") if isinstance(body, dict) else None
    url = data.get("link") if isinstance(data, dict) else None
    if not isinstance(body, dict) or body.get("status") != "success" or not isinstance(url, str):
        raise FlutterwaveError("Payment checkout is temporarily unavailable")
    parsed_host = url.split("/", 3)[:3]
    if parsed_host != ["https:", "", FLUTTERWAVE_CHECKOUT_HOST] or len(url) > 2048:
        raise FlutterwaveError("Flutterwave returned an invalid checkout response")
    return {"authorization_url": url, "reference": order_code}


def create_subaccount(*, bank_code: str, account_number: str, business_name: str, business_mobile: str, settings: Settings) -> str:
    """Create a vendor settlement subaccount once, returning its stable provider ID."""
    if not bank_code or len(bank_code) > 20 or not account_number.isdigit() or len(account_number) != 10:
        raise FlutterwaveError("Vendor settlement account is invalid")
    resolved_name = verify_bank_account(bank_code=bank_code, account_number=account_number, settings=settings)
    payload = {
        "account_bank": bank_code,
        "account_number": account_number,
        "business_name": (business_name or resolved_name)[:120],
        "business_mobile": business_mobile[:20],
        "country": "NG",
        "split_type": "percentage",
        "split_value": 1 - settings.flutterwave_platform_fee_percent,
    }
    try:
        response = httpx.post(f"{FLUTTERWAVE_API}/subaccounts", headers=_headers(settings), json=payload, timeout=20)
        response.raise_for_status()
        body: Any = response.json()
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise FlutterwaveError("Vendor settlement setup is temporarily unavailable") from exc
    data = body.get("data") if isinstance(body, dict) else None
    subaccount_id = data.get("subaccount_id") if isinstance(data, dict) else None
    if not isinstance(subaccount_id, str) or not subaccount_id.startswith("RS_"):
        raise FlutterwaveError("Flutterwave returned an invalid settlement account")
    return subaccount_id


def verify_bank_account(*, bank_code: str, account_number: str, settings: Settings) -> str:
    """Resolve a Nigerian bank account and return the provider-confirmed account name."""
    if not bank_code or not bank_code.isalnum() or not account_number.isdigit() or len(account_number) != 10:
        raise FlutterwaveError("Vendor settlement account is invalid")
    try:
        response = httpx.post(
            f"{FLUTTERWAVE_API}/accounts/resolve",
            headers=_headers(settings),
            json={"account_bank": bank_code, "account_number": account_number},
            timeout=20,
        )
        response.raise_for_status()
        body: Any = response.json()
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise FlutterwaveError("Vendor settlement verification is temporarily unavailable") from exc
    data = body.get("data") if isinstance(body, dict) else None
    account_name = data.get("account_name") if isinstance(data, dict) else None
    if not isinstance(body, dict) or body.get("status") != "success" or not isinstance(account_name, str) or not account_name.strip():
        raise FlutterwaveError("Flutterwave could not verify the vendor settlement account")
    return account_name.strip()


def verify_transaction(transaction_id: str, settings: Settings) -> dict[str, Any]:
    """Verify a Flutterwave transaction server-to-server before fulfilling an order."""
    if not transaction_id or len(transaction_id) > 120 or not transaction_id.isdigit():
        raise FlutterwaveError("Invalid payment transaction ID")
    try:
        response = httpx.get(
            f"{FLUTTERWAVE_API}/transactions/{quote(transaction_id, safe='')}/verify",
            headers=_headers(settings),
            timeout=20,
        )
        response.raise_for_status()
        body: Any = response.json()
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise FlutterwaveError("Payment verification is temporarily unavailable") from exc
    data = body.get("data") if isinstance(body, dict) else None
    if not isinstance(body, dict) or body.get("status") != "success" or not isinstance(data, dict):
        raise FlutterwaveError("Payment verification failed")
    return data
