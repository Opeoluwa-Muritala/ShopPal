"""Tests verifying secrets and PII logging hygiene (phone masking, secret redaction, and protected log endpoint)."""

from fastapi.testclient import TestClient

from app.logging_conf import log_external_call, logger, recent_logs_buffer
from app.main import app


def test_phone_numbers_and_secrets_are_masked_in_logs():
    """Verify customer phone numbers and Paystack keys never appear unmasked in log outputs."""
    recent_logs_buffer.clear()

    raw_phone = "+2348012345678"
    raw_secret = "paystack_secret_sample_key_9988776655"

    # Trigger log line involving full phone and live secret
    log_external_call(
        service="paystack",
        operation="initialize_transaction",
        start_time=0.0,
        success=True,
        customer_phone=raw_phone,
        extra={"paystack_key": raw_secret},
    )

    logs = recent_logs_buffer.get_recent(limit=10)
    assert len(logs) > 0
    entry = logs[-1]

    # Phone must be masked: country code + **** + last 4 digits
    assert raw_phone not in str(entry)
    assert entry.get("customer_phone") == "+23480****5678"

    # Secret key must be masked
    assert raw_secret not in str(entry)
    assert "***" in str(entry.get("paystack_key"))


def test_logs_recent_endpoint_is_secured_with_api_key():
    """Verify GET /api/logs/recent rejects unauthenticated callers with 403."""
    client = TestClient(app, raise_server_exceptions=False)

    # Missing API key header -> 403 Forbidden
    unauth_res = client.get("/api/logs/recent")
    assert unauth_res.status_code == 403

    # Authenticated with X-Admin-API-Key -> 200 OK
    auth_res = client.get("/api/logs/recent", headers={"X-Admin-API-Key": "demo_admin_secret_key"})
    assert auth_res.status_code == 200
    assert "logs" in auth_res.json()
