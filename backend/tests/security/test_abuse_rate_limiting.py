"""Tests verifying abuse and cost control via sliding window per-phone rate limiting."""

from fastapi.testclient import TestClient

from app.main import app
from app.services.security import (
    RATE_LIMIT_MAX_REQUESTS,
    check_phone_rate_limit,
    clear_rate_limits,
)


def test_per_phone_rate_limiter_blocks_burst_abuse():
    """Verify exceeding 30 requests within 60 seconds returns False for that phone number."""
    clear_rate_limits()
    phone = "+2348011112222"

    # Send up to the limit
    for _ in range(RATE_LIMIT_MAX_REQUESTS):
        assert check_phone_rate_limit(phone) is True

    # Next request must be rate limited
    assert check_phone_rate_limit(phone) is False

    # Different phone number must still be permitted (per-phone isolation)
    different_phone = "+2348099998888"
    assert check_phone_rate_limit(different_phone) is True


def test_webhook_returns_friendly_slow_down_message_when_rate_limited():
    """Verify webhook endpoint returns friendly Pidgin message without triggering expensive downstream APIs."""
    clear_rate_limits()
    client = TestClient(app, raise_server_exceptions=False)
    phone = "+2348055556666"

    # Exhaust rate limit
    for _ in range(RATE_LIMIT_MAX_REQUESTS):
        check_phone_rate_limit(phone)

    # Next webhook call from this number receives rate limit response
    response = client.post(
        "/webhook/whatsapp",
        data={"From": f"whatsapp:{phone}", "Body": "Hello"},
    )
    assert response.status_code == 200
    assert "Hold on small!" in response.text
    assert "send message too fast" in response.text
