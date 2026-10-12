"""Synchronize transient WhatsApp baskets with Bumpa guest carts."""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.integrations.bumpa import mappers
from app.integrations.bumpa.client import (
    BumpaAuthError,
    BumpaError,
    BumpaRateLimited,
    BumpaUnavailable,
)
from app.services.bumpa_checkout import (
    CheckoutConnectionInvalid,
    CheckoutItem,
    CheckoutRejected,
    CheckoutUnavailable,
    _client_for_merchant,
    _flag_invalid,
)


@dataclass(repr=False)
class GuestCart:
    cart_id: str | None = None
    token: str | None = None
    items: dict[tuple[str, str | None], int] = field(default_factory=dict)
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class BumpaBaskets:
    """Keep guest tokens only in bounded memory until checkout or expiry."""

    def __init__(self, sessions: async_sessionmaker[AsyncSession], http: httpx.AsyncClient, settings: Settings) -> None:
        self.sessions = sessions
        self.http = http
        self.settings = settings
        self.carts: dict[tuple[UUID, str], GuestCart] = {}
        self._lock = asyncio.Lock()

    def forget(self, merchant_id: UUID, wa_id: str) -> None:
        self.carts.pop((merchant_id, wa_id), None)

    async def sync(self, merchant_id: UUID, wa_id: str, items: list[CheckoutItem]) -> str | None:
        """Apply absolute quantities; never retry ambiguous cart mutations."""
        key = merchant_id, wa_id
        client = await _client_for_merchant(merchant_id, self.sessions, self.http, self.settings)
        try:
            async with self._lock:
                cutoff = datetime.now(UTC) - timedelta(hours=24)
                for old_key in [old_key for old_key, cart in self.carts.items() if cart.updated_at < cutoff and not cart.lock.locked()]:
                    self.carts.pop(old_key, None)
                cart = self.carts.get(key)
                if cart is None:
                    if not items:
                        return None
                    if len(self.carts) >= 1000:
                        raise CheckoutUnavailable("Temporary cart capacity has been reached")
                    cart = GuestCart()
                    self.carts[key] = cart
            async with cart.lock:
                if cart.cart_id is None or cart.token is None:
                    response = await client.create_cart()
                    cart.cart_id = mappers.extract_cart_id(response)
                    cart.token = mappers.extract_cart_token(response)
                    if not cart.cart_id or not cart.token:
                        self.forget(merchant_id, wa_id)
                        raise CheckoutRejected("Bumpa did not return guest cart details")
                desired = {(item.product_id, item.variation_id): item.qty for item in items}
                if not desired:
                    await client.clear_cart(cart.token)
                    self.forget(merchant_id, wa_id)
                    return None
                for product_id, variation_id in cart.items.keys() - desired.keys():
                    await client.remove_cart_item(cart.token, product_id, variation_id)
                for (product_id, variation_id), qty in desired.items():
                    previous = cart.items.get((product_id, variation_id))
                    if previous is None:
                        response = await client.add_cart_item(cart.token, product_id, qty, variation_id)
                        cart.token = mappers.extract_cart_token(response) or cart.token
                    else:
                        # Reassert quantities even if unchanged locally: Bumpa
                        # may expire or change a cart between chat messages.
                        await client.set_cart_item_quantity(cart.token, product_id, qty, variation_id)
                cart.items = desired
                cart.updated_at = datetime.now(UTC)
                return cart.cart_id
        except BumpaAuthError as exc:
            self.forget(merchant_id, wa_id)
            await _flag_invalid(merchant_id, self.sessions)
            raise CheckoutConnectionInvalid("This shop's Bumpa connection needs attention") from exc
        except (BumpaRateLimited, BumpaUnavailable) as exc:
            # A mutation may have succeeded remotely. Start a fresh cart on an
            # explicit later attempt rather than risk doubling quantities.
            self.forget(merchant_id, wa_id)
            raise CheckoutUnavailable("Bumpa cart is temporarily unavailable") from exc
        except BumpaError as exc:
            self.forget(merchant_id, wa_id)
            raise CheckoutRejected("Bumpa could not update your cart") from exc
