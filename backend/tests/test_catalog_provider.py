"""Provider selection keeps Bumpa merchants out of legacy order tables."""

from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.routers.products import list_vendor_products
from app.services.catalog_provider import (
    BumpaProvider,
    LegacyProvider,
    provider_for,
    require_legacy_catalog_write,
    require_legacy_order_management,
)


class FakeSession:
    def __init__(self, merchant, products=None):
        self.merchant = merchant
        self.products = products or []

    def get(self, *_args):
        return self.merchant

    def scalars(self, *_args):
        return SimpleNamespace(all=lambda: self.products)


def test_bumpa_product_reads_use_cache_without_raw_or_keys():
    merchant = SimpleNamespace(id=uuid4(), catalog_provider="bumpa")
    cached = SimpleNamespace(
        bumpa_product_id="product-1", name="Sneakers", price=Decimal("5000"), currency="NGN",
        stock_qty=3, image_urls=["https://example.com/shoe.jpg"], variations=[],
        description="Blue", is_published=True, raw={"secret": "never-return"},
    )
    session = FakeSession(merchant, [cached])
    assert isinstance(provider_for(session, merchant.id), BumpaProvider)
    response = list_vendor_products(current_account=SimpleNamespace(vendor_id=merchant.id), session=session)
    assert response["count"] == 1
    assert response["products"][0]["id"] == "product-1"
    assert "raw" not in response["products"][0]
    assert "secret" not in str(response)


def test_bumpa_merchant_cannot_use_legacy_writes_or_order_management():
    merchant = SimpleNamespace(id=uuid4(), catalog_provider="bumpa")
    session = FakeSession(merchant)
    with pytest.raises(HTTPException) as product_error:
        require_legacy_catalog_write(session, merchant.id)
    with pytest.raises(HTTPException) as order_error:
        require_legacy_order_management(session, merchant.id)
    assert product_error.value.status_code == 410
    assert order_error.value.status_code == 410


def test_legacy_provider_remains_selected_for_existing_merchant():
    merchant = SimpleNamespace(id=uuid4(), catalog_provider="legacy")
    assert isinstance(provider_for(FakeSession(merchant), merchant.id), LegacyProvider)
