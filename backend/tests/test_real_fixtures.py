"""Replay opt-in staging captures after the merchant runs the probe script."""

import json
from pathlib import Path
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.integrations.bumpa import mappers
from app.services import bumpa_sync

REAL = Path(__file__).parent / "fixtures" / "bumpa" / "real"
CAPTURES = tuple(sorted(REAL.glob("*.json"))) if REAL.exists() else ()


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
@pytest.mark.skipif(not CAPTURES, reason="No real Bumpa staging fixtures; run scripts/bumpa_probe.py")
async def test_staging_captures_replay_through_mappers_and_sync(monkeypatch):
    """Unknown response shapes surface here without contacting Bumpa."""
    upsert = AsyncMock()
    monkeypatch.setattr(bumpa_sync, "upsert_product_cache", upsert)
    mapped_products = 0
    for path in CAPTURES:
        raw = json.loads(path.read_text(encoding="utf-8"))
        if path.name.startswith("products-list"):
            products = mappers.extract_product_rows(raw)
            assert products is not None, f"Product list mapper needs updating for {path.name}"
            for product in products:
                assert mappers.extract_product_id(product), f"Product ID mapper needs updating for {path.name}"
                await bumpa_sync._cache_product(None, uuid4(), product, bumpa_sync.datetime.now(bumpa_sync.UTC))
                mapped_products += 1
        elif path.name.startswith("product-"):
            assert mappers.extract_product_id(raw), f"Product ID mapper needs updating for {path.name}"
            await bumpa_sync._cache_product(None, uuid4(), raw, bumpa_sync.datetime.now(bumpa_sync.UTC))
            mapped_products += 1
        elif path.name.startswith("checkout"):
            assert mappers.extract_checkout_id(raw), f"Checkout ID mapper needs updating for {path.name}"
        elif path.name.startswith("payment-intent"):
            assert mappers.extract_authorization_url(raw), f"Pay link mapper needs updating for {path.name}"
        elif path.name.startswith("orders"):
            mappers.extract_order_rows(raw)
    assert mapped_products > 0
    assert upsert.await_count == mapped_products
