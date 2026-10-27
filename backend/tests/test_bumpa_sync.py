"""A partial Bumpa sweep must never hide products already in Neon."""

import asyncio
from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock
from uuid import uuid4

import httpx
import respx
from cryptography.fernet import Fernet
from pydantic import SecretStr

from app.config import Settings
from app.integrations.bumpa.credentials import encrypt_credential
from app.services import bumpa_sync
from tests.bumpa_fixture_loader import load_handwritten


class FakeSession:
    statements = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def execute(self, statement):
        self.statements.append(str(statement))

    async def commit(self):
        return None

    async def rollback(self):
        return None

    async def get(self, *args):
        return None


def _settings_and_connection():
    settings = Settings(_env_file=None, key_encryption_secret=SecretStr(Fernet.generate_key().decode()))
    connection = SimpleNamespace(
        public_key_enc=encrypt_credential("doc-public", settings),
        secret_key_enc=None,
        location_id="loc-doc-1",
        status="active",
    )
    return settings, connection


def test_complete_sweep_pages_then_unpublishes(monkeypatch):
    merchant_id = uuid4()
    settings, connection = _settings_and_connection()
    FakeSession.statements = []
    upsert = AsyncMock()
    finish = AsyncMock()
    monkeypatch.setattr(bumpa_sync, "claim_sync", AsyncMock(return_value=True))
    monkeypatch.setattr(bumpa_sync, "get_connection", AsyncMock(return_value=connection))
    monkeypatch.setattr(bumpa_sync, "upsert_product_cache_batch", upsert)
    monkeypatch.setattr(bumpa_sync, "finish_sync", finish)
    with respx.mock(assert_all_called=True) as mock:
        route = mock.get("https://api.bumpa.xyz/api/commerce/v1/products").mock(
            side_effect=[
                httpx.Response(200, json=load_handwritten("products_one_hypothetical.jsonc")),
                httpx.Response(200, json=load_handwritten("products_empty.jsonc")),
            ]
        )

        async def run():
            async with httpx.AsyncClient() as http:
                return await bumpa_sync.sync_merchant_products(
                    merchant_id, session_factory=FakeSession, http_client=http, settings=settings
                )

        result = asyncio.run(run())
    assert result == bumpa_sync.SyncResult("succeeded", 1)
    assert route.call_count == 2
    assert route.calls[0].request.url.params["page"] == "1"
    assert route.calls[1].request.url.params["page"] == "2"
    assert upsert.await_count == 1
    assert upsert.await_args.args[1][0]["raw"] == {"id": "product-doc-1"}
    assert any("UPDATE products_cache" in sql for sql in FakeSession.statements)
    finish.assert_awaited_once_with(ANY, merchant_id)


def test_partial_failure_never_unpublishes(monkeypatch):
    merchant_id = uuid4()
    settings, connection = _settings_and_connection()
    FakeSession.statements = []
    upsert = AsyncMock()
    finish = AsyncMock()
    monkeypatch.setattr(bumpa_sync, "claim_sync", AsyncMock(return_value=True))
    monkeypatch.setattr(bumpa_sync, "get_connection", AsyncMock(return_value=connection))
    monkeypatch.setattr(bumpa_sync, "upsert_product_cache_batch", upsert)
    monkeypatch.setattr(bumpa_sync, "finish_sync", finish)
    with respx.mock(assert_all_called=True) as mock:
        route = mock.get("https://api.bumpa.xyz/api/commerce/v1/products").mock(
            side_effect=[
                httpx.Response(200, json=load_handwritten("products_one_hypothetical.jsonc")),
                httpx.Response(503), httpx.Response(503), httpx.Response(503),
            ]
        )

        async def run():
            async with httpx.AsyncClient() as http:
                return await bumpa_sync.sync_merchant_products(
                    merchant_id, session_factory=FakeSession, http_client=http, settings=settings
                )

        result = asyncio.run(run())
    assert result == bumpa_sync.SyncResult("failed", 1)
    assert route.call_count == 4
    assert upsert.await_count == 1
    assert not any("UPDATE products_cache" in sql for sql in FakeSession.statements)
    finish.assert_awaited_once_with(ANY, merchant_id, error="BumpaUnavailable")


def test_concurrent_claim_is_rejected_before_fetch(monkeypatch):
    settings, _connection = _settings_and_connection()
    merchant_id = uuid4()
    monkeypatch.setattr(bumpa_sync, "claim_sync", AsyncMock(return_value=False))
    connection_lookup = AsyncMock()
    monkeypatch.setattr(bumpa_sync, "get_connection", connection_lookup)

    async def run():
        async with httpx.AsyncClient() as http:
            return await bumpa_sync.sync_merchant_products(
                merchant_id, session_factory=FakeSession, http_client=http, settings=settings
            )

    assert asyncio.run(run()) == bumpa_sync.SyncResult("already_running")
    connection_lookup.assert_not_awaited()


def test_live_product_404_hides_stale_cache_entry(monkeypatch):
    settings, connection = _settings_and_connection()
    merchant_id = uuid4()
    cached = SimpleNamespace(is_published=False)
    FakeSession.statements = []
    monkeypatch.setattr(bumpa_sync, "get_connection", AsyncMock(return_value=connection))
    monkeypatch.setattr(bumpa_sync, "get_cached_product", AsyncMock(return_value=cached))

    async def run():
        async with httpx.AsyncClient() as http:
            return await bumpa_sync.refresh_product_live(
                merchant_id, "removed-product", session_factory=FakeSession,
                http_client=http, settings=settings,
            )

    with respx.mock(assert_all_called=True) as mock:
        mock.get("https://api.bumpa.xyz/api/commerce/v1/products/removed-product").mock(return_value=httpx.Response(404))
        product, cached_only = asyncio.run(run())
    assert product is cached
    assert cached_only is False
    assert any("UPDATE products_cache" in statement for statement in FakeSession.statements)
