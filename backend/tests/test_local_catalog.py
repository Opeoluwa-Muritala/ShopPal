"""Catalog caching must not leak merchants or skip items between menu pages."""

import asyncio
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql

from app.db.bumpa_repository import upsert_product_cache_batch
from app.services import bumpa_conversation as conversation
from app.services.scarf_collections import (
    category_map,
    collection_for_reply,
    collection_names,
    product_collections,
)


def product(number, **overrides):
    return SimpleNamespace(**{
        "bumpa_product_id": str(number), "name": f"Scarf {number}",
        "price": Decimal("100"), "currency": "NGN", "stock_qty": 3,
        "image_urls": [], "variations": [], "description": "", "raw": {},
        **overrides,
    })


def test_reviewed_categories_are_local_and_shop_scoped():
    mapping = category_map()
    assert len(mapping) == 155
    assert len(collection_names()) == 17
    assert "Unplaced" not in collection_names()
    name, categories = next(iter(mapping.items()))
    assert product_collections("AvAia by Aminat", name.upper(), {}) == list(categories)
    assert product_collections("Another Shop", name, {"collections": ["Other"]}) == ["Other"]


def test_collection_replies_survive_reordering_and_reject_invalid_choices():
    assert collection_for_reply("1") == "Ombre Scarves"
    assert collection_for_reply("name:Ombre Scarves") == "Ombre Scarves"
    for value in ("-1", "10000", "name:Unknown", "invalid"):
        with pytest.raises(ValueError):
            collection_for_reply(value)


def test_browse_cache_coalesces_queries_expires_and_separates_merchants(monkeypatch):
    ticks = [0]
    monkeypatch.setattr(conversation, "monotonic", lambda: ticks[0])
    statements = []

    class Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def scalars(self, query):
            statements.append(query)
            await asyncio.sleep(0)
            return SimpleNamespace(all=lambda: [product(len(statements))])

    handler = object.__new__(conversation.BumpaConversation)
    handler._sessions = Session
    first, second = uuid4(), uuid4()

    async def run():
        a, b = await asyncio.gather(handler._browse_products(first), handler._browse_products(first))
        assert a is b
        assert len(statements) == 1
        assert first in statements[0].compile().params.values()
        other = await handler._browse_products(second)
        assert other[0].bumpa_product_id != a[0].bumpa_product_id
        assert len(statements) == 2
        ticks[0] = 61
        assert await handler._browse_products(first) is not a
        assert len(statements) == 3

    asyncio.run(run())


def test_category_menu_uses_no_inventory_query_and_pagination_skips_nothing():
    handler = object.__new__(conversation.BumpaConversation)
    handler._state = AsyncMock(return_value=SimpleNamespace())
    handler._set_state = AsyncMock()
    handler._browse_products = AsyncMock(return_value=[product(i) for i in range(20)])
    merchant = SimpleNamespace(id=uuid4(), business_name="avaiabyaminat")
    client = SimpleNamespace(send_list=AsyncMock(), send_text=AsyncMock())

    async def run():
        await handler._menu(merchant, "customer", client)
        handler._browse_products.assert_not_awaited()
        assert len(client.send_list.await_args.args[2]) == 10
        displayed = []
        for page in range(3):
            await handler._menu(merchant, "customer", client, page=page, search="Scarf")
            displayed.extend(row[0] for row in client.send_list.await_args.args[2] if row[0].startswith("product:"))
        assert displayed == [f"product:{i}" for i in range(20)]

    asyncio.run(run())


def test_category_selection_uses_csv_even_when_provider_omits_labels():
    handler = object.__new__(conversation.BumpaConversation)
    handler._state = AsyncMock(return_value=SimpleNamespace())
    handler._set_state = AsyncMock()
    name, labels = next((name, labels) for name, labels in category_map().items() if labels[0] != "Unplaced")
    handler._browse_products = AsyncMock(return_value=[product(1, name=name), product(2)])
    client = SimpleNamespace(send_list=AsyncMock(), send_text=AsyncMock())
    merchant = SimpleNamespace(id=uuid4(), business_name="avaiabyaminat")
    asyncio.run(handler._menu(merchant, "customer", client, search=labels[0]))
    assert [row[0] for row in client.send_list.await_args.args[2]] == ["product:1"]


def test_bulk_upsert_is_one_parameterized_statement():
    session = SimpleNamespace(execute=AsyncMock())
    merchant_id = uuid4()
    rows = [{"merchant_id": merchant_id, "bumpa_product_id": str(i),
             "raw": {"name": "'; DROP TABLE vendors; --"}} for i in range(50)]
    asyncio.run(upsert_product_cache_batch(session, rows))
    session.execute.assert_awaited_once()
    compiled = session.execute.await_args.args[0].compile(dialect=postgresql.dialect())
    assert "DROP TABLE" not in str(compiled)
    assert "ON CONFLICT (merchant_id, bumpa_product_id) DO UPDATE" in str(compiled)
    assert "coalesce(excluded.raw" in str(compiled)
