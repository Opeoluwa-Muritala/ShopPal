"""Owner onboarding uses mocked Bumpa responses and never echoes credentials."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import httpx
import respx
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import Settings, get_settings
from app.db.models import SyncState, Vendor
from app.db.session import get_async_db
from app.integrations.bumpa.credentials import decrypt_credential
from app.main import app
from app.routers import bumpa_merchants
from app.services.auth import get_current_account
from tests.bumpa_fixture_loader import load_handwritten


def _session(vendor):
    session = SimpleNamespace()
    session.get = AsyncMock(side_effect=lambda model, _id: vendor if model is Vendor else None)
    session.add = Mock()
    session.commit = AsyncMock()
    session.delete = AsyncMock()
    return session


def test_connect_validates_both_keys_and_stores_ciphertext(monkeypatch):
    merchant_id = uuid4()
    vendor = SimpleNamespace(id=merchant_id, catalog_provider="legacy")
    session = _session(vendor)
    settings = Settings(_env_file=None, key_encryption_secret=SecretStr(Fernet.generate_key().decode()))
    monkeypatch.setattr(bumpa_merchants, "get_connection", AsyncMock(return_value=None))
    app.dependency_overrides[get_current_account] = lambda: SimpleNamespace(vendor_id=merchant_id, role="owner")
    app.dependency_overrides[get_async_db] = lambda: session
    app.dependency_overrides[get_settings] = lambda: settings
    http = httpx.AsyncClient()
    app.dependency_overrides[bumpa_merchants.get_bumpa_http_client] = lambda: http
    try:
        with respx.mock(assert_all_called=True) as mock:
            product_route = mock.get("https://api.bumpa.xyz/api/commerce/v1/products").respond(200, json=load_handwritten("products_empty.jsonc"))
            order_route = mock.get("https://api.bumpa.xyz/api/commerce/v1/orders").respond(200, json=load_handwritten("orders_empty.jsonc"))
            response = TestClient(app).post(
                f"/merchants/{merchant_id}/bumpa/connect",
                json={"public_key": "public-test-only", "secret_key": "secret-test-only", "location_id": "loc-1"},
            )
        assert response.status_code == 200
        assert response.json() == {"status": "active", "location_id": "loc-1"}
        assert product_route.calls[0].request.headers["X-Api-Key"] == "public-test-only"
        assert order_route.calls[0].request.headers["X-Api-Key"] == "secret-test-only"
        connection = next(call.args[0] for call in session.add.call_args_list if not isinstance(call.args[0], SyncState))
        assert decrypt_credential(connection.public_key_enc, settings) == "public-test-only"
        assert decrypt_credential(connection.secret_key_enc, settings) == "secret-test-only"
        assert "public-test-only" not in response.text
        assert "secret-test-only" not in response.text
        assert vendor.catalog_provider == "bumpa"
        session.commit.assert_awaited_once()
    finally:
        app.dependency_overrides.pop(get_current_account, None)
        app.dependency_overrides.pop(get_async_db, None)
        app.dependency_overrides.pop(get_settings, None)
        app.dependency_overrides.pop(bumpa_merchants.get_bumpa_http_client, None)
        import asyncio

        asyncio.run(http.aclose())


def test_connect_rejects_wrong_public_key_without_storing_it(monkeypatch):
    merchant_id = uuid4()
    vendor = SimpleNamespace(id=merchant_id, catalog_provider="legacy")
    session = _session(vendor)
    app.dependency_overrides[get_current_account] = lambda: SimpleNamespace(vendor_id=merchant_id, role="owner")
    app.dependency_overrides[get_async_db] = lambda: session
    http = httpx.AsyncClient()
    app.dependency_overrides[bumpa_merchants.get_bumpa_http_client] = lambda: http
    try:
        with respx.mock(assert_all_called=True) as mock:
            mock.get("https://api.bumpa.xyz/api/commerce/v1/products").respond(401)
            response = TestClient(app).post(
                f"/merchants/{merchant_id}/bumpa/connect",
                json={"public_key": "bad-public-key", "location_id": "loc-1"},
            )
        assert response.status_code == 400
        assert "public key" in response.text
        assert "bad-public-key" not in response.text
        session.commit.assert_not_awaited()
    finally:
        app.dependency_overrides.pop(get_current_account, None)
        app.dependency_overrides.pop(get_async_db, None)
        app.dependency_overrides.pop(bumpa_merchants.get_bumpa_http_client, None)
        import asyncio

        asyncio.run(http.aclose())


def test_other_merchant_and_staff_cannot_connect():
    merchant_id = uuid4()
    app.dependency_overrides[get_current_account] = lambda: SimpleNamespace(vendor_id=uuid4(), role="owner")
    app.dependency_overrides[get_async_db] = lambda: SimpleNamespace()
    app.dependency_overrides[bumpa_merchants.get_bumpa_http_client] = lambda: Mock()
    try:
        response = TestClient(app).post(f"/merchants/{merchant_id}/bumpa/connect", json={"public_key": "key", "location_id": "loc"})
        assert response.status_code == 404
        app.dependency_overrides[get_current_account] = lambda: SimpleNamespace(vendor_id=merchant_id, role="staff")
        response = TestClient(app).post(f"/merchants/{merchant_id}/bumpa/connect", json={"public_key": "key", "location_id": "loc"})
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_account, None)
        app.dependency_overrides.pop(get_async_db, None)
        app.dependency_overrides.pop(bumpa_merchants.get_bumpa_http_client, None)


def test_optional_secret_key_skips_order_probe(monkeypatch):
    merchant_id = uuid4()
    vendor = SimpleNamespace(id=merchant_id, catalog_provider="legacy")
    session = _session(vendor)
    settings = Settings(_env_file=None, key_encryption_secret=SecretStr(Fernet.generate_key().decode()))
    monkeypatch.setattr(bumpa_merchants, "get_connection", AsyncMock(return_value=None))
    app.dependency_overrides[get_current_account] = lambda: SimpleNamespace(vendor_id=merchant_id, role="owner")
    app.dependency_overrides[get_async_db] = lambda: session
    app.dependency_overrides[get_settings] = lambda: settings
    http = httpx.AsyncClient()
    app.dependency_overrides[bumpa_merchants.get_bumpa_http_client] = lambda: http
    try:
        with respx.mock(assert_all_called=True) as mock:
            mock.get("https://api.bumpa.xyz/api/commerce/v1/products").respond(200, json=load_handwritten("products_empty.jsonc"))
            response = TestClient(app).post(
                f"/merchants/{merchant_id}/bumpa/connect",
                json={"public_key": "public-test-only", "location_id": "loc-1"},
            )
        assert response.status_code == 200
        connection = next(call.args[0] for call in session.add.call_args_list if not isinstance(call.args[0], SyncState))
        assert connection.secret_key_enc is None
    finally:
        app.dependency_overrides.pop(get_current_account, None)
        app.dependency_overrides.pop(get_async_db, None)
        app.dependency_overrides.pop(get_settings, None)
        app.dependency_overrides.pop(bumpa_merchants.get_bumpa_http_client, None)
        import asyncio

        asyncio.run(http.aclose())


def test_connect_rejects_wrong_secret_key_without_commit():
    merchant_id = uuid4()
    vendor = SimpleNamespace(id=merchant_id, catalog_provider="legacy")
    session = _session(vendor)
    app.dependency_overrides[get_current_account] = lambda: SimpleNamespace(vendor_id=merchant_id, role="owner")
    app.dependency_overrides[get_async_db] = lambda: session
    http = httpx.AsyncClient()
    app.dependency_overrides[bumpa_merchants.get_bumpa_http_client] = lambda: http
    try:
        with respx.mock(assert_all_called=True) as mock:
            mock.get("https://api.bumpa.xyz/api/commerce/v1/products").respond(200, json=load_handwritten("products_empty.jsonc"))
            mock.get("https://api.bumpa.xyz/api/commerce/v1/orders").respond(401)
            response = TestClient(app).post(
                f"/merchants/{merchant_id}/bumpa/connect",
                json={"public_key": "public-test-only", "secret_key": "bad-secret-key", "location_id": "loc-1"},
            )
        assert response.status_code == 400
        assert "secret key" in response.text
        assert "bad-secret-key" not in response.text
        session.commit.assert_not_awaited()
    finally:
        app.dependency_overrides.pop(get_current_account, None)
        app.dependency_overrides.pop(get_async_db, None)
        app.dependency_overrides.pop(bumpa_merchants.get_bumpa_http_client, None)
        import asyncio

        asyncio.run(http.aclose())


def test_payout_details_are_validated_and_not_echoed():
    merchant_id = uuid4()
    vendor = SimpleNamespace(id=merchant_id)
    session = _session(vendor)
    app.dependency_overrides[get_current_account] = lambda: SimpleNamespace(vendor_id=merchant_id, role="owner")
    app.dependency_overrides[get_async_db] = lambda: session
    try:
        client = TestClient(app)
        path = f"/merchants/{merchant_id}/payout-details"
        invalid = client.put(path, json={"bank_name": "Bank", "account_name": "Owner", "account_number": "123"})
        assert invalid.status_code == 422
        valid = client.put(path, json={"bank_name": "Bank", "account_name": "Owner", "account_number": "1234567890"})
        assert valid.status_code == 200
        assert valid.json() == {"status": "configured"}
        assert "1234567890" not in valid.text
        assert vendor.payout_account_number == "1234567890"
    finally:
        app.dependency_overrides.pop(get_current_account, None)
        app.dependency_overrides.pop(get_async_db, None)
