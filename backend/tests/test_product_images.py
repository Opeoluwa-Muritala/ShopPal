import asyncio
import io
import json
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import uuid4

import httpx
import pytest
from PIL import Image
from sqlalchemy.orm import Session

from app.config import Settings
from app.services import whatsapp
from app.services.product_images import ProductImageError, compress_product_image


def sample_image():
    buffer = io.BytesIO()
    Image.new("RGB", (2000, 1000), "red").save(buffer, "PNG")
    return buffer.getvalue()


def test_compress_and_strip_metadata():
    result = compress_product_image(sample_image(), "image/png")
    with Image.open(io.BytesIO(result)) as image:
        assert image.format == "JPEG"
        assert image.size == (1600, 800)
        assert not image.getexif()


@pytest.mark.parametrize("content,mime", [(b"<svg/>", "image/svg+xml"), (b"fake", "image/jpeg"), (b"", "image/png")])
def test_invalid_images_rejected(content, mime):
    with pytest.raises(ProductImageError):
        compress_product_image(content, mime)


def test_mime_mismatch_rejected():
    with pytest.raises(ProductImageError, match="does not match"):
        compress_product_image(sample_image(), "image/jpeg")


@pytest.fixture
def sender(monkeypatch):
    db = Mock(spec=Session)
    content = compress_product_image(sample_image(), "image/png")
    db.scalar.return_value = SimpleNamespace(content=content, mime_type="image/jpeg", wa_media_id="inbound-id")
    monkeypatch.setattr(whatsapp, "get_settings", lambda: Settings(_env_file=None, whatsapp_access_token="test-token", whatsapp_phone_number_id="123"))
    original = httpx.AsyncClient

    def install(handler):
        monkeypatch.setattr(whatsapp.httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    return db, content, install


@pytest.mark.parametrize("caption", [None, "Your perfume"])
def test_upload_then_send_fresh_image(sender, caption):
    db, content, install = sender
    calls = []

    def handle(request):
        calls.append(request)
        if request.url.path.endswith("/media"):
            assert "multipart/form-data" in request.headers["content-type"]
            assert content in request.content
            assert b' name="messaging_product"' in request.content
            assert b"whatsapp" in request.content
            return httpx.Response(200, json={"id": "fresh-upload-id"})
        payload = json.loads(request.content)
        assert payload["type"] == "image"
        assert payload["image"] == ({"id": "fresh-upload-id", "caption": caption} if caption is not None else {"id": "fresh-upload-id"})
        return httpx.Response(200, json={"messages": [{"id": "wamid.sent"}]})

    install(handle)
    for _ in range(2):
        result = asyncio.run(whatsapp.send_whatsapp_image_from_db(db, str(uuid4()), "+2348012345678", caption))
        assert result["messages"][0]["id"] == "wamid.sent"
    assert len(calls) == 4


@pytest.mark.parametrize("failed_stage", ["media", "messages"])
def test_meta_errors_logged_and_swallowed(sender, caplog, failed_stage):
    db, _, install = sender
    calls = []

    def handle(request):
        calls.append(request)
        if request.url.path.endswith("/" + failed_stage):
            return httpx.Response(400, json={"error": {"message": "Meta rejected image test-token"}})
        return httpx.Response(200, json={"id": "outbound"})

    install(handle)
    result = asyncio.run(whatsapp.send_whatsapp_image_from_db(db, str(uuid4()), "+2348012345678"))
    assert result["ok"] is False
    assert "Meta rejected image" in caplog.text
    assert "test-token" not in caplog.text
    assert len(calls) == (1 if failed_stage == "media" else 2)


def test_missing_media_raises(sender):
    db, _, _ = sender
    db.scalar.return_value = None
    with pytest.raises(LookupError, match="not found"):
        asyncio.run(whatsapp.send_whatsapp_image_from_db(db, str(uuid4()), "+2348012345678"))


def test_malformed_upload_response_is_handled(sender):
    db, _, install = sender
    install(lambda request: httpx.Response(200, json=[]))
    result = asyncio.run(whatsapp.send_whatsapp_image_from_db(db, str(uuid4()), "+2348012345678"))
    assert result["ok"] is False


def test_native_cta_url_payload_and_url_allowlist(monkeypatch):
    settings = Settings(_env_file=None, whatsapp_access_token="test-token", whatsapp_phone_number_id="123")
    original = httpx.AsyncClient

    def handler(request):
        payload = json.loads(request.content)
        assert payload["interactive"] == {
            "type": "cta_url",
            "body": {"text": "See our products"},
            "action": {
                "name": "cta_url",
                "parameters": {
                    "display_text": "Browse products",
                    "url": "https://wa.me/2349110501393?text=What%20do%20you%20sell%3F",
                },
            },
        }
        return httpx.Response(200, json={"messages": [{"id": "wamid.cta"}]})

    monkeypatch.setattr(whatsapp.httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    result = asyncio.run(whatsapp.send_whatsapp_cta_url(
        "2347064408491", "See our products", "Browse products",
        "https://wa.me/2349110501393?text=What%20do%20you%20sell%3F", settings,
    ))
    assert result["messages"][0]["id"] == "wamid.cta"

    with pytest.raises(ValueError, match="wa.me"):
        asyncio.run(whatsapp.send_whatsapp_cta_url(
            "2347064408491", "Unsafe", "Open", "https://evil.example/phish", settings,
        ))


def test_receipt_image_and_reply_buttons_are_sent_as_one_interactive_message(monkeypatch):
    settings = Settings(_env_file=None, whatsapp_access_token="test-token", whatsapp_phone_number_id="123")
    original = httpx.AsyncClient
    calls = []

    def handler(request):
        calls.append(request)
        if request.url.path.endswith("/media"):
            return httpx.Response(200, json={"id": "receipt-media-id"})
        payload = json.loads(request.content)
        assert payload["type"] == "interactive"
        assert payload["interactive"]["header"] == {
            "type": "image",
            "image": {"id": "receipt-media-id"},
        }
        assert payload["interactive"]["action"]["buttons"] == [
            {"type": "reply", "reply": {"id": "receipt_reorder:ord-1", "title": "Order again"}},
            {"type": "reply", "reply": {"id": "receipt_help:ord-1", "title": "Get help"}},
        ]
        return httpx.Response(200, json={"messages": [{"id": "wamid.receipt-cta"}]})

    monkeypatch.setattr(whatsapp.httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    result = asyncio.run(whatsapp.send_whatsapp_image_buttons_bytes(
        "2347064408491", sample_image(), "image/png", "Payment received",
        [("receipt_reorder:ord-1", "Order again"), ("receipt_help:ord-1", "Get help")], settings,
    ))
    assert result["messages"][0]["id"] == "wamid.receipt-cta"
    assert len(calls) == 2


def test_upload_api_stores_compressed_image_for_authenticated_vendor():
    from fastapi.testclient import TestClient

    from app.db.models import Product, WhatsAppMedia
    from app.db.session import get_db
    from app.main import app
    from app.services.auth import get_current_account

    vendor_id = uuid4()
    session = Mock(spec=Session)
    app.dependency_overrides[get_current_account] = lambda: SimpleNamespace(vendor_id=vendor_id)
    app.dependency_overrides[get_db] = lambda: session
    try:
        with TestClient(app) as client:
            result = client.post("/api/products/with-image", data={"name": "Perfume", "price": "1000", "stock": "2"}, files={"image": ("perfume.png", sample_image(), "image/png")})
        assert result.status_code == 201
        objects = [call.args[0] for call in session.add.call_args_list]
        media = next(obj for obj in objects if isinstance(obj, WhatsAppMedia))
        product = next(obj for obj in objects if isinstance(obj, Product))
        assert product.vendor_id == vendor_id
        assert product.image_media_id == media.id
        assert media.mime_type == "image/jpeg"
        with Image.open(io.BytesIO(media.content)) as image:
            assert image.size == (1600, 800)
        session.commit.assert_called_once()
    finally:
        app.dependency_overrides.pop(get_current_account, None)
        app.dependency_overrides.pop(get_db, None)


def test_product_image_tool_refuses_unavailable_product():
    from app.services.customer_tools import CustomerToolDispatcher

    db = Mock(spec=Session)
    db.scalar.return_value = None
    result = CustomerToolDispatcher(db, uuid4(), "2348012345678")("showProductImage", {"productId": str(uuid4())})
    assert "error" in result


def test_reply_worker_sends_stored_image(monkeypatch):
    from datetime import UTC, datetime
    from unittest.mock import AsyncMock

    from app.services import reply_recovery as recovery

    now = datetime.now(UTC)
    product = SimpleNamespace(id=uuid4(), image_media_id=uuid4())
    job = SimpleNamespace(id=uuid4(), vendor_id=uuid4(), phone_number_id="123", customer_phone="2348012345678", reply_text="Perfume", attempts=1, state="processing", created_at=now,
                          transcript=[{"action": {"tool": "showProductImage"}, "result": {"image_product_id": str(product.id), "caption": "Perfume"}}])
    db = Mock(spec=Session)
    db.scalar.side_effect = [now, product]
    monkeypatch.setattr(recovery, "checkpoint", lambda *args: None)
    sender = AsyncMock(return_value={"messages": [{"id": "wamid.image"}]})
    monkeypatch.setattr(recovery, "send_whatsapp_product_image_buttons", sender)
    settings = Settings(_env_file=None, whatsapp_access_token="test", whatsapp_phone_number_id="123")
    recovery.send_reply(db, job, "owner", settings)
    assert job.state == "accepted"
    assert job.outbound_message_id == "wamid.image"
    sender.assert_awaited_once_with(
        db,
        str(product.id),
        job.customer_phone,
        "Perfume",
        [(f"product_add:{product.id}", "Add to cart"), ("product_more", "More images")],
    )


@pytest.mark.parametrize("stock,expected", [(3, "in stock (3 available)"), (0, "out of stock"), (None, "couldn't confirm its stock")])
def test_image_match_availability_comes_from_catalog(stock, expected):
    from app.services.llm import LLMService

    service = LLMService(Settings(_env_file=None))
    service._post = Mock(return_value={"candidates": [{"content": {"parts": [{"text": json.dumps({"product_id": "p1", "confidence": "high", "stock": 999})}]}}]})
    reply = service.match_product_image(b"image", "image/jpeg", [{"id": "p1", "name": "Perfume", "price": "9000", "stock": stock}])
    assert expected in reply
    assert "999" not in reply
