"""Isolated webhook intake tests; no Meta or Bumpa network calls."""

import hashlib
import hmac
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.integrations.whatsapp.client import MetaWhatsAppClient
from app.main import app
from app.services import bumpa_whatsapp
from tests.test_whatsapp_webhook import APP_SECRET, SAMPLE_MESSAGE_PAYLOAD, _settings


class FakeSession:
    def __init__(self, merchant):
        self.merchant = merchant
        self.commits = 0
        self.rollbacks = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def get(self, *_args):
        return self.merchant

    async def execute(self, *_args):
        return None

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1

    async def scalar(self, *_args):
        return getattr(self, "scalar_value", None)

    async def scalars(self, *_args):
        return SimpleNamespace(all=lambda: [])


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_bumpa_intake_deduplicates_and_respects_stop(monkeypatch):
    merchant_id = uuid4()
    merchant = SimpleNamespace(id=merchant_id, catalog_provider="bumpa", is_active=True)
    session = FakeSession(merchant)
    seen = set()

    async def record(_session, message_id):
        if message_id in seen:
            return False
        seen.add(message_id)
        return True

    monkeypatch.setattr(bumpa_whatsapp, "record_processed_message", record)
    monkeypatch.setattr(bumpa_whatsapp, "_rate_allowed", AsyncMock(return_value=True))
    handler = AsyncMock()
    stop = {"id": "wamid.stop", "from": "2348012345678", "type": "text", "text": {"body": "STOP"}}
    assert await bumpa_whatsapp.process_bumpa_message(merchant_id, stop, session_factory=lambda: session, handler=handler) == "opted_out"
    assert await bumpa_whatsapp.process_bumpa_message(merchant_id, stop, session_factory=lambda: session, handler=handler) == "duplicate"
    handler.assert_not_awaited()
    assert session.rollbacks == 1
    message = {**stop, "id": "wamid.resume", "text": {"body": "hello"}}
    assert await bumpa_whatsapp.process_bumpa_message(merchant_id, message, session_factory=lambda: session, handler=handler) == "processed"
    handler.assert_awaited_once_with(merchant, message)


@pytest.mark.anyio
async def test_bumpa_intake_rate_limit_does_not_call_handler(monkeypatch):
    merchant_id = uuid4()
    merchant = SimpleNamespace(id=merchant_id, catalog_provider="bumpa", is_active=True)
    session = FakeSession(merchant)
    monkeypatch.setattr(bumpa_whatsapp, "record_processed_message", AsyncMock(return_value=True))
    monkeypatch.setattr(bumpa_whatsapp, "_rate_allowed", AsyncMock(return_value=False))
    handler = AsyncMock()
    result = await bumpa_whatsapp.process_bumpa_message(
        merchant_id, {"id": "wamid.rate", "from": "2348012345678", "type": "text", "text": {"body": "hello"}},
        session_factory=lambda: session, handler=handler,
    )
    assert result == "rate_limited"
    handler.assert_not_awaited()


@pytest.mark.anyio
async def test_rate_window_allows_twenty_messages_and_caps_open_refs():
    session = FakeSession(None)
    session.scalar_value = SimpleNamespace(payload={}, updated_at=None)
    merchant_id = uuid4()
    for _ in range(20):
        assert await bumpa_whatsapp._rate_allowed(session, merchant_id, "2348012345678")
    assert not await bumpa_whatsapp._rate_allowed(session, merchant_id, "2348012345678")
    session.scalar_value = 2
    assert await bumpa_whatsapp.has_open_capacity(session, merchant_id, "2348012345678", kind="checkout")
    session.scalar_value = 3
    assert not await bumpa_whatsapp.has_open_capacity(session, merchant_id, "2348012345678", kind="transfer")


@pytest.mark.anyio
async def test_unknown_phone_number_is_ignored():
    session = FakeSession(None)
    legacy, bumpa = await bumpa_whatsapp.classify_events(
        SAMPLE_MESSAGE_PAYLOAD, session_factory=lambda: session, legacy_phone_number_id="987654321",
    )
    assert legacy["entry"] == []
    assert bumpa == []


def test_signed_bumpa_webhook_routes_without_legacy_persistence(monkeypatch):
    merchant_id = uuid4()
    captured = AsyncMock(return_value="processed")

    async def classify(payload, **_kwargs):
        return {**payload, "entry": []}, [(merchant_id, SAMPLE_MESSAGE_PAYLOAD["entry"][0]["changes"][0]["value"]["messages"][0])]

    monkeypatch.setattr("app.routers.whatsapp_webhook.classify_events", classify)
    monkeypatch.setattr("app.routers.whatsapp_webhook.process_bumpa_message", captured)
    monkeypatch.setattr("app.routers.whatsapp_webhook.get_async_session_factory", lambda: None)
    legacy = AsyncMock()
    monkeypatch.setattr("app.routers.whatsapp_webhook.process_whatsapp_payload", legacy)
    previous = getattr(app.state, "bumpa_webhook_enabled", False)
    app.state.bumpa_webhook_enabled = True
    app.dependency_overrides[get_settings] = _settings
    body = json.dumps(SAMPLE_MESSAGE_PAYLOAD).encode()
    signature = "sha256=" + hmac.new(APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
    try:
        response = TestClient(app, raise_server_exceptions=False).post(
            "/webhooks/whatsapp", content=body,
            headers={"Content-Type": "application/json", "X-Hub-Signature-256": signature},
        )
    finally:
        app.state.bumpa_webhook_enabled = previous
        app.dependency_overrides.pop(get_settings, None)
    assert response.status_code == 200
    captured.assert_awaited_once()
    legacy.assert_not_awaited()


@pytest.mark.anyio
async def test_meta_client_sends_only_expected_payload_and_token_header():
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(200, json={"messages": [{"id": "wamid.sent"}]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        client = MetaWhatsAppClient("https://graph.facebook.com/v23.0", "123456789", "secret-token", http)
        await client.send_buttons("2348012345678", "Choose", [("pay", "Pay online")])
    assert len(requests) == 1
    assert requests[0].headers["Authorization"] == "Bearer secret-token"
    payload = json.loads(requests[0].content)
    assert payload["interactive"]["action"]["buttons"][0]["reply"]["id"] == "pay"
    assert "secret-token" not in requests[0].content.decode()


@pytest.mark.anyio
async def test_meta_read_and_typing_uses_inbound_id_without_customer_text():
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(200, json={"success": True})

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
        client = MetaWhatsAppClient("https://graph.facebook.com/v25.0", "123456789", "secret-token", http)
        await client.mark_read_and_typing("wamid.inbound")
    assert json.loads(requests[0].content) == {
        "messaging_product": "whatsapp", "status": "read", "message_id": "wamid.inbound",
        "typing_indicator": {"type": "text"},
    }
    assert "secret-token" not in requests[0].content.decode()
