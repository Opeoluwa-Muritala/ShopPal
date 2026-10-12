"""Bumpa checkout never persists customer details or guest cart tokens."""

import asyncio
import json
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
import respx
from cryptography.fernet import Fernet
from pydantic import SecretStr

from app.config import Settings
from app.integrations.bumpa.credentials import encrypt_credential
from app.services import bumpa_checkout
from tests.bumpa_fixture_loader import load_handwritten

BASE = "https://api.bumpa.xyz/api/commerce/v1"


class FakeSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def commit(self):
        return None


def _merchant_and_settings():
    settings = Settings(_env_file=None, key_encryption_secret=SecretStr(Fernet.generate_key().decode()))
    merchant = SimpleNamespace(id=uuid4(), pickup_location_id="pickup-doc-1")
    connection = SimpleNamespace(
        public_key_enc=encrypt_credential("doc-public", settings),
        secret_key_enc=None,
        location_id="loc-doc-1",
        status="active",
    )
    return merchant, settings, connection


def _customer():
    return bumpa_checkout.CustomerDetails(first_name="Ada", last_name="Okafor", email="ada@example.com", phone="+2348012345678")


def test_delivery_without_postcode_does_not_invent_one():
    context = bumpa_checkout._delivery_context(_customer(), bumpa_checkout.FulfilmentDetails(
        type="delivery", street="12 Road", city="Ilorin", state="Kwara", country="Nigeria",
    ))
    assert context["zip"] == ""


@pytest.mark.parametrize("multiple", [False, True])
def test_pickup_checkout_returns_only_bumpa_pay_link_and_thin_ref(monkeypatch, multiple):
    merchant, settings, connection = _merchant_and_settings()
    monkeypatch.setattr(bumpa_checkout, "get_connection", AsyncMock(return_value=connection))
    monkeypatch.setattr(bumpa_checkout, "refresh_product_live", AsyncMock(return_value=(SimpleNamespace(stock_qty=5), False)))
    save_ref = AsyncMock(return_value=SimpleNamespace(id=uuid4()))
    monkeypatch.setattr(bumpa_checkout, "save_checkout_ref", save_ref)
    with respx.mock(assert_all_called=True) as mock:
        mock.post(BASE + "/carts").respond(200, json=load_handwritten("cart_created.jsonc"))
        add = mock.post(BASE + "/carts/items").respond(200, json=load_handwritten("cart_item_added.jsonc"))
        checkout = mock.post(BASE + "/checkouts").respond(200, json=load_handwritten("checkout_created.jsonc"))
        mock.post(BASE + "/checkouts/checkout-doc-1/calculate-totals").respond(200, json=load_handwritten("totals_calculated.jsonc"))
        mock.post(BASE + "/checkouts/checkout-doc-1/payment-intent").respond(200, json=load_handwritten("payment_intent.jsonc"))

        async def run():
            async with httpx.AsyncClient() as http:
                return await bumpa_checkout.start_checkout(
                    merchant, "product-doc-1", None, 2, _customer(),
                    bumpa_checkout.FulfilmentDetails(type="pickup"), "+2348012345678",
                    session_factory=FakeSession, http_client=http, settings=settings,
                    items=[bumpa_checkout.CheckoutItem(product_id="product-doc-1", qty=2),
                           bumpa_checkout.CheckoutItem(product_id="product-doc-2", qty=1)] if multiple else None,
                )

        result = asyncio.run(run())
    assert result.authorization_url == "https://paystack.com/pay/doc-only"
    assert result.reference == "doc-reference"
    assert result.order_id == "order-doc-1"
    assert result.amount == Decimal("5000")
    assert add.calls[0].request.headers["X-Cart-Token"] == "guest-doc-token"
    if multiple:
        assert [json.loads(call.request.content)["product_id"] for call in add.calls] == ["product-doc-1", "product-doc-2"]
        assert len({call.request.headers["X-Cart-Token"] for call in add.calls}) == 1
    assert checkout.calls[0].request.url.params["location_id"] == "loc-doc-1"
    assert b'"pickup_location_id":"pickup-doc-1"' in checkout.calls[0].request.content
    stored = str(save_ref.await_args)
    for private in ("Ada", "Okafor", "ada@example.com", "guest-doc-token", "product-doc-1"):
        assert private not in stored


def test_delivery_checkout_rechecks_selected_shipping_option(monkeypatch):
    merchant, settings, connection = _merchant_and_settings()
    monkeypatch.setattr(bumpa_checkout, "get_connection", AsyncMock(return_value=connection))
    monkeypatch.setattr(bumpa_checkout, "refresh_product_live", AsyncMock(return_value=(SimpleNamespace(stock_qty=5), False)))
    monkeypatch.setattr(bumpa_checkout, "save_checkout_ref", AsyncMock(return_value=SimpleNamespace(id=uuid4())))
    with respx.mock(assert_all_called=True) as mock:
        mock.post(BASE + "/carts").respond(200, json=load_handwritten("cart_created.jsonc"))
        mock.post(BASE + "/carts/items").respond(200, json=load_handwritten("cart_item_added.jsonc"))
        mock.post(BASE + "/shipping-options").respond(200, json=load_handwritten("shipping_options.jsonc"))
        checkout = mock.post(BASE + "/checkouts").respond(200, json=load_handwritten("checkout_created.jsonc"))
        mock.post(BASE + "/checkouts/checkout-doc-1/calculate-totals").respond(200, json=load_handwritten("totals_calculated.jsonc"))
        mock.post(BASE + "/checkouts/checkout-doc-1/payment-intent").respond(200, json=load_handwritten("payment_intent.jsonc"))
        fulfilment = bumpa_checkout.FulfilmentDetails(
            type="delivery", street="1 Test St", city="Lagos", state="Lagos",
            country="NG", zip="100001", shipping_id="ship-doc-1",
        )

        async def run():
            async with httpx.AsyncClient() as http:
                return await bumpa_checkout.start_checkout(
                    merchant, "product-doc-1", None, 1, _customer(), fulfilment,
                    "+2348012345678", session_factory=FakeSession, http_client=http, settings=settings,
                )

        result = asyncio.run(run())
    assert result.authorization_url.startswith("https://")
    assert b'"shipping_method_id":"ship-doc-1"' in checkout.calls[0].request.content


def test_finalize_422_payment_not_confirmed_is_pending(monkeypatch):
    merchant, settings, connection = _merchant_and_settings()
    monkeypatch.setattr(bumpa_checkout, "get_connection", AsyncMock(return_value=connection))
    checkout_ref = SimpleNamespace(merchant_id=merchant.id, bumpa_checkout_id="checkout-doc-1")
    with respx.mock(assert_all_called=True) as mock:
        route = mock.post(BASE + "/checkouts/checkout-doc-1/finalize").respond(422, json=load_handwritten("error_422.jsonc"))

        async def run():
            async with httpx.AsyncClient() as http:
                return await bumpa_checkout.finalize(
                    merchant, checkout_ref, session_factory=FakeSession,
                    http_client=http, settings=settings,
                )

        assert asyncio.run(run()) is None
    assert route.call_count == 1


def test_live_checkout_paid_status(monkeypatch):
    merchant, settings, connection = _merchant_and_settings()
    monkeypatch.setattr(bumpa_checkout, "get_connection", AsyncMock(return_value=connection))
    checkout_ref = SimpleNamespace(merchant_id=merchant.id, bumpa_checkout_id="checkout-doc-1", bumpa_order_id=None)
    with respx.mock(assert_all_called=True) as mock:
        mock.get(BASE + "/checkouts/checkout-doc-1").respond(200, json=load_handwritten("checkout_paid_hypothetical.jsonc"))

        async def run():
            async with httpx.AsyncClient() as http:
                return await bumpa_checkout.check_payment(
                    merchant, checkout_ref, session_factory=FakeSession,
                    http_client=http, settings=settings,
                )

        assert asyncio.run(run()) == "paid"


def test_out_of_stock_stops_before_creating_cart(monkeypatch):
    merchant, settings, _connection = _merchant_and_settings()
    monkeypatch.setattr(bumpa_checkout, "refresh_product_live", AsyncMock(return_value=(SimpleNamespace(stock_qty=0), False)))

    async def run():
        async with httpx.AsyncClient() as http:
            with pytest.raises(bumpa_checkout.CheckoutRejected, match="out of stock"):
                await bumpa_checkout.start_checkout(
                    merchant, "product-doc-1", None, 1, _customer(),
                    bumpa_checkout.FulfilmentDetails(type="pickup"), "+2348012345678",
                    session_factory=FakeSession, http_client=http, settings=settings,
                )

    asyncio.run(run())


def test_order_lookup_recovers_when_checkout_read_is_unavailable(monkeypatch):
    merchant, settings, connection = _merchant_and_settings()
    connection.secret_key_enc = encrypt_credential("doc-secret", settings)
    monkeypatch.setattr(bumpa_checkout, "get_connection", AsyncMock(return_value=connection))
    checkout_ref = SimpleNamespace(merchant_id=merchant.id, bumpa_checkout_id="checkout-doc-1", bumpa_order_id="order-doc-1")
    with respx.mock(assert_all_called=True) as mock:
        mock.get(BASE + "/checkouts/checkout-doc-1").mock(side_effect=[httpx.Response(503), httpx.Response(503), httpx.Response(503)])
        orders = mock.get(BASE + "/orders").respond(200, json=load_handwritten("orders_paid_hypothetical.jsonc"))

        async def run():
            async with httpx.AsyncClient() as http:
                return await bumpa_checkout.check_payment(
                    merchant, checkout_ref, session_factory=FakeSession,
                    http_client=http, settings=settings,
                )

        assert asyncio.run(run()) == "paid"
        assert orders.calls[0].request.headers["X-Api-Key"] == "doc-secret"
