"""Bumpa HTTP behavior is tested only against documented, hand-written fixtures."""

import asyncio
import logging

import httpx
import pytest
import respx

from app.integrations.bumpa.client import (
    BumpaAuthError,
    BumpaClient,
    BumpaNotFound,
    BumpaRateLimited,
    BumpaUnavailable,
    BumpaValidationError,
)
from tests.bumpa_fixture_loader import load_handwritten

BASE = "https://api.bumpa.xyz/api/commerce/v1"
PUBLIC = "test-public-never-log"
SECRET = "test-secret-never-log"
TOKEN = "test-cart-token-never-log"


def _client(http: httpx.AsyncClient, secret: str | None = SECRET) -> BumpaClient:
    return BumpaClient("https://api.bumpa.xyz", PUBLIC, secret, "loc-doc-1", http)


def test_public_and_secret_requests_use_correct_key_and_location():
    with respx.mock(assert_all_called=True) as mock:
        products = mock.get(BASE + "/products").respond(200, json=load_handwritten("products_empty.jsonc"))
        orders = mock.get(BASE + "/orders").respond(200, json=load_handwritten("orders_empty.jsonc"))

        async def run():
            async with httpx.AsyncClient() as http:
                client = _client(http)
                assert await client.list_products(limit=1) == {"data": []}
                assert await client.list_orders(limit=1) == {"data": []}

        asyncio.run(run())
        assert products.calls[0].request.headers["X-Api-Key"] == PUBLIC
        assert orders.calls[0].request.headers["X-Api-Key"] == SECRET
        assert products.calls[0].request.url.params["location_id"] == "loc-doc-1"
        assert orders.calls[0].request.url.params["location_id"] == "loc-doc-1"


def test_cart_token_and_location_are_sent_for_guest_cart():
    with respx.mock(assert_all_called=True) as mock:
        route = mock.post(BASE + "/carts/items").respond(200, json=load_handwritten("cart_item_added.jsonc"))

        async def run():
            async with httpx.AsyncClient() as http:
                await _client(http).add_cart_item(TOKEN, "product-doc-1", 2)

        asyncio.run(run())
        request = route.calls[0].request
        assert request.headers["X-Cart-Token"] == TOKEN
        assert request.url.params["location_id"] == "loc-doc-1"
        assert b'"location_id":"loc-doc-1"' in request.content


@pytest.mark.parametrize(
    ("status", "expected"),
    [(401, BumpaAuthError), (404, BumpaNotFound), (429, BumpaRateLimited), (503, BumpaUnavailable)],
)
def test_typed_errors(status, expected):
    with respx.mock(assert_all_called=False) as mock:
        mock.post(BASE + "/carts").respond(status)

        async def run():
            async with httpx.AsyncClient() as http:
                with pytest.raises(expected):
                    await _client(http).create_cart()

        asyncio.run(run())


def test_422_retains_errors_payload_without_logging_secrets(caplog):
    with respx.mock(assert_all_called=True) as mock:
        mock.post(BASE + "/checkouts/checkout-doc-1/finalize").respond(422, json=load_handwritten("error_422.jsonc"))

        async def run():
            async with httpx.AsyncClient() as http:
                with pytest.raises(BumpaValidationError) as error:
                    await _client(http).finalize("checkout-doc-1")
                assert error.value.errors_payload == {"checkout": ["Payment has not been confirmed"]}

        with caplog.at_level(logging.DEBUG):
            asyncio.run(run())
        for secret in (PUBLIC, SECRET, TOKEN):
            assert secret not in caplog.text


@pytest.mark.parametrize("status", [429, 503])
def test_get_retries_rate_limits_and_server_errors(status):
    with respx.mock(assert_all_called=True) as mock:
        route = mock.get(BASE + "/products").mock(
            side_effect=[
                httpx.Response(status),
                httpx.Response(200, json=load_handwritten("products_empty.jsonc")),
            ]
        )

        async def run():
            async with httpx.AsyncClient() as http:
                assert await _client(http).list_products() == {"data": []}

        asyncio.run(run())
        assert route.call_count == 2


@pytest.mark.parametrize("method,path", [("POST", "/carts"), ("PATCH", "/carts/items"), ("DELETE", "/carts/clear")])
def test_mutations_are_not_retried(method, path):
    with respx.mock(assert_all_called=True) as mock:
        route = mock.route(method=method, url=BASE + path).respond(503)

        async def run():
            async with httpx.AsyncClient() as http:
                with pytest.raises(BumpaUnavailable):
                    await _client(http)._request(method, path, json={})

        asyncio.run(run())
        assert route.call_count == 1


def test_payment_intent_is_the_only_retry_safe_post():
    with respx.mock(assert_all_called=True) as mock:
        route = mock.post(BASE + "/checkouts/checkout-doc-1/payment-intent").mock(
            side_effect=[
                httpx.Response(503),
                httpx.Response(200, json=load_handwritten("payment_intent.jsonc")),
            ]
        )

        async def run():
            async with httpx.AsyncClient() as http:
                result = await _client(http).payment_intent("checkout-doc-1")
                assert result["reference"] == "doc-reference"

        asyncio.run(run())
        assert route.call_count == 2


def test_secret_key_is_required_for_orders():
    async def run():
        async with httpx.AsyncClient() as http:
            with pytest.raises(BumpaAuthError):
                await _client(http, secret=None).list_orders()

    asyncio.run(run())
