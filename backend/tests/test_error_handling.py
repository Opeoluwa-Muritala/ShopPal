"""Tests verifying structured logging, GET /api/logs/recent, and graceful webhook error recovery."""

from fastapi.testclient import TestClient

from app.logging_conf import log_db_write, log_external_call, recent_logs_buffer
from app.main import app

client = TestClient(app, raise_server_exceptions=False)
AUTH_HEADERS = {"X-Admin-API-Key": "demo_admin_secret_key"}


def test_logs_recent_endpoint_returns_buffered_logs():
    """Verify GET /api/logs/recent returns structured log entries with authentication."""
    recent_logs_buffer.clear()

    # Trigger some requests to populate logs
    client.get("/api/health")

    response = client.get("/api/logs/recent?limit=10", headers=AUTH_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert "logs" in data
    assert data["count"] > 0
    assert any("request_entry" in str(log.get("step", "")) for log in data["logs"])


def test_logs_helpers_record_external_calls_and_db_writes():
    """Verify log_external_call and log_db_write helpers record metrics in log buffer."""
    recent_logs_buffer.clear()

    # Log external call success & failure
    log_external_call(
        service="claude",
        operation="generate_reply",
        start_time=0.0,
        success=True,
        customer_phone="+2348012345678",
        extra={"model": "claude-3-5-sonnet"},
    )
    log_external_call(
        service="twilio",
        operation="send_whatsapp",
        start_time=0.0,
        success=False,
        customer_phone="+2348012345678",
        error=TimeoutError("Twilio gateway timeout"),
    )

    # Log DB write
    log_db_write(
        operation="insert",
        table="orders",
        start_time=0.0,
        success=True,
        customer_phone="+2348012345678",
    )

    logs = recent_logs_buffer.get_recent(limit=10)
    services = [log.get("service") for log in logs]
    assert "claude" in services
    assert "twilio" in services
    assert "database" in services


def test_webhook_unhandled_exception_returns_graceful_twilio_response():
    """
    Verify that an unhandled exception on a webhook route returns a graceful 200 response
    with TwiML (never raw 500) so Twilio does not trigger a retry-storm, and logs context.
    """
    recent_logs_buffer.clear()

    # Add a temporary failing webhook route to the app
    @app.post("/webhook/test-failing-webhook")
    def failing_webhook():
        raise RuntimeError("Simulated crash in webhook handler (e.g. Claude timeout)")

    # Execute request through client (with raise_server_exceptions=False)
    response = client.post("/webhook/test-failing-webhook")

    # Status must be 200 with TwiML XML to satisfy Twilio without retry-storming
    assert response.status_code == 200
    assert "Response" in response.text
    assert response.headers.get("content-type") == "application/xml"

    # Verify structured logs captured the unhandled exception
    logs = recent_logs_buffer.get_recent(limit=10)
    error_logs = [log for log in logs if log.get("level") == "ERROR"]
    assert len(error_logs) > 0
    assert error_logs[0].get("step") == "unhandled_exception"
    assert error_logs[0].get("error_type") == "RuntimeError"
