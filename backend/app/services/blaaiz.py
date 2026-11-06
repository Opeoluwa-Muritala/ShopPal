"""Minimal OAuth client for Blaaiz card collections and verification."""

from __future__ import annotations

import asyncio
import time
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import quote

import httpx

from app.config import Settings


class BlaaizError(RuntimeError):
    """A non-sensitive Blaaiz integration failure."""


class BlaaizClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.base_url = (
            "https://api-dev.blaaiz.com"
            if settings.blaaiz_env == "development"
            else "https://api-prod.blaaiz.com"
        )
        self._token: str | None = None
        self._token_expires_at = 0.0
        self._token_lock = asyncio.Lock()

    async def _access_token(self, *, force_refresh: bool = False) -> str:
        async with self._token_lock:
            if not force_refresh and self._token and time.monotonic() < self._token_expires_at:
                return self._token
            client_id = self.settings.blaaiz_client_id.get_secret_value()
            client_secret = self.settings.blaaiz_client_secret.get_secret_value()
            if not client_id or not client_secret:
                raise BlaaizError("Blaaiz OAuth credentials are not configured")
            try:
                async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
                    response = await client.post(
                        f"{self.base_url}/oauth/token",
                        data={
                            "grant_type": "client_credentials",
                            "client_id": client_id,
                            "client_secret": client_secret,
                            "scope": "collection:create transaction:read",
                        },
                        headers={"Accept": "application/json"},
                    )
                response.raise_for_status()
                body = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                raise BlaaizError("Blaaiz OAuth request failed") from exc
            token = body.get("access_token") if isinstance(body, dict) else None
            expires_in = body.get("expires_in", 600) if isinstance(body, dict) else 600
            if not isinstance(token, str) or not token:
                raise BlaaizError("Blaaiz OAuth response was invalid")
            self._token = token
            self._token_expires_at = time.monotonic() + max(30, int(expires_in) - 60)
            return token

    async def _request(
        self, method: str, path: str, *, payload: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        for attempt in range(2):
            token = await self._access_token(force_refresh=attempt == 1)
            try:
                async with httpx.AsyncClient(timeout=20.0, follow_redirects=False) as client:
                    response = await client.request(
                        method,
                        f"{self.base_url}{path}",
                        headers={
                            "Authorization": f"Bearer {token}",
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                if response.status_code == 401 and attempt == 0:
                    continue
                response.raise_for_status()
                body = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                raise BlaaizError("Blaaiz API request failed") from exc
            if not isinstance(body, dict):
                raise BlaaizError("Blaaiz API response was invalid")
            return body
        raise BlaaizError("Blaaiz API authorization failed")

    async def create_card_collection(
        self,
        *,
        amount: Decimal,
        customer_id: str,
        merchant_reference: str,
        card_holder_name: str,
        card_number: str,
        expiry: str,
        cvc: str,
        phone: str | None,
    ) -> dict[str, str]:
        wallet_id = self.settings.blaaiz_wallet_id
        if not wallet_id:
            raise BlaaizError("Blaaiz wallet is not configured")
        payload: dict[str, Any] = {
            "method": "card",
            "amount": float(amount),
            "wallet_id": wallet_id,
            "customer_id": customer_id,
            "merchant_reference": merchant_reference,
            "card_holder_name": card_holder_name,
            "card_number": card_number,
            "expiry": expiry,
            "cvc": cvc,
        }
        if phone:
            payload["phone"] = phone
        redirect_url = self.settings.blaaiz_redirect_url
        if redirect_url:
            if not redirect_url.startswith("https://") or len(redirect_url) > 2048:
                raise BlaaizError("Blaaiz redirect URL must be a valid HTTPS URL")
            payload["redirect_url"] = redirect_url
        body = await self._request("POST", "/api/external/collection", payload=payload)
        transaction_id, url = body.get("transaction_id"), body.get("url")
        if not isinstance(transaction_id, str) or not transaction_id:
            raise BlaaizError("Blaaiz collection response was invalid")
        if url is not None and (not isinstance(url, str) or not url.startswith("https://")):
            raise BlaaizError("Blaaiz authorization URL was invalid")
        return {"transaction_id": transaction_id, "authorization_url": url or ""}

    async def get_transaction(self, transaction_id: str) -> dict[str, Any]:
        if not transaction_id or len(transaction_id) > 255:
            raise BlaaizError("Invalid Blaaiz transaction identifier")
        return await self._request(
            "GET", f"/api/external/transaction/{quote(transaction_id, safe='')}"
        )


def transaction_data(body: dict[str, Any]) -> dict[str, Any]:
    """Normalize the documented wrapped and direct transaction response shapes."""
    for key in ("data", "transaction"):
        value = body.get(key)
        if isinstance(value, dict):
            return value
    return body


def decimal_value(value: Any) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise BlaaizError("Blaaiz transaction amount was invalid") from exc
