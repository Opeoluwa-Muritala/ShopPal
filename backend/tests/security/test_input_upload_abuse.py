"""Tests verifying input/upload abuse mitigations (CSV formula injection, file size, SSRF on media URLs)."""

import pytest
from fastapi import HTTPException

from app.services.security import (
    MAX_CSV_SIZE_BYTES,
    parse_and_sanitize_catalog_csv,
    sanitize_csv_cell,
    validate_media_url,
)


def test_csv_formula_injection_is_sanitized():
    """
    CSV FORMULA INJECTION DEFENSE (CWE-1236):
    Cells starting with =, +, -, @, or tab characters that could trigger code execution
    in Microsoft Excel or Google Sheets are sanitized by prefixing with a single quote (').
    """
    dangerous_inputs = [
        "=cmd|' /C calc'!A0",
        "+1+1",
        "-2+3*4",
        "@SUM(A1:A10)",
        "\t=2+5",
    ]
    for payload in dangerous_inputs:
        sanitized = sanitize_csv_cell(payload)
        assert sanitized.startswith("'"), (
            f"Payload {payload} was not escaped with single quote"
        )

    safe_input = "Original Chelsea Boot"
    assert sanitize_csv_cell(safe_input) == "Original Chelsea Boot"


def test_csv_upload_rejects_oversized_file():
    """Verify CSV uploads exceeding 1MB are rejected with 413 Payload Too Large."""
    oversized_bytes = b"name,price\n" + (b"item,1000\n" * 120000)
    assert len(oversized_bytes) > MAX_CSV_SIZE_BYTES

    with pytest.raises(HTTPException) as exc:
        parse_and_sanitize_catalog_csv(oversized_bytes)
    assert exc.value.status_code == 413


def test_media_url_ssrf_rejects_arbitrary_domains_and_internal_ips():
    """
    SSRF DEFENSE:
    Ensures MediaUrl0 fetches are strictly restricted to official Twilio/Meta media domains.
    Internal IPs, cloud metadata endpoints, loopback, and random attacker domains must be blocked.
    """
    malicious_urls = [
        "http://169.254.169.254/latest/meta-data/",  # AWS metadata SSRF
        "https://127.0.0.1:8000/internal-admin",  # Localhost SSRF
        "https://localhost:9000/api",
        "https://192.168.1.1/router",
        "https://attacker-c2-server.com/malicious.ogg",
        "http://api.twilio.com/payload.wav",  # Insecure HTTP scheme
    ]
    for url in malicious_urls:
        assert validate_media_url(url) is False, (
            f"Malicious URL '{url}' should have been rejected"
        )


def test_media_url_ssrf_accepts_verified_twilio_and_meta_domains():
    """Verify legitimate Twilio and WhatsApp CDN media URLs are accepted."""
    legitimate_urls = [
        "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/MM123/Media/ME123",
        "https://media.twiliocdn.com/AC123/audio.ogg",
        "https://lookaside.fbsbx.com/whatsapp_business/media?id=12345",
        "https://pps.whatsapp.net/v/t61.24694-24/123_n.jpg",
    ]
    for url in legitimate_urls:
        assert validate_media_url(url) is True, (
            f"Legitimate URL '{url}' should have been accepted"
        )
