"""Security utilities, validation, masking, and threat mitigations for Naija Marketplace."""

import base64
import csv
import hashlib
import hmac
import io
import ipaddress
import re
import time
from collections import defaultdict
from typing import Any
from urllib.parse import urlparse
from uuid import UUID

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy import select
from sqlalchemy.orm import Session

# Allowlisted domains for WhatsApp media downloads (SSRF protection)
ALLOWED_MEDIA_DOMAINS = {
    "api.twilio.com",
    "media.twiliocdn.com",
    "lookaside.fbsbx.com",
    "pps.whatsapp.net",
    "scontent.whatsapp.net",
    "scontent.xx.fbcdn.net",
}

# In-memory sliding window rate limiter: phone -> list of request timestamps
_rate_limits: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_WINDOW_SECONDS = 60.0
RATE_LIMIT_MAX_REQUESTS = 30

# In-memory idempotency store for Paystack events: event_id -> timestamp
_processed_events: dict[str, float] = {}

# Header scheme for vendor-scoped routes
api_key_header = APIKeyHeader(name="X-Vendor-API-Key", auto_error=False)
admin_key_header = APIKeyHeader(name="X-Admin-API-Key", auto_error=False)


# ============================================================================
# 1. PII & Secrets Masking
# ============================================================================

def mask_phone(phone: str | None) -> str:
    """Masks a phone number, preserving country code and last 4 digits (e.g. +23480****5678)."""
    if not phone:
        return ""
    clean = re.sub(r"[^\d+]", "", phone)
    if len(clean) <= 6:
        return "****"
    return clean[:6] + "****" + clean[-4:]


def mask_secret(secret: str | None) -> str:
    """Masks an API key or auth token, showing only prefix and last 4 chars."""
    if not secret:
        return ""
    s = str(secret)
    if len(s) <= 8:
        return "***"
    prefix = s[:7] if s.startswith(("sk_live_", "sk_test_", "pk_live_", "pk_test_")) else s[:3]
    return f"{prefix}***{s[-4:]}"


def sanitize_log_context(context: dict[str, Any]) -> dict[str, Any]:
    """Sanitizes sensitive keys in structured logging dictionary."""
    sanitized = dict(context)
    if "customer_phone" in sanitized:
        sanitized["customer_phone"] = mask_phone(str(sanitized["customer_phone"]))
    if "delivery_address" in sanitized:
        sanitized["delivery_address"] = "[REDACTED_PII]"
    for secret_key in ("paystack_key", "api_key", "secret", "token", "auth_token"):
        if secret_key in sanitized:
            sanitized[secret_key] = mask_secret(str(sanitized[secret_key]))
    return sanitized


# ============================================================================
# 2. Webhook Authenticity & Signature Verification
# ============================================================================

def verify_twilio_signature(
    auth_token: str,
    signature: str | None,
    url: str,
    form_params: dict[str, str],
) -> bool:
    """
    Validates Twilio X-Twilio-Signature using standard HMAC-SHA1.
    Sorts all POST parameters alphabetically, concatenates key and value to URL,
    computes HMAC-SHA1, and performs constant-time comparison.
    """
    if not signature or not auth_token:
        return False

    # Twilio signature spec: URL + sorted key-value pairs
    data_to_sign = url
    for key in sorted(form_params.keys()):
        data_to_sign += key + form_params[key]

    computed = base64.b64encode(
        hmac.new(auth_token.encode("utf-8"), data_to_sign.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")

    return hmac.compare_digest(computed, signature)


def verify_paystack_signature(
    secret_key: str,
    signature: str | None,
    raw_body: bytes,
) -> bool:
    """
    Validates Paystack x-paystack-signature using HMAC-SHA512.
    """
    if not signature or not secret_key:
        return False

    computed = hmac.new(
        secret_key.encode("utf-8"),
        raw_body,
        hashlib.sha512,
    ).hexdigest()

    return hmac.compare_digest(computed.lower(), signature.lower())


def is_paystack_event_processed(event_id: str) -> bool:
    """Checks whether an event reference or ID has already been handled (idempotency)."""
    return event_id in _processed_events


def mark_paystack_event_processed(event_id: str) -> None:
    """Registers an event reference as processed."""
    _processed_events[event_id] = time.time()


# ============================================================================
# 3. Media URL SSRF Protection
# ============================================================================

def validate_media_url(url: str) -> bool:
    """
    Validates that a media URL (MediaUrl0) is strictly from allowlisted domains
    and does not target internal IP addresses or arbitrary remote hosts (mitigates SSRF).
    """
    if not url:
        return False

    try:
        parsed = urlparse(url)
        if parsed.scheme.lower() != "https":
            return False

        hostname = (parsed.hostname or "").lower()
        if not hostname:
            return False

        # Reject private/loopback/link-local IP addresses
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                return False
        except ValueError:
            pass  # Hostname is a domain name, not an IP address

        # Reject localhost
        if hostname == "localhost":
            return False

        # Check against allowlisted domains (subdomains allowed)
        return any(
            hostname == domain or hostname.endswith("." + domain)
            for domain in ALLOWED_MEDIA_DOMAINS
        )
    except Exception:
        return False


# ============================================================================
# 4. CSV Upload Sanitization & Formula Injection Defense
# ============================================================================

MAX_CSV_SIZE_BYTES = 1024 * 1024  # 1 MB
MAX_CSV_ROWS = 1000
FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_csv_cell(value: str) -> str:
    """
    Sanitizes a CSV cell to prevent CSV Formula Injection (CWE-1236).
    If a cell begins with =, +, -, @, or whitespace command triggers,
    it is escaped by prefixing with a single quote (').
    """
    if not value:
        return ""
    val = value.strip()
    if val.startswith(FORMULA_PREFIXES):
        return "'" + val
    return val


def parse_and_sanitize_catalog_csv(content_bytes: bytes) -> list[dict[str, str]]:
    """
    Validates size, row count, UTF-8 encoding, and formula injection on CSV upload.
    Returns cleaned list of product dictionaries.
    """
    if len(content_bytes) > MAX_CSV_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"CSV file exceeds maximum allowed size of {MAX_CSV_SIZE_BYTES // 1024} KB",
        )

    try:
        text_content = content_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CSV file must be valid UTF-8 encoded text",
        ) from exc

    reader = csv.DictReader(io.StringIO(text_content))
    if not reader.fieldnames:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CSV file contains no valid header row",
        )

    required_fields = {"name", "price"}
    missing = required_fields - {f.strip().lower() for f in reader.fieldnames}
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"CSV missing required columns: {', '.join(missing)}",
        )

    products: list[dict[str, str]] = []
    for row_idx, raw_row in enumerate(reader, start=1):
        if row_idx > MAX_CSV_ROWS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"CSV file exceeds maximum limit of {MAX_CSV_ROWS} rows",
            )
        sanitized_row = {
            k.strip(): sanitize_csv_cell(v or "")
            for k, v in raw_row.items()
            if k is not None
        }
        products.append(sanitized_row)

    return products


# ============================================================================
# 5. Abuse / Rate Limiting (Per-Phone Number Sliding Window)
# ============================================================================

def check_phone_rate_limit(phone: str) -> bool:
    """
    Applies sliding window rate limit (30 requests/minute) per phone number.
    Returns True if request is allowed, False if rate limit exceeded.
    """
    now = time.time()
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS

    # Filter timestamps within current window
    timestamps = [ts for ts in _rate_limits[phone] if ts > cutoff]
    if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
        return False

    timestamps.append(now)
    _rate_limits[phone] = timestamps
    return True


def clear_rate_limits() -> None:
    """Testing helper to clear rate limit state."""
    _rate_limits.clear()


# ============================================================================
# 6. IDOR / Data Isolation (Vendor-Scoped API Key Verification)
# ============================================================================

def verify_vendor_access(
    vendor_id: UUID | str,
    api_key: str | None,
    session: Session,
) -> None:
    """
    Verifies that the provided X-Vendor-API-Key matches the requested vendor_id.
    Prevents IDOR live during demo. If key is missing or mismatched, raises 403.
    """
    from app.db.models import Vendor

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing required X-Vendor-API-Key header",
        )

    # Convert vendor_id to str
    target_id_str = str(vendor_id)

    # Query vendor by api_key or fallback check
    stmt = select(Vendor).where(Vendor.id == vendor_id)
    vendor = session.scalar(stmt)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    # Check vendor's configured api_key
    expected_key = getattr(vendor, "api_key", None)
    if not expected_key:
        # If vendor has no api_key set, match deterministic demo key
        expected_key = f"demo_key_{target_id_str[:8]}"

    if not hmac.compare_digest(api_key, expected_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Invalid API key for requested vendor",
        )
