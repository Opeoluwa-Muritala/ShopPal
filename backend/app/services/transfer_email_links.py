"""Short-lived, signed review links for transfer alert emails."""

import base64
import binascii
import hashlib
import hmac
import json
import time
from html import escape
from urllib.parse import urlsplit
from uuid import UUID

LINK_LIFETIME_SECONDS = 24 * 60 * 60


def _encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def public_origin(webhook_base_url: str) -> str:
    parsed = urlsplit(webhook_base_url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("A public HTTPS backend URL is required for email actions")
    return f"https://{parsed.netloc}"


def create_review_token(merchant_id: UUID, reference: str, action: str, secret: str, *, now: int | None = None) -> str:
    if action not in {"confirm", "reject"} or not reference.startswith("SHP-") or len(reference) > 20 or not secret:
        raise ValueError("Invalid transfer review link")
    payload = json.dumps({
        "merchant": str(merchant_id), "reference": reference, "action": action,
        "expires": (now if now is not None else int(time.time())) + LINK_LIFETIME_SECONDS,
    }, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.digest(secret.encode("utf-8"), payload, hashlib.sha256)
    return f"{_encode(payload)}.{_encode(signature)}"


def verify_review_token(token: str, secret: str, *, now: int | None = None) -> tuple[UUID, str, str]:
    if not secret or len(token) > 512 or token.count(".") != 1:
        raise ValueError("Invalid transfer review link")
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        payload = _decode(encoded_payload)
        signature = _decode(encoded_signature)
        expected = hmac.digest(secret.encode("utf-8"), payload, hashlib.sha256)
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid transfer review link")
        data = json.loads(payload)
        merchant_id = UUID(data["merchant"])
        reference = data["reference"]
        action = data["action"]
        expires = data["expires"]
        if (action not in {"confirm", "reject"} or not isinstance(reference, str)
                or not reference.startswith("SHP-") or len(reference) > 20
                or not isinstance(expires, int) or expires < (now if now is not None else int(time.time()))):
            raise ValueError("Invalid transfer review link")
        return merchant_id, reference, action
    except (KeyError, TypeError, UnicodeDecodeError, binascii.Error, json.JSONDecodeError, ValueError) as exc:
        raise ValueError("Invalid or expired transfer review link") from exc


def review_links(merchant_id: UUID, reference: str, webhook_base_url: str, secret: str) -> tuple[str, str]:
    origin = public_origin(webhook_base_url)
    return tuple(
        f"{origin}/email/transfers/{create_review_token(merchant_id, reference, action, secret)}"
        for action in ("confirm", "reject")
    )


def transfer_alert_html(reference: str, amount: str, claim: str, confirm_url: str, reject_url: str) -> str:
    reference, amount, claim = escape(reference), escape(amount), escape(claim)
    confirm_url, reject_url = escape(confirm_url, quote=True), escape(reject_url, quote=True)
    return (
        '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17212b;line-height:1.5">'
        '<div style="max-width:560px;margin:auto;padding:24px">'
        '<h1 style="font-size:24px">Review transfer payment</h1>'
        f'<p>Order <strong>{reference}</strong> received a {claim}. Amount: <strong>{amount}</strong>.</p>'
        '<p>A screenshot or payment claim is not proof of payment. Verify the full amount in your bank app first.</p>'
        '<p style="margin:28px 0">'
        f'<a href="{confirm_url}" style="background:#136b46;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px;margin-right:10px;display:inline-block">Confirm payment</a>'
        f'<a href="{reject_url}" style="background:#a83232;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px;display:inline-block">Reject payment</a>'
        '</p><p>Each button opens a review page. Your decision is recorded only after you submit it there.</p>'
        '</div></body></html>'
    )
