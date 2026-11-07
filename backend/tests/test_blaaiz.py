import hashlib
import hmac
import json
import time

import pytest
from pydantic import SecretStr, ValidationError

from app.config import Settings
from app.routers.blaaiz import CardCollectionRequest, verify_signature
from app.services.blaaiz import BlaaizClient, BlaaizError


def test_blaaiz_signature_checks_raw_body_and_timestamp():
    body = json.dumps({"event": "collection.completed"}, separators=(",", ":")).encode()
    timestamp = str(int(time.time()))
    signature = hmac.new(
        b"webhook-secret", timestamp.encode() + b"." + body, hashlib.sha256
    ).hexdigest()

    assert verify_signature(body, timestamp, signature, "webhook-secret") is True
    assert verify_signature(body + b" ", timestamp, signature, "webhook-secret") is False
    assert verify_signature(body, str(int(timestamp) - 301), signature, "webhook-secret") is False


def test_blaaiz_card_secrets_are_redacted():
    request = CardCollectionRequest(
        order_code="ORDER123",
        customer_id="customer-1",
        card_holder_name="Demo Customer",
        card_number="4242424242424242",
        expiry="12/30",
        cvc="123",
        phone="+2348012345678",
    )

    assert "4242424242424242" not in repr(request)
    assert "cvc='123'" not in repr(request)


@pytest.mark.parametrize(
    ("field", "value"),
    [("card_number", "4242"), ("cvc", "12"), ("expiry", "13/30")],
)
def test_blaaiz_rejects_malformed_card_fields(field, value):
    payload = {
        "order_code": "ORDER123",
        "customer_id": "customer-1",
        "card_holder_name": "Demo Customer",
        "card_number": "4242424242424242",
        "expiry": "12/30",
        "cvc": "123",
    }
    payload[field] = value
    with pytest.raises(ValidationError):
        CardCollectionRequest(**payload)


@pytest.mark.asyncio
async def test_blaaiz_resolves_active_ngn_wallet_when_not_configured(monkeypatch):
    client = BlaaizClient(
        Settings(
            blaaiz_client_id=SecretStr("client-id"),
            blaaiz_client_secret=SecretStr("client-secret"),
            blaaiz_wallet_id="",
        )
    )

    async def fake_request(method, path, *, payload=None):
        assert (method, path, payload) == ("GET", "/api/external/wallet", None)
        return [
            {"id": "wallet-cad", "currency": "CAD", "is_active": True},
            {"id": "wallet-ngn", "currency": "NGN", "is_active": True},
        ]

    monkeypatch.setattr(client, "_request", fake_request)
    assert await client.wallet_id() == "wallet-ngn"


@pytest.mark.asyncio
async def test_blaaiz_wallet_resolution_fails_on_ambiguous_ngn_wallets(monkeypatch):
    client = BlaaizClient(Settings(blaaiz_wallet_id=""))

    async def fake_request(method, path, *, payload=None):
        return [
            {"id": "wallet-one", "currency": "NGN", "is_active": True},
            {"id": "wallet-two", "currency": "NGN", "is_active": True},
        ]

    monkeypatch.setattr(client, "_request", fake_request)
    with pytest.raises(BlaaizError, match="exactly one active NGN"):
        await client.wallet_id()


@pytest.mark.asyncio
async def test_blaaiz_configured_wallet_skips_api_lookup(monkeypatch):
    client = BlaaizClient(Settings(blaaiz_wallet_id=" configured-wallet "))

    async def unexpected_request(*args, **kwargs):
        raise AssertionError("wallet API should not be called")

    monkeypatch.setattr(client, "_request", unexpected_request)
    assert await client.wallet_id() == "configured-wallet"
