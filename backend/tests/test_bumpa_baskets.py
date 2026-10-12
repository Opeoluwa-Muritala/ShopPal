"""Guest cart mutations use hand-written docs fixtures, never real APIs."""

import asyncio
import json
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
import respx

from app.integrations.bumpa.client import BumpaClient
from app.services import bumpa_baskets
from app.services.bumpa_checkout import CheckoutItem, CheckoutUnavailable
from tests.bumpa_fixture_loader import load_handwritten

BASE = "https://api.bumpa.xyz/api/commerce/v1"


def test_selection_quantity_remove_and_cancel_update_one_bumpa_cart(monkeypatch):
    with respx.mock(assert_all_called=True) as mock:
        create = mock.post(BASE + "/carts").respond(200, json=load_handwritten("cart_created.jsonc"))
        add = mock.post(BASE + "/carts/items").respond(200, json=load_handwritten("cart_item_added.jsonc"))
        patch = mock.patch(BASE + "/carts/items").respond(200, json={})
        delete = mock.delete(BASE + "/carts/items").respond(200, json={})
        clear = mock.delete(BASE + "/carts/clear").respond(200, json={})

        async def run():
            async with httpx.AsyncClient() as http:
                client = BumpaClient("https://api.bumpa.xyz", "doc-public", None, "loc-doc-1", http)
                monkeypatch.setattr(bumpa_baskets, "_client_for_merchant", AsyncMock(return_value=client))
                store = bumpa_baskets.BumpaBaskets(None, http, None)
                merchant = uuid4()
                first = CheckoutItem(product_id="product-doc-1", qty=1)
                other = CheckoutItem(product_id="product-doc-2", variation_id="variation-doc-1", qty=2)
                assert await store.sync(merchant, "customer-doc", [first]) == "cart-doc-1"
                await store.sync(merchant, "customer-doc", [first, other])
                await store.sync(merchant, "customer-doc", [first.model_copy(update={"qty": 3}), other])
                await store.sync(merchant, "customer-doc", [other])
                assert "guest-doc-token" not in repr(store.carts)
                await store.sync(merchant, "customer-doc", [])
                assert not store.carts

        asyncio.run(run())
    assert create.call_count == 1 and add.call_count == 2
    assert any(json.loads(call.request.content)["quantity"] == 3 for call in patch.calls)
    assert json.loads(delete.calls[0].request.content)["product_id"] == "product-doc-1"
    assert clear.call_count == 1
    for call in [*add.calls, *patch.calls, *delete.calls, *clear.calls]:
        assert call.request.headers["X-Cart-Token"] == "guest-doc-token"
        assert json.loads(call.request.content)["location_id"] == "loc-doc-1"


def test_concurrent_sync_is_idempotent_and_tokens_are_customer_scoped(monkeypatch):
    client = AsyncMock()
    client.create_cart.return_value = load_handwritten("cart_created.jsonc")
    client.add_cart_item.return_value = load_handwritten("cart_item_added.jsonc")
    monkeypatch.setattr(bumpa_baskets, "_client_for_merchant", AsyncMock(return_value=client))

    async def run():
        store = bumpa_baskets.BumpaBaskets(None, None, None)
        merchant = uuid4()
        items = [CheckoutItem(product_id="p1", qty=1)]
        await asyncio.gather(store.sync(merchant, "customer-a", items), store.sync(merchant, "customer-a", items))
        assert client.create_cart.await_count == client.add_cart_item.await_count == 1
        await store.sync(merchant, "customer-b", items)
        assert client.create_cart.await_count == 2
        store.carts[merchant, "customer-a"].updated_at = datetime.now(UTC) - timedelta(hours=25)
        await store.sync(merchant, "customer-b", items)
        assert (merchant, "customer-a") not in store.carts
        store.forget(merchant, "customer-b")
        assert not store.carts

    asyncio.run(run())


def test_failed_mutation_is_not_retried_and_next_attempt_uses_fresh_cart(monkeypatch):
    client = AsyncMock()
    client.create_cart.return_value = load_handwritten("cart_created.jsonc")
    client.add_cart_item.side_effect = [bumpa_baskets.BumpaUnavailable("Timeout"), load_handwritten("cart_item_added.jsonc")]
    monkeypatch.setattr(bumpa_baskets, "_client_for_merchant", AsyncMock(return_value=client))

    async def run():
        store = bumpa_baskets.BumpaBaskets(None, None, None)
        merchant = uuid4()
        items = [CheckoutItem(product_id="p1", qty=1)]
        with pytest.raises(CheckoutUnavailable):
            await store.sync(merchant, "customer-a", items)
        assert not store.carts and client.add_cart_item.await_count == 1
        await store.sync(merchant, "customer-a", items)
        assert client.create_cart.await_count == 2

    asyncio.run(run())
