"""Flutterwave virtual-account client.

The v4 contract is deliberately isolated here. The v3 adapter implements the
same protocol so a controlled fallback does not leak provider-specific fields
into payment orchestration.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Protocol
from uuid import uuid4

import httpx

from app.config import Settings

TOKEN_URL = "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token"


class FlutterwaveClientError(RuntimeError):
    pass


@dataclass(frozen=True)
class VirtualAccount:
    provider_reference: str
    account_number: str
    bank_name: str
    expires_at: str | None


@dataclass(frozen=True)
class VerifiedCharge:
    transaction_id: str
    reference: str
    status: str
    currency: str
    amount: Decimal


class VirtualAccountProvider(Protocol):
    async def create_customer(self, wa_number: str) -> str: ...
    async def create_virtual_account(self, *, customer_id: str, tx_ref: str, amount: Decimal, expires_seconds: int) -> VirtualAccount: ...
    async def verify_charge(self, transaction_id: str) -> VerifiedCharge: ...
    async def find_charge(self, tx_ref: str) -> VerifiedCharge | None: ...


class FlutterwaveV4Client:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = (
            "https://developersandbox-api.flutterwave.com"
            if settings.flw_env == "sandbox"
            else "https://f4bexperience.flutterwave.com"
        )
        self._token: str | None = None
        self._token_expires_at = 0.0
        self._token_lock = asyncio.Lock()

    async def _access_token(self, force_refresh: bool = False) -> str:
        async with self._token_lock:
            if not force_refresh and self._token and time.monotonic() < self._token_expires_at:
                return self._token
            client_id = self.settings.flw_client_id.get_secret_value()
            client_secret = self.settings.flw_client_secret.get_secret_value()
            if not client_id or not client_secret:
                raise FlutterwaveClientError("Flutterwave v4 credentials are not configured")
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    TOKEN_URL,
                    data={"client_id": client_id, "client_secret": client_secret, "grant_type": "client_credentials"},
                )
            if response.status_code >= 400:
                raise FlutterwaveClientError("Flutterwave OAuth token request failed")
            body = response.json()
            token = body.get("access_token") if isinstance(body, dict) else None
            expires_in = body.get("expires_in", 600) if isinstance(body, dict) else 600
            if not isinstance(token, str) or not token:
                raise FlutterwaveClientError("Flutterwave OAuth response was invalid")
            self._token = token
            self._token_expires_at = time.monotonic() + max(30, int(expires_in) - 60)
            return token

    async def _request(self, method: str, path: str, *, json: dict[str, Any] | None = None, params: dict[str, str] | None = None, idempotency_key: str | None = None) -> dict[str, Any]:
        for attempt in range(2):
            token = await self._access_token(force_refresh=attempt == 1)
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json", "Accept": "application/json", "X-Trace-Id": str(uuid4())}
            if idempotency_key:
                headers["X-Idempotency-Key"] = idempotency_key
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    response = await client.request(method, f"{self.base_url}{path}", headers=headers, json=json, params=params)
                if response.status_code == 401 and attempt == 0:
                    continue
                response.raise_for_status()
                body = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                if attempt == 0 and isinstance(exc, httpx.TransportError):
                    await asyncio.sleep(0.25)
                    continue
                raise FlutterwaveClientError("Flutterwave API request failed") from exc
            if not isinstance(body, dict) or body.get("status") not in {"success", "successful"}:
                raise FlutterwaveClientError("Flutterwave API returned an unsuccessful response")
            return body
        raise FlutterwaveClientError("Flutterwave API authorization failed")

    async def create_customer(self, wa_number: str) -> str:
        digits = "".join(ch for ch in wa_number if ch.isdigit())
        body = await self._request(
            "POST", "/customers",
            json={"email": f"wa-{digits}@checkout.shoppal.app", "phone": {"country_code": "234", "number": digits[-10:]}, "meta": {"wa_number": digits}},
            idempotency_key=f"customer-{digits}",
        )
        customer_id = ((body.get("data") or {}).get("id"))
        if not isinstance(customer_id, str) or not customer_id:
            raise FlutterwaveClientError("Flutterwave customer response was invalid")
        return customer_id

    async def create_virtual_account(self, *, customer_id: str, tx_ref: str, amount: Decimal, expires_seconds: int) -> VirtualAccount:
        body = await self._request(
            "POST", "/virtual-accounts",
            json={"reference": tx_ref, "customer_id": customer_id, "amount": float(amount), "expiry": expires_seconds, "currency": "NGN", "account_type": "dynamic"},
            idempotency_key=f"va-{tx_ref}",
        )
        data = body.get("data") or {}
        account_number = data.get("account_number")
        bank_name = data.get("account_bank_name") or data.get("bank_name")
        provider_reference = data.get("id") or data.get("reference")
        if not all(isinstance(value, str) and value for value in (account_number, bank_name, provider_reference)):
            raise FlutterwaveClientError("Flutterwave virtual-account response was invalid")
        return VirtualAccount(provider_reference, account_number, bank_name, data.get("account_expiration_datetime"))

    async def verify_charge(self, transaction_id: str) -> VerifiedCharge:
        if not transaction_id or len(transaction_id) > 120:
            raise FlutterwaveClientError("Invalid Flutterwave transaction ID")
        body = await self._request("GET", f"/charges/{transaction_id}")
        data = body.get("data") or {}
        try:
            amount = Decimal(str(data["amount"]))
        except (KeyError, ValueError, ArithmeticError) as exc:
            raise FlutterwaveClientError("Flutterwave charge response was invalid") from exc
        return VerifiedCharge(str(data.get("id", transaction_id)), str(data.get("reference", "")), str(data.get("status", "")), str(data.get("currency", "")), amount)

    async def find_charge(self, tx_ref: str) -> VerifiedCharge | None:
        body = await self._request("GET", "/charges", params={"reference": tx_ref})
        data = body.get("data") or []
        if not isinstance(data, list):
            return None
        for item in data:
            if isinstance(item, dict) and item.get("reference") == tx_ref and item.get("id"):
                return await self.verify_charge(str(item["id"]))
        return None


class FlutterwaveV3VirtualAccountAdapter:
    """Compatibility adapter for the documented v3 virtual-account endpoint."""

    def __init__(self, settings: Settings):
        self.settings = settings

    async def create_customer(self, wa_number: str) -> str:
        return "v3-customer-" + "".join(ch for ch in wa_number if ch.isdigit())

    async def create_virtual_account(self, *, customer_id: str, tx_ref: str, amount: Decimal, expires_seconds: int) -> VirtualAccount:
        secret = self.settings.flutterwave_secret_key.get_secret_value()
        if not secret:
            raise FlutterwaveClientError("Flutterwave v3 credentials are not configured")
        payload = {"email": f"{customer_id}@checkout.shoppal.app", "amount": int(amount), "currency": "NGN", "tx_ref": tx_ref, "is_permanent": False, "expires": str(expires_seconds)}
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post("https://api.flutterwave.com/v3/virtual-account-numbers", headers={"Authorization": f"Bearer {secret}"}, json=payload)
                response.raise_for_status()
                data = (response.json().get("data") or {})
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            raise FlutterwaveClientError("Flutterwave v3 virtual-account request failed") from exc
        values = (data.get("flw_ref"), data.get("account_number"), data.get("bank_name"))
        if not all(isinstance(value, str) and value for value in values):
            raise FlutterwaveClientError("Flutterwave v3 virtual-account response was invalid")
        return VirtualAccount(values[0], values[1], values[2], data.get("expiry_date"))

    async def verify_charge(self, transaction_id: str) -> VerifiedCharge:
        secret = self.settings.flutterwave_secret_key.get_secret_value()
        if not secret or not transaction_id.isdigit():
            raise FlutterwaveClientError("Invalid Flutterwave v3 transaction ID")
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get(f"https://api.flutterwave.com/v3/transactions/{transaction_id}/verify", headers={"Authorization": f"Bearer {secret}"})
                response.raise_for_status()
                data = (response.json().get("data") or {})
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            raise FlutterwaveClientError("Flutterwave v3 transaction verification failed") from exc
        try:
            return VerifiedCharge(str(data["id"]), str(data["tx_ref"]), str(data["status"]), str(data["currency"]), Decimal(str(data["amount"])))
        except (KeyError, ValueError, ArithmeticError) as exc:
            raise FlutterwaveClientError("Flutterwave v3 transaction response was invalid") from exc

    async def find_charge(self, tx_ref: str) -> VerifiedCharge | None:
        secret = self.settings.flutterwave_secret_key.get_secret_value()
        if not secret:
            raise FlutterwaveClientError("Flutterwave v3 credentials are not configured")
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.get("https://api.flutterwave.com/v3/transactions", params={"tx_ref": tx_ref, "currency": "NGN"}, headers={"Authorization": f"Bearer {secret}"})
                response.raise_for_status()
                values = response.json().get("data") or []
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            raise FlutterwaveClientError("Flutterwave v3 transaction search failed") from exc
        if not values:
            return None
        transaction_id = str(values[0].get("id", ""))
        return await self.verify_charge(transaction_id) if transaction_id.isdigit() else None


def get_virtual_account_provider(settings: Settings) -> VirtualAccountProvider:
    """Use v4 by default; fallback is explicit and only enabled with legacy credentials."""
    if settings.flw_client_id.get_secret_value() and settings.flw_client_secret.get_secret_value():
        return FlutterwaveV4Client(settings)
    return FlutterwaveV3VirtualAccountAdapter(settings)
