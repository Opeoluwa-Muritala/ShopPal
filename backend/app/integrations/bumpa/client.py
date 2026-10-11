"""Async Bumpa Commerce API client; never logs headers or response bodies."""

from typing import Any
from urllib.parse import quote

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

from app.integrations.bumpa.models import BumpaEnvelope


class BumpaError(Exception):
    """Base Bumpa failure with a safe, non-secret message."""


class BumpaAuthError(BumpaError):
    pass


class BumpaNotFound(BumpaError):
    pass


class BumpaValidationError(BumpaError):
    def __init__(self, errors_payload: Any) -> None:
        super().__init__("Bumpa rejected the request")
        self.errors_payload = errors_payload


class BumpaRateLimited(BumpaError):
    pass


class BumpaUnavailable(BumpaError):
    pass


class BumpaClient:
    def __init__(
        self,
        base_url: str,
        public_key: str,
        secret_key: str | None,
        location_id: str,
        http_client: httpx.AsyncClient,
    ) -> None:
        if not public_key or not location_id:
            raise ValueError("Bumpa public key and location ID are required")
        self._base_url = base_url.rstrip("/") + "/api/commerce/v1"
        self._public_key = public_key
        self._secret_key = secret_key
        self._location_id = location_id
        self._http = http_client

    async def _request(
        self,
        method: str,
        path: str,
        *,
        secret: bool = False,
        cart_token: str | None = None,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        retry_safe: bool = False,
    ) -> dict[str, Any] | list[Any]:
        key = self._secret_key if secret else self._public_key
        if not key:
            raise BumpaAuthError("Bumpa secret key is not configured")
        headers = {"X-Api-Key": key}
        if cart_token:
            headers["X-Cart-Token"] = cart_token
        query = {**(params or {}), "location_id": self._location_id}

        async def request_once() -> dict[str, Any] | list[Any]:
            try:
                response = await self._http.request(
                    method,
                    self._base_url + path,
                    headers=headers,
                    params=query,
                    json=json,
                )
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                raise BumpaUnavailable("Bumpa is temporarily unavailable") from exc
            if response.status_code == 401:
                raise BumpaAuthError("Bumpa rejected the API key")
            if response.status_code == 404:
                raise BumpaNotFound("Bumpa resource was not found")
            if response.status_code == 422:
                try:
                    payload = response.json()
                except ValueError:
                    payload = None
                errors = payload.get("errors") if isinstance(payload, dict) else payload
                raise BumpaValidationError(errors)
            if response.status_code == 429:
                raise BumpaRateLimited("Bumpa rate limit reached")
            if response.status_code >= 500:
                raise BumpaUnavailable("Bumpa is temporarily unavailable")
            if response.status_code >= 400:
                raise BumpaError("Bumpa request failed")
            try:
                payload = response.json()
            except ValueError as exc:
                raise BumpaUnavailable("Bumpa returned invalid JSON") from exc
            if isinstance(payload, dict):
                BumpaEnvelope.model_validate(payload)
                return payload
            if isinstance(payload, list):
                return payload
            raise BumpaUnavailable("Bumpa returned an unexpected response")

        if method != "GET" and not retry_safe:
            return await request_once()
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(3),
            wait=wait_random_exponential(multiplier=0.2, max=2),
            retry=retry_if_exception_type((BumpaRateLimited, BumpaUnavailable)),
            reraise=True,
        ):
            with attempt:
                return await request_once()
        raise BumpaUnavailable("Bumpa retry exhausted")

    async def list_products(self, *, limit: int = 50, page: int = 1, **filters: Any) -> dict[str, Any] | list[Any]:
        return await self._request("GET", "/products", params={"limit": limit, "page": page, **filters})

    async def get_product(self, product_id: str, *, variations: bool = True) -> dict[str, Any] | list[Any]:
        return await self._request("GET", f"/products/{quote(str(product_id), safe='')}", params={"variations": int(variations)})

    async def create_cart(self) -> dict[str, Any] | list[Any]:
        return await self._request("POST", "/carts", json={"location_id": self._location_id})

    async def get_cart(self, cart_token: str) -> dict[str, Any] | list[Any]:
        return await self._request("GET", "/carts", cart_token=cart_token)

    async def add_cart_item(self, cart_token: str, product_id: str, quantity: int, variation_id: str | None = None) -> dict[str, Any] | list[Any]:
        body: dict[str, Any] = {"location_id": self._location_id, "product_id": product_id, "quantity": quantity}
        if variation_id:
            body["product_variation_id"] = variation_id
        return await self._request("POST", "/carts/items", cart_token=cart_token, json=body)

    async def set_cart_item_quantity(self, cart_token: str, product_id: str, quantity: int, variation_id: str | None = None) -> dict[str, Any] | list[Any]:
        body: dict[str, Any] = {"location_id": self._location_id, "product_id": product_id, "quantity": quantity}
        if variation_id:
            body["product_variation_id"] = variation_id
        return await self._request("PATCH", "/carts/items", cart_token=cart_token, json=body)

    async def remove_cart_item(self, cart_token: str, product_id: str, variation_id: str | None = None) -> dict[str, Any] | list[Any]:
        body: dict[str, Any] = {"location_id": self._location_id, "product_id": product_id}
        if variation_id:
            body["product_variation_id"] = variation_id
        return await self._request("DELETE", "/carts/items", cart_token=cart_token, json=body)

    async def clear_cart(self, cart_token: str) -> dict[str, Any] | list[Any]:
        return await self._request("DELETE", "/carts/clear", cart_token=cart_token, json={"location_id": self._location_id})

    async def shipping_options(self, cart_id: str, fulfillment_context: dict[str, Any]) -> dict[str, Any] | list[Any]:
        return await self._request("POST", "/shipping-options", json={"cart_id": cart_id, "fulfillment_context": fulfillment_context})

    async def create_checkout(self, cart_id: str, customer_context: dict[str, Any], fulfillment_context: dict[str, Any]) -> dict[str, Any] | list[Any]:
        return await self._request("POST", "/checkouts", json={"cart_id": cart_id, "customer_context": customer_context, "fulfillment_context": fulfillment_context})

    async def get_checkout(self, checkout_id: str) -> dict[str, Any] | list[Any]:
        return await self._request("GET", f"/checkouts/{quote(str(checkout_id), safe='')}")

    async def update_checkout(self, checkout_id: str, customer_context: dict[str, Any] | None = None, fulfillment_context: dict[str, Any] | None = None) -> dict[str, Any] | list[Any]:
        body: dict[str, Any] = {}
        if customer_context is not None:
            body["customer_context"] = customer_context
        if fulfillment_context is not None:
            body["fulfillment_context"] = fulfillment_context
        return await self._request("PATCH", f"/checkouts/{quote(str(checkout_id), safe='')}", json=body)

    async def calculate_totals(self, checkout_id: str) -> dict[str, Any] | list[Any]:
        return await self._request("POST", f"/checkouts/{quote(str(checkout_id), safe='')}/calculate-totals", json={})

    async def payment_intent(self, checkout_id: str) -> dict[str, Any] | list[Any]:
        return await self._request("POST", f"/checkouts/{quote(str(checkout_id), safe='')}/payment-intent", json={}, retry_safe=True)

    async def finalize(self, checkout_id: str, payment_details: dict[str, Any] | None = None) -> dict[str, Any] | list[Any]:
        body = {"payment_details": payment_details} if payment_details else {}
        return await self._request("POST", f"/checkouts/{quote(str(checkout_id), safe='')}/finalize", json=body)

    async def list_orders(self, **filters: Any) -> dict[str, Any] | list[Any]:
        return await self._request("GET", "/orders", secret=True, params=filters)
