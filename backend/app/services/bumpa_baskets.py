"""Synchronize transient WhatsApp baskets with Bumpa guest carts."""

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.db.models import BumpaGuestCart
from app.db.bumpa_repository import get_guest_cart
from app.integrations.bumpa.credentials import decrypt_credential, encrypt_credential
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

    def token_for(self, merchant_id: UUID, wa_id: str) -> str | None:
        cart = self.carts.get((merchant_id, wa_id))
        return cart.token if cart else None

    async def _load_persisted(self, merchant_id: UUID, wa_id: str) -> GuestCart | None:
        if self.sessions is None or self.settings is None:
            return None
        try:
            async with self.sessions() as session:
                row = await get_guest_cart(session, merchant_id, wa_id)
                if row is None:
                    return None
                try:
                    token = decrypt_credential(row.cart_token_enc, self.settings)
                except (TypeError, ValueError):
                    return None
                return GuestCart(cart_id=row.bumpa_cart_id, token=token,
                                 items={(item["product_id"], item.get("variation_id")): int(item["qty"])
                                        for item in row.items if isinstance(item, dict) and item.get("product_id")})
        except SQLAlchemyError:
            # The migration may lag behind an application deploy. The
            # in-memory cart remains fully usable until persistence is ready.
            return None

    async def _persist(self, merchant_id: UUID, wa_id: str, cart: GuestCart) -> None:
        if self.sessions is None or self.settings is None or not cart.token:
            return
        try:
            async with self.sessions() as session:
                # Look up by the unique key without the expiry filter. An expired
                # row must be updated, not inserted again.
                row = await session.scalar(select(BumpaGuestCart).where(
                    BumpaGuestCart.merchant_id == merchant_id,
                    BumpaGuestCart.customer_wa_id == wa_id,
                ))
                if row is None:
                    row = BumpaGuestCart(merchant_id=merchant_id, customer_wa_id=wa_id,
                                         bumpa_cart_id=cart.cart_id or "",
                                         cart_token_enc=encrypt_credential(cart.token, self.settings),
                                         items=[{"product_id": p, "variation_id": v, "qty": q} for (p, v), q in cart.items.items()],
                                         expires_at=datetime.now(UTC) + timedelta(hours=24))
                    session.add(row)
                else:
                    row.bumpa_cart_id = cart.cart_id or row.bumpa_cart_id
                    row.cart_token_enc = encrypt_credential(cart.token, self.settings)
                    row.items = [{"product_id": p, "variation_id": v, "qty": q} for (p, v), q in cart.items.items()]
                    row.expires_at = datetime.now(UTC) + timedelta(hours=24)
                await session.commit()
        except SQLAlchemyError:
            # Do not block product selection when the optional persistence
            # table has not been migrated yet.
            return

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
                    cart = await self._load_persisted(merchant_id, wa_id)
                if cart is not None:
                    self.carts[key] = cart
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
                await self._persist(merchant_id, wa_id, cart)
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
