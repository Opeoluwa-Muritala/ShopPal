"""Tests verifying Twilio & Paystack webhook authenticity, signatures, and idempotency."""

import base64
import hashlib
import hmac
import json
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import Settings, get_settings
from app.db.session import get_db
from app.main import app
from app.services.security import verify_paystack_signature, verify_twilio_signature


def get_test_settings():
    return Settings(
        _env_file=None,
        twilio_auth_token=SecretStr("super_secret_twilio_token_12345"),
        paystack_secret_key=SecretStr("sk_test_paystack_secret_key_abcde"),
    )


def test_forged_twilio_signature_is_rejected():
    """Verify forged/missing Twilio signature is rejected with 403."""
    app.dependency_overrides[get_settings] = get_test_settings
    client = TestClient(app, raise_server_exceptions=False)

    try:
        response = client.post(
            "/webhook/whatsapp",
            data={"From": "whatsapp:+2348011112222", "Body": "Hello"},
            headers={"X-Twilio-Signature": "invalid_forged_signature"},
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_valid_twilio_signature_is_accepted():
    """Verify authentic Twilio signature is verified and accepted."""
    auth_token = "super_secret_twilio_token_12345"
    url = "http://testserver/webhook/whatsapp"
    params = {"Body": "Hello", "From": "whatsapp:+2348011112222"}

    # Compute genuine signature per Twilio spec
    data_to_sign = url + "Body" + "Hello" + "From" + "whatsapp:+2348011112222"
    valid_sig = base64.b64encode(
        hmac.new(auth_token.encode("utf-8"), data_to_sign.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")

    assert verify_twilio_signature(auth_token, valid_sig, url, params) is True


def test_forged_paystack_signature_is_rejected():
    """Verify invalid Paystack signature is rejected with 401."""
    app.dependency_overrides[get_settings] = get_test_settings
    client = TestClient(app, raise_server_exceptions=False)

    try:
        payload = json.dumps({"event": "charge.success", "data": {"reference": "ORD-1234"}}).encode("utf-8")
        response = client.post(
            "/webhook/paystack",
            content=payload,
            headers={
                "x-paystack-signature": "bogus_signature_hex",
                "content-type": "application/json",
            },
        )
        assert response.status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_replayed_paystack_event_is_idempotent():
    """Verify replayed Paystack event is detected as duplicate and not re-processed."""
    app.dependency_overrides[get_settings] = get_test_settings
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        secret = "sk_test_paystack_secret_key_abcde"
        body_dict = {
            "id": 99887766,
            "event": "charge.success",
            "data": {"reference": "ORD-REPEAT-TEST"},
        }
        body_bytes = json.dumps(body_dict).encode("utf-8")
        valid_sig = hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha512).hexdigest()

        headers = {
            "x-paystack-signature": valid_sig,
            "content-type": "application/json",
        }

        # First request: processed
        r1 = client.post("/webhook/paystack", content=body_bytes, headers=headers)
        assert r1.status_code == 200
        assert r1.json()["status"] == "success"

        # Second request (replay): recognized as duplicate, order update skipped
        r2 = client.post("/webhook/paystack", content=body_bytes, headers=headers)
        assert r2.status_code == 200
        assert r2.json()["status"] == "ignored_duplicate"
    finally:
        app.dependency_overrides.clear()
