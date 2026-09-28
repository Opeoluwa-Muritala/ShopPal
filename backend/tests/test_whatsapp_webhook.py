import hashlib
import hmac
import json
from unittest.mock import Mock

from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import WhatsAppMessage
from app.main import app
from app.routers.whatsapp_webhook import _send_meta_message

VERIFY_TOKEN = "meta-verify-token"
APP_SECRET = "meta-app-secret"

SAMPLE_MESSAGE_PAYLOAD = {
    "object": "whatsapp_business_account",
    "entry": [
        {
            "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
            "changes": [
                {
                    "field": "messages",
                    "value": {
                        "messaging_product": "whatsapp",
                        "metadata": {
                            "display_phone_number": "15550555555",
                            "phone_number_id": "123456789",
                        },
                        "contacts": [
                            {
                                "profile": {"name": "Customer"},
                                "wa_id": "2348012345678",
                            }
                        ],
                        "messages": [
                            {
                                "from": "2348012345678",
                                "id": "wamid.test-message-1",
                                "timestamp": "1710000000",
                                "text": {"body": "Hello"},
                                "type": "text",
                            }
                        ],
                    },
                }
            ],
        }
    ],
}


def _settings():
    return Settings(
        _env_file=None,
        whatsapp_verify_token=VERIFY_TOKEN,
        whatsapp_app_secret=APP_SECRET,
    )


def _signed_body(payload):
    body = json.dumps(payload, separators=(",", ":")).encode()
    signature = "sha256=" + hmac.new(
        APP_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    return body, signature



def test_verification_handshake_accepts_valid_and_rejects_invalid_token():
    app.dependency_overrides[get_settings] = _settings
    client = TestClient(app, raise_server_exceptions=False)
    try:
        valid = client.get(
            "/webhooks/whatsapp",
            params={
                "hub.mode": "subscribe",
                "hub.challenge": "123456",
                "hub.verify_token": VERIFY_TOKEN,
            },
        )
        invalid = client.get(
            "/webhooks/whatsapp",
            params={
                "hub.mode": "subscribe",
                "hub.challenge": "123456",
                "hub.verify_token": "wrong",
            },
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert valid.status_code == 200
    assert valid.text == "123456"
    assert invalid.status_code == 403


def test_post_rejects_signature_mismatch():
    body, _ = _signed_body(SAMPLE_MESSAGE_PAYLOAD)
    app.dependency_overrides[get_settings] = _settings
    client = TestClient(app, raise_server_exceptions=False)
    try:
        response = client.post(
            "/webhooks/whatsapp",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": "sha256=forged",
            },
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 403


def test_send_meta_message_calls_graph_api_without_exposing_token(monkeypatch):
    response = Mock()
    post = Mock(return_value=response)
    monkeypatch.setattr("app.routers.whatsapp_webhook.httpx.post", post)
    settings = Settings(
        _env_file=None,
        whatsapp_access_token="secret-meta-token",
        whatsapp_phone_number_id="123456789",
    )

    _send_meta_message("2348012345678", "Hello from ShopPal", settings)

    response.raise_for_status.assert_called_once_with()
    post.assert_called_once_with(
        "https://graph.facebook.com/v23.0/123456789/messages",
        headers={"Authorization": "Bearer secret-meta-token"},
        json={
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": "2348012345678",
            "type": "text",
            "text": {"preview_url": False, "body": "Hello from ShopPal"},
        },
        timeout=20,
    )


def test_message_payload_persists_once_when_meta_redelivers(test_engine, monkeypatch):
    engine = test_engine
    monkeypatch.setattr("app.routers.whatsapp_webhook.get_engine", lambda: engine)
    with Session(engine) as session:
        session.execute(delete(WhatsAppMessage).where(
            WhatsAppMessage.message_id == "wamid.test-message-1"
        ))
        session.commit()

    body, signature = _signed_body(SAMPLE_MESSAGE_PAYLOAD)
    app.dependency_overrides[get_settings] = _settings
    client = TestClient(app, raise_server_exceptions=False)
    try:
        first = client.post(
            "/webhooks/whatsapp",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": signature,
            },
        )
        duplicate = client.post(
            "/webhooks/whatsapp",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": signature,
            },
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert first.status_code == 200
    assert duplicate.status_code == 200
    with Session(engine) as session:
        count = session.scalar(
            select(func.count()).select_from(WhatsAppMessage).where(
                WhatsAppMessage.message_id == "wamid.test-message-1"
            )
        )
        stored = session.scalar(
            select(WhatsAppMessage).where(
                WhatsAppMessage.message_id == "wamid.test-message-1"
            )
        )
    assert count == 1
    assert stored.body == "Hello"
    assert stored.status == "received"


def test_status_update_is_persisted(test_engine, monkeypatch):
    monkeypatch.setattr("app.routers.whatsapp_webhook.get_engine", lambda: test_engine)
    payload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
                "changes": [
                    {
                        "field": "messages",
                        "value": {
                            "statuses": [
                                {
                                    "id": "wamid.status-message-1",
                                    "status": "delivered",
                                    "timestamp": "1710000001",
                                    "recipient_id": "2348012345678",
                                }
                            ]
                        },
                    }
                ],
            }
        ],
    }
    body, signature = _signed_body(payload)
    app.dependency_overrides[get_settings] = _settings
    client = TestClient(app, raise_server_exceptions=False)
    try:
        response = client.post(
            "/webhooks/whatsapp",
            content=body,
            headers={"X-Hub-Signature-256": signature},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 200
    with Session(test_engine) as session:
        stored = session.scalar(
            select(WhatsAppMessage).where(
                WhatsAppMessage.message_id == "wamid.status-message-1"
            )
        )
    assert stored.status == "delivered"
    assert stored.message_type == "status"
