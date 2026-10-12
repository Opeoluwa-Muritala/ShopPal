"""Minimal WhatsApp shopping state for Bumpa-backed merchants.

Personal details live only in short-lived process memory until checkout. The
database stores product selection and the current step, never those details.
TODO(BUMPA_MULTI_WORKER_DETAILS): use an encrypted, expiring shared store if
the application is deployed with multiple workers.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.db.models import ConversationState, ProductCache, Vendor
from app.integrations.bumpa import mappers
from app.integrations.bumpa.credentials import decrypt_credential
from app.integrations.whatsapp.client import MetaWhatsAppClient, WhatsAppClient
from app.services.bumpa_checkout import (
    CheckoutError,
    CustomerDetails,
    FulfilmentDetails,
    list_shipping_options,
    start_checkout,
)
from app.services.bumpa_sync import refresh_product_live
from app.services.bumpa_whatsapp import has_open_capacity

DETAILS_TTL = timedelta(hours=1)
PAGE_SIZE = 9


def _incoming(message: dict[str, Any]) -> str:
    if message.get("type") == "text":
        text = message.get("text")
        return str(text.get("body", "")).strip() if isinstance(text, dict) else ""
    if message.get("type") == "interactive":
        interactive = message.get("interactive") or {}
        reply = interactive.get("button_reply") or interactive.get("list_reply") or {}
        return str(reply.get("id", ""))
    return ""


def _money(price: Decimal | None, currency: str | None) -> str:
    return f"{currency or 'NGN'} {price:,.2f}" if price is not None else "Price available at checkout"


def _customer(details: dict[str, str]) -> CustomerDetails:
    return CustomerDetails.model_validate({key: details.get(key) for key in ("first_name", "last_name", "email", "phone")})


class BumpaConversation:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        http_client: httpx.AsyncClient,
        settings: Settings,
    ) -> None:
        self._sessions = session_factory
        self._http = http_client
        self._settings = settings
        self._details: dict[tuple[UUID, str], tuple[datetime, dict[str, str]]] = {}

    def _details_for(self, merchant_id: UUID, wa_id: str) -> dict[str, str]:
        key = merchant_id, wa_id
        stored = self._details.get(key)
        if stored and stored[0] > datetime.now(UTC) - DETAILS_TTL:
            return stored[1]
        self._details.pop(key, None)
        return {}

    def _put_detail(self, merchant_id: UUID, wa_id: str, field: str, value: str) -> None:
        details = dict(self._details_for(merchant_id, wa_id))
        details[field] = value
        self._details[merchant_id, wa_id] = datetime.now(UTC), details

    async def _client(self, merchant: Vendor) -> WhatsAppClient | None:
        if not merchant.whatsapp_phone_number_id or not merchant.whatsapp_token_enc:
            return None
        token = decrypt_credential(merchant.whatsapp_token_enc, self._settings)
        return MetaWhatsAppClient(self._settings.whatsapp_api_base, merchant.whatsapp_phone_number_id, token, self._http)

    async def _state(self, merchant_id: UUID, wa_id: str) -> ConversationState:
        async with self._sessions() as session:
            state = await session.get(ConversationState, (merchant_id, wa_id))
            if state is None:
                state = ConversationState(merchant_id=merchant_id, customer_wa_id=wa_id, step="start", payload={})
                session.add(state)
                await session.commit()
            return state

    async def _set_state(self, state: ConversationState, step: str, payload: dict[str, Any]) -> None:
        async with self._sessions() as session:
            row = await session.get(ConversationState, (state.merchant_id, state.customer_wa_id))
            if row is None:
                return
            rates = {key: value for key, value in (row.payload or {}).items() if key.startswith("_rate_")}
            row.step = step
            row.payload = {**rates, **payload}
            row.updated_at = datetime.now(UTC)
            await session.commit()
        state.step = step
        state.payload = payload

    async def _menu(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, *, page: int = 0, search: str | None = None) -> None:
        async with self._sessions() as session:
            query = select(ProductCache).where(ProductCache.merchant_id == merchant.id, ProductCache.is_published.is_(True))
            if search:
                query = query.where(ProductCache.name.ilike(f"%{search[:80]}%"))
            rows = (await session.scalars(query.order_by(ProductCache.name).offset(page * PAGE_SIZE).limit(PAGE_SIZE + 1))).all()
        products = rows[:PAGE_SIZE]
        if not products:
            await client.send_text(wa_id, "No matching products right now. Send a product name to search, or MENU to browse.")
            return
        menu_rows = [(f"product:{item.bumpa_product_id}", f"{item.name or 'Product'} — {_money(item.price, item.currency)}") for item in products]
        if len(rows) > PAGE_SIZE:
            menu_rows.append((f"page:{page + 1}", "More products"))
        await client.send_list(wa_id, f"{merchant.business_name or merchant.name}: choose a product, or send a name to search.", menu_rows)

    async def _product(self, merchant: Vendor, product_id: str) -> tuple[ProductCache | None, bool]:
        return await refresh_product_live(
            merchant.id, product_id, session_factory=self._sessions,
            http_client=self._http, settings=self._settings,
        )

    async def _selected(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState, product_id: str) -> None:
        product, cached_only = await self._product(merchant, product_id)
        if product is None or not product.is_published:
            await client.send_text(wa_id, "That product is no longer available. Choose another from the menu.")
            await self._menu(merchant, wa_id, client)
            return
        if product.stock_qty is not None and product.stock_qty < 1:
            await client.send_text(wa_id, "That product is out of stock. Here are other available items.")
            await self._menu(merchant, wa_id, client)
            return
        payload = {"product_id": product_id}
        description = f"{product.name or 'Product'} — {_money(product.price, product.currency)}."
        if cached_only:
            description += " Price and stock will be checked again at payment."
        if product.variations:
            rows = []
            for item in product.variations[:10]:
                variation_id = mappers.extract_product_id(item)
                if variation_id:
                    rows.append((f"variation:{variation_id}", mappers.extract_name(item) or "Variation"))
            if rows:
                await self._set_state(state, "variation", payload)
                await client.send_list(wa_id, f"{description} Choose a variation.", rows)
                return
            await client.send_text(wa_id, "Variations are unavailable for this product right now.")
            return
        await self._set_state(state, "quantity", payload)
        await client.send_text(wa_id, f"{description} How many would you like? Reply with a number (default 1).")

    async def _shipping(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState) -> None:
        details = self._details_for(merchant.id, wa_id)
        try:
            customer = _customer(details)
            fulfilment = FulfilmentDetails(type="delivery", **{key: details.get(key) for key in ("street", "city", "state", "country", "zip")})
            options = await list_shipping_options(
                merchant, state.payload["product_id"], state.payload.get("variation_id"), int(state.payload["qty"]),
                customer, fulfilment, session_factory=self._sessions, http_client=self._http, settings=self._settings,
            )
        except (CheckoutError, ValidationError, KeyError, ValueError):
            await client.send_text(wa_id, "Shipping is unavailable. Please try again shortly or send CANCEL.")
            return
        rows = [(f"shipping:{shipping_id}", str(option.get("name") or option.get("title") or "Delivery option"))
                for option in options if (shipping_id := mappers.extract_shipping_id(option))]
        if not rows:
            await client.send_text(wa_id, "No delivery options are available for that address. Send CANCEL to start over.")
            return
        await self._set_state(state, "shipping", {**state.payload, "shipping_ids": [row[0][9:] for row in rows]})
        await client.send_list(wa_id, "Choose a delivery option.", rows[:10])

    async def _confirm(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState) -> None:
        product, cached_only = await self._product(merchant, state.payload["product_id"])
        if product is None or not product.is_published or (product.stock_qty is not None and product.stock_qty < int(state.payload["qty"])):
            await client.send_text(wa_id, "This item is unavailable in that quantity. Send MENU to choose another.")
            return
        total = product.price * int(state.payload["qty"]) if product.price is not None else None
        note = " Final amount is checked by Bumpa before payment." if cached_only or state.payload.get("fulfilment") == "delivery" else ""
        await self._set_state(state, "confirm", state.payload)
        await client.send_buttons(wa_id, f"{product.name or 'Product'} × {state.payload['qty']}: {_money(total, product.currency)}.{note} Confirm checkout?", [("confirm", "Confirm"), ("cancel", "Cancel")])

    async def _start_checkout(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState) -> None:
        async with self._sessions() as session:
            if not await has_open_capacity(session, merchant.id, wa_id, kind="checkout"):
                await client.send_text(wa_id, "You have three open checkouts. Please finish one before starting another.")
                return
        details = self._details_for(merchant.id, wa_id)
        try:
            customer = _customer(details)
            fulfilment = FulfilmentDetails(
                type=state.payload["fulfilment"],
                pickup_location_id=merchant.pickup_location_id,
                shipping_id=state.payload.get("shipping_id"),
                **{key: details.get(key) for key in ("street", "city", "state", "country", "zip")},
            )
            result = await start_checkout(
                merchant, state.payload["product_id"], state.payload.get("variation_id"), int(state.payload["qty"]),
                customer, fulfilment, wa_id,
                session_factory=self._sessions, http_client=self._http, settings=self._settings,
            )
        except (CheckoutError, ValidationError, KeyError, ValueError):
            await client.send_text(wa_id, "Checkout could not be created. Please try again shortly.")
            return
        product, _ = await self._product(merchant, state.payload["product_id"])
        qty = state.payload["qty"]
        self._details.pop((merchant.id, wa_id), None)
        await self._set_state(state, "start", {})
        await client.send_text(wa_id, f"Pay for {product.name if product else 'your item'} × {qty}: {_money(result.amount, result.currency)}. Reference {result.reference}. {result.authorization_url}")

    async def __call__(self, merchant: Vendor, message: dict[str, Any]) -> None:
        wa_id = str(message.get("from") or "")
        if not wa_id:
            return
        client = await self._client(merchant)
        if client is None:
            return
        text = _incoming(message)
        lower = text.casefold()
        state = await self._state(merchant.id, wa_id)
        if lower in {"cancel", "start over", "menu"}:
            self._details.pop((merchant.id, wa_id), None)
            await self._set_state(state, "start", {})
            await self._menu(merchant, wa_id, client)
            return
        if lower.startswith("page:"):
            try:
                page = max(0, min(int(text.split(":", 1)[1]), 100))
            except ValueError:
                page = 0
            await self._menu(merchant, wa_id, client, page=page)
            return
        if lower.startswith("product:"):
            await self._selected(merchant, wa_id, client, state, text.split(":", 1)[1])
            return
        if state.step == "start":
            await self._menu(merchant, wa_id, client, search=None if lower in {"hi", "hello", "start", ""} else text)
            return
        payload = dict(state.payload or {})
        if state.step == "variation" and lower.startswith("variation:"):
            product, _ = await self._product(merchant, payload["product_id"])
            variation_id = text.split(":", 1)[1]
            if product and any(mappers.extract_product_id(item) == variation_id for item in product.variations):
                await self._set_state(state, "quantity", {**payload, "variation_id": variation_id})
                await client.send_text(wa_id, "How many would you like? Reply with a number (default 1).")
                return
        elif state.step == "quantity":
            try:
                qty = int(text or "1")
            except ValueError:
                qty = 0
            if 1 <= qty <= 100:
                await self._set_state(state, "payment_method", {**payload, "qty": qty})
                await client.send_buttons(wa_id, "How would you like to pay?", [("pay_online", "Pay online"), ("pay_transfer", "Pay by transfer")])
                return
            await client.send_text(wa_id, "Reply with a quantity from 1 to 100.")
            return
        elif state.step == "payment_method" and lower == "pay_online":
            await self._set_state(state, "full_name", payload)
            await client.send_text(wa_id, "What is your full name?")
            return
        elif state.step == "full_name" and 2 <= len(text) <= 240 and " " in text:
            first, last = text.split(" ", 1)
            self._put_detail(merchant.id, wa_id, "first_name", first)
            self._put_detail(merchant.id, wa_id, "last_name", last)
            await self._set_state(state, "email", payload)
            await client.send_text(wa_id, "What email should Bumpa attach to your order?")
            return
        elif state.step == "email":
            try:
                from pydantic import EmailStr, TypeAdapter

                email = str(TypeAdapter(EmailStr).validate_python(text))
            except ValidationError:
                await client.send_text(wa_id, "Please send a valid email address.")
                return
            self._put_detail(merchant.id, wa_id, "email", email)
            await self._set_state(state, "phone", payload)
            await client.send_text(wa_id, "What phone number should Bumpa use? Reply SAME to use this WhatsApp number.")
            return
        elif state.step == "phone":
            phone = wa_id if lower == "same" else text
            if not phone.replace("+", "").isdigit() or len(phone) > 30:
                await client.send_text(wa_id, "Please send a valid phone number or SAME.")
                return
            self._put_detail(merchant.id, wa_id, "phone", phone)
            choices = []
            if merchant.pickup_location_id:
                choices.append(("pickup", "Pickup"))
            if merchant.delivery_enabled:
                choices.append(("delivery", "Delivery"))
            if not choices:
                await client.send_text(wa_id, "This shop has no fulfilment method configured yet.")
                return
            await self._set_state(state, "fulfilment", payload)
            await client.send_buttons(wa_id, "Pickup or delivery?", choices)
            return
        elif state.step == "fulfilment" and lower == "pickup" and merchant.pickup_location_id:
            await self._set_state(state, "confirm", {**payload, "fulfilment": "pickup"})
            await self._confirm(merchant, wa_id, client, state)
            return
        elif state.step == "fulfilment" and lower == "delivery" and merchant.delivery_enabled:
            await self._set_state(state, "street", {**payload, "fulfilment": "delivery"})
            await client.send_text(wa_id, "What is your street address?")
            return
        elif state.step in {"street", "city", "state", "country", "zip"}:
            if not 1 <= len(text) <= 200:
                await client.send_text(wa_id, "Please send a short address value.")
                return
            self._put_detail(merchant.id, wa_id, state.step, text)
            next_step = {"street": "city", "city": "state", "state": "country", "country": "zip", "zip": "shipping"}[state.step]
            if next_step == "shipping":
                await self._shipping(merchant, wa_id, client, state)
            else:
                await self._set_state(state, next_step, payload)
                await client.send_text(wa_id, f"What is your {next_step}?")
            return
        elif state.step == "shipping" and lower.startswith("shipping:"):
            shipping_id = text.split(":", 1)[1]
            if shipping_id in payload.get("shipping_ids", []):
                await self._set_state(state, "confirm", {**payload, "shipping_id": shipping_id})
                await self._confirm(merchant, wa_id, client, state)
                return
        elif state.step == "confirm" and lower == "confirm":
            await self._start_checkout(merchant, wa_id, client, state)
            return
        await client.send_text(wa_id, "Please use the choices shown, or send MENU to browse and CANCEL to start over.")
