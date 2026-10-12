"""Hypothetical response shapes stay isolated in one mapping module."""

import logging
from decimal import Decimal

import pytest

from app.integrations.bumpa import mappers


@pytest.mark.parametrize("raw, expected", [({"id": 12}, "12"), ({"data": {"id": "p-2"}}, "p-2")])
def test_product_id_shapes(raw, expected):
    assert mappers.extract_product_id(raw) == expected


@pytest.mark.parametrize("raw, expected", [({"price": "2500.50"}, Decimal("2500.50")), ({"data": {"selling_price": 2000}}, Decimal("2000"))])
def test_price_shapes(raw, expected):
    assert mappers.extract_price(raw) == expected


def test_product_fields_are_defensive():
    raw = {"data": {"name": "Sandals", "currency": "NGN", "inventory": 4, "images": [{"url": "https://example.com/1.jpg"}], "variations": [{"id": "v1"}], "status": "published"}}
    assert mappers.extract_name(raw) == "Sandals"
    assert mappers.extract_currency(raw) == "NGN"
    assert mappers.extract_stock(raw) == 4
    assert mappers.extract_image_urls(raw) == ["https://example.com/1.jpg"]
    assert mappers.extract_variations(raw) == [{"id": "v1"}]
    assert mappers.extract_is_published(raw) is True
    assert mappers.extract_product_rows({"data": [raw["data"]]}) == [raw["data"]]


def test_checkout_order_payment_and_invoice_shapes():
    raw = {"data": {"id": "checkout-1", "order_id": "order-1", "payment": {"status": "paid"}, "shipping": {"status": "shipped"}, "invoice": {"link": "https://example.com/invoice.pdf"}}}
    assert mappers.extract_checkout_id(raw) == "checkout-1"
    assert mappers.extract_order_id(raw) == "order-1"
    assert mappers.extract_payment_status(raw) == "paid"
    assert mappers.extract_shipping_status(raw) == "shipped"
    assert mappers.extract_invoice_url(raw) == "https://example.com/invoice.pdf"


def test_unknown_fields_warn_with_keys_only(caplog):
    raw = {"unknown": "customer-private-value"}
    with caplog.at_level(logging.WARNING):
        assert mappers.extract_price(raw) is None
        assert mappers.extract_invoice_url(raw) is None
    assert "unknown" in caplog.text
    assert "customer-private-value" not in caplog.text


def test_invalid_invoice_and_authorization_urls_are_rejected():
    assert mappers.extract_invoice_url({"invoice_url": "javascript:alert(1)"}) is None
    assert mappers.extract_authorization_url({"authorization_url": "http://example.com/pay"}) is None


# HAND-WRITTEN FROM DOCS, NOT REAL BUMPA OUTPUT
@pytest.mark.parametrize("empty_images", [[], {}, [None, {}, {"url": " "}], ["", " "]])
@pytest.mark.parametrize("nested", [False, True])
def test_empty_image_collection_falls_back_to_single_image(empty_images, nested):
    product = {"images": empty_images, "image_url": "https://example.com/product.jpg"}
    raw = {"data": product} if nested else product
    assert mappers.extract_image_urls(raw) == ["https://example.com/product.jpg"]


def test_empty_image_fields_warn_without_values(caplog):
    with caplog.at_level(logging.WARNING):
        assert mappers.extract_image_urls({"images": [], "private": "hidden-value"}) == []
    assert "image_urls" in caplog.text
    assert "hidden-value" not in caplog.text
