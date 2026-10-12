"""Minimal WhatsApp shopping state for Bumpa-backed merchants.

Personal details live only in short-lived process memory until checkout. The
database stores product selection and the current step, never those details.
TODO(BUMPA_MULTI_WORKER_DETAILS): use an encrypted, expiring shared store if
the application is deployed with multiple workers.
"""

import json
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.db.models import ConversationState, ProductCache, Vendor
from app.integrations.bumpa import mappers
from app.integrations.bumpa.credentials import decrypt_credential
from app.integrations.whatsapp.client import MetaWhatsAppClient, WhatsAppClient
from app.logging_conf import logger
from app.services.bumpa_assistant import (
    BumpaAssistant,
    ConversationalWhatsAppClient,
    local_delivery_address,
)
from app.services.bumpa_checkout import (
    CheckoutError,
    CheckoutPostcodeRequired,
    CustomerDetails,
    FulfilmentDetails,
    list_shipping_options,
    start_checkout,
)
from app.services.bumpa_payments import PaymentTracker
from app.services.bumpa_sync import refresh_product_live
from app.services.bumpa_transfers import TransferService
from app.services.bumpa_whatsapp import has_open_capacity
from app.services.delivery_postcodes import registered_postcode, supplied_postcode

DETAILS_TTL = timedelta(hours=1)
PAGE_SIZE = 10


def _unique_offers(rows: list[ProductCache]) -> list[ProductCache]:
    """Hide identical imported copies in chat without changing Bumpa inventory."""
    seen: set[str] = set()
    products = []
    for item in rows:
        identity = json.dumps([
            item.name, str(item.price), item.currency, item.stock_qty,
            getattr(item, "image_urls", []), item.variations,
        ], sort_keys=True, default=str)
        if identity not in seen:
            seen.add(identity)
            products.append(item)
    return products


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
        payment_tracker: PaymentTracker | None = None,
    ) -> None:
        self._sessions = session_factory
        self._http = http_client
        self._settings = settings
        self._details: dict[tuple[UUID, str], tuple[datetime, dict[str, str]]] = {}
        self._transfers = TransferService(session_factory, http_client, settings)
        self._payments = payment_tracker or PaymentTracker(session_factory, http_client, settings)
        self._assistant = BumpaAssistant(settings, http_client)

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
            rows = _unique_offers(list((await session.scalars(query.order_by(ProductCache.name, ProductCache.bumpa_product_id))).all()))
        rows = rows[page * PAGE_SIZE: (page + 1) * PAGE_SIZE + 1]
        products = rows[:PAGE_SIZE]
        if not products:
            await client.send_text(wa_id, "No matching products right now. Send a product name to search, or MENU to browse.")
            return
        state = await self._state(merchant.id, wa_id)
        await self._set_state(state, "start", {
            "menu_ids": [item.bumpa_product_id for item in products],
            "menu_page": page, "menu_search": search, "menu_more": len(rows) > PAGE_SIZE,
        })
        business = merchant.business_name or merchant.name
        body = f"{business}\nHere's what's available:\n"
        for number, item in enumerate(products, 1):
            entry = f"\n{number}. {item.name or 'Product'} — {_money(item.price, item.currency)}\n"
            if item.image_urls:
                image = str(item.image_urls[0])
                try:
                    url = urlsplit(image)
                    if url.scheme == "https" and url.hostname and not url.username and not url.password and len(image) < 500:
                        entry += image + "\n"
                except ValueError:
                    pass
            if body and len(body) + len(entry) > 3500:
                await client.send_text(wa_id, body)
                body = ""
            body += entry
        body += "\nReply with a number or product name."
        if len(rows) > PAGE_SIZE:
            body += " Send NEXT for more."
        await client.send_text(wa_id, body)
        # Full names above remain readable even though Meta crops row titles.
        menu_rows = [(f"product:{item.bumpa_product_id}", f"{number}. {item.name or 'Product'}")
                     for number, item in enumerate(products, 1)]
        await client.send_list(wa_id, f"Choose an item from {business}.", menu_rows)

    async def _product(self, merchant: Vendor, product_id: str) -> tuple[ProductCache | None, bool]:
        return await refresh_product_live(
            merchant.id, product_id, session_factory=self._sessions,
            http_client=self._http, settings=self._settings,
        )

    async def _selected(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState, product_id: str, qty: int | None = None) -> None:
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
        if qty is not None:
            if product.stock_qty is not None and qty > product.stock_qty:
                await client.send_text(wa_id, "That quantity is unavailable. How many would you like instead?")
                await self._set_state(state, "quantity", payload)
                return
            await self._set_state(state, "payment_method", {**payload, "qty": qty})
            await client.send_buttons(wa_id, f"{description} Quantity: {qty}. Would you prefer online payment or a bank transfer?",
                                      [("pay_online", "Pay online"), ("pay_transfer", "Pay by transfer")])
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
        except CheckoutPostcodeRequired:
            await self._set_state(state, "zip", state.payload)
            await client.send_text(wa_id, "Bumpa needs a postcode for this address. What is your delivery postcode?")
            return
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

    async def _fulfilment_choice(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState) -> None:
        choices = []
        if merchant.pickup_location_id:
            choices.append(("pickup", "Pickup"))
        if merchant.delivery_enabled:
            choices.append(("delivery", "Delivery"))
        if not choices:
            await client.send_text(wa_id, "This shop has no fulfilment method configured yet.")
        elif len(choices) == 1 and choices[0][0] == "delivery":
            await self._begin_delivery(merchant, wa_id, client, state)
        elif len(choices) == 1:
            await self._set_state(state, "confirm", {**state.payload, "fulfilment": "pickup"})
            await self._confirm(merchant, wa_id, client, state)
        else:
            await self._set_state(state, "fulfilment", state.payload)
            await client.send_buttons(wa_id, "Would you like pickup or delivery?", choices)

    async def _begin_delivery(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState) -> None:
        self._put_detail(merchant.id, wa_id, "country", "Nigeria")
        await self._set_state(state, "address", {**state.payload, "fulfilment": "delivery"})
        await client.send_text(wa_id, "What's your delivery address? Include the area or a landmark. I'll assume Ilorin, Kwara unless you include another city.")

    async def _confirm(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState) -> None:
        product, cached_only = await self._product(merchant, state.payload["product_id"])
        if product is None or not product.is_published or (product.stock_qty is not None and product.stock_qty < int(state.payload["qty"])):
            await client.send_text(wa_id, "This item is unavailable in that quantity. Send MENU to choose another.")
            return
        total = product.price * int(state.payload["qty"]) if product.price is not None else None
        note = " Final amount is checked by Bumpa before payment." if cached_only or state.payload.get("fulfilment") == "delivery" else ""
        await self._set_state(state, "confirm", state.payload)
        address_note = ""
        if state.payload.get("fulfilment") == "delivery":
            details = self._details_for(merchant.id, wa_id)
            address_note = f" Deliver to: {details.get('street', '')}, {details.get('city', '')}, {details.get('state', '')}."
        await client.send_buttons(wa_id, f"{product.name or 'Product'} × {state.payload['qty']}: {_money(total, product.currency)}.{address_note}{note} Confirm checkout?", [("confirm", "Confirm"), ("cancel", "Cancel")])

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
        acknowledge = getattr(client, "mark_read_and_typing", None)
        if acknowledge and message.get("id"):
            try:
                await acknowledge(str(message["id"]))
            except httpx.HTTPError as exc:
                logger.warning("Bumpa WhatsApp acknowledgement failed", extra={
                    "message_id": message["id"], "step": "bumpa_acknowledge", "error_type": type(exc).__name__,
                })
        if await self._transfers.owner_action(merchant, message, client):
            return
        if await self._transfers.customer_proof(merchant, message, client):
            return
        text = _incoming(message)
        lower = text.casefold()
        if lower in {"i've paid", "ive paid", "paid", "order status", "resend"}:
            ref = await self._payments.latest_for_customer(merchant.id, wa_id)
            if ref is not None:
                if lower == "resend":
                    if await self._payments.resend(merchant, ref, client):
                        return
                elif lower == "order status":
                    await client.send_text(wa_id, await self._payments.order_status(merchant, ref))
                    return
                elif ref.status == "awaiting_payment":
                    status = await self._payments.poll_one(ref_id=ref.id)
                    if status == "pending":
                        await client.send_text(wa_id, "Bumpa has not confirmed your payment yet. I will keep checking.")
                    return
                elif ref.status == "paid":
                    await client.send_text(wa_id, "Bumpa has confirmed your payment. Send ORDER STATUS for the latest order update.")
                    return
                else:
                    await client.send_text(wa_id, "This payment link is no longer active. Reply RESEND for a fresh link.")
                    return
        state = await self._state(merchant.id, wa_id)
        # Resolve deterministic choices before invoking the language model.
        if state.step == "start" and lower.isdigit():
            ids = (state.payload or {}).get("menu_ids", [])
            number = int(lower)
            if 1 <= number <= len(ids):
                await self._selected(merchant, wa_id, client, state, ids[number - 1])
            else:
                await client.send_text(wa_id, "Choose one of the numbers shown, or send MENU for the products.")
            return
        if state.step == "start" and lower in {"next", "more", "more products"}:
            payload = state.payload or {}
            if payload.get("menu_more"):
                await self._menu(merchant, wa_id, client, page=int(payload.get("menu_page", 0)) + 1,
                                 search=payload.get("menu_search"))
            else:
                await client.send_text(wa_id, "That's the last page. Send MENU to browse again or a name to search.")
            return
        if state.step in {"start", "quantity", "payment_method"} and lower not in {
            "hi", "hello", "start", "", "cancel", "start over", "menu", "checkout", "check out",
            "buy", "buy now", "proceed", "continue", "online", "pay online", "card", "pay by card",
            "payment link", "pay_online", "transfer", "bank transfer", "pay by transfer", "pay_transfer",
        } and ":" not in lower and not lower.isdigit():
            async with self._sessions() as session:
                matches = list((await session.scalars(select(ProductCache).where(
                    ProductCache.merchant_id == merchant.id, ProductCache.is_published.is_(True),
                    func.lower(ProductCache.name) == lower,
                ).order_by(ProductCache.bumpa_product_id))).all())
            matches = _unique_offers([item for item in matches if (item.name or "").casefold() == lower])
            if len(matches) == 1:
                await self._selected(merchant, wa_id, client, state, matches[0].bumpa_product_id, 1)
                return
            if len(matches) > 1:
                await client.send_text(wa_id, "There are different offers with that name. Which one would you like?")
                await self._menu(merchant, wa_id, client, search=text)
                return
        online = lower in {"online", "pay online", "card", "pay by card", "payment link", "pay_online"}
        transfer = lower in {"transfer", "bank transfer", "pay by transfer", "pay_transfer"}
        checkout = lower in {"checkout", "check out", "buy", "buy now", "proceed", "continue"}
        if state.step == "quantity" and (online or transfer or checkout):
            await self._set_state(state, "payment_method", {**state.payload, "qty": 1})
            if checkout:
                await client.send_buttons(wa_id, "Would you like a payment link or a bank transfer?",
                                          [("pay_online", "Pay online"), ("pay_transfer", "Pay by transfer")])
                return
        if state.step == "payment_method":
            if online or transfer:
                text = "pay_online" if online else "pay_transfer"
                lower = text
            elif checkout:
                await client.send_buttons(wa_id, "Would you like a payment link or a bank transfer?",
                                          [("pay_online", "Pay online"), ("pay_transfer", "Pay by transfer")])
                return
        if state.step in {"email", "phone", "fulfilment", "address", "address_state", "street", "city", "state", "country", "zip", "shipping", "confirm"} and lower not in {"cancel", "start over", "menu"}:
            details = self._details_for(merchant.id, wa_id)
            needed = ("first_name", "last_name") if state.step == "email" else ("first_name", "last_name", "email")
            if not all(details.get(field) for field in needed):
                payload = {key: value for key, value in state.payload.items() if key in {"product_id", "variation_id", "qty"}}
                await self._set_state(state, "full_name", payload)
                await client.send_text(wa_id, "Your checkout details have expired. I still have your selection—what's your full name?")
                return
        assistant = getattr(self, "_assistant", None)
        if assistant is not None and assistant.enabled:
            key = merchant.id, wa_id
            business = merchant.business_name or merchant.name
            client = ConversationalWhatsAppClient(client, assistant, key, business, [
                getattr(merchant, "payout_bank_name", None) or "", getattr(merchant, "payout_account_name", None) or "",
                getattr(merchant, "payout_account_number", None) or "",
                *self._details_for(merchant.id, wa_id).values(),
            ])
            canonical = lower in {"cancel", "start over", "menu", "hi", "hello", "start", "pay_online", "pay_transfer"} or ":" in lower or lower.isdigit()
            if message.get("type") == "text" and state.step in {"start", "quantity", "payment_method"} and not canonical:
                async with self._sessions() as session:
                    products = (await session.scalars(select(ProductCache).where(
                        ProductCache.merchant_id == merchant.id, ProductCache.is_published.is_(True),
                    ).order_by(ProductCache.name, ProductCache.bumpa_product_id))).all()
                products = _unique_offers(list(products))
                shown = (state.payload or {}).get("menu_ids", [])
                products.sort(key=lambda p: shown.index(p.bumpa_product_id) if p.bumpa_product_id in shown else len(shown))
                catalog = [{"id": p.bumpa_product_id, "name": p.name} for p in products]
                intent = await assistant.interpret(key, text, state.step, business, catalog)
                if intent is not None:
                    if intent.action == "select" and intent.product_id:
                        await self._selected(merchant, wa_id, client, state, intent.product_id, intent.quantity)
                        return
                    if intent.action == "help":
                        reply = intent.reply or "What would you like to know about this shop?"
                        await client.client.send_text(wa_id, reply)
                        assistant.record(key, "assistant", reply)
                        return
                    text = {"browse": "menu", "quantity": str(intent.quantity or ""),
                            "pay_online": "pay_online", "pay_transfer": "pay_transfer"}.get(intent.action, text)
                    lower = text.casefold()
            elif state.step in {"start", "quantity", "payment_method", "variation"}:
                assistant.record(key, "user", text)
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
            if lower in {"hi", "hello", "start", ""}:
                await client.send_text(wa_id, f"Hi! Welcome to {merchant.business_name or merchant.name}. What are you looking for today?")
                return
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
        elif state.step == "payment_method" and lower == "pay_transfer":
            row = await self._transfers.create(merchant, wa_id, payload["product_id"], int(payload["qty"]), client)
            if row is not None:
                await self._set_state(state, "start", {})
            return
        elif state.step == "full_name":
            names = text.split(maxsplit=1)
            if not 2 <= len(text) <= 240 or len(names) != 2:
                await client.send_text(wa_id, "Please send your first and last name so Bumpa can attach them to your order.")
                return
            first, last = names
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
            self._put_detail(merchant.id, wa_id, "phone", "+" + wa_id.lstrip("+"))
            await self._fulfilment_choice(merchant, wa_id, client, state)
            return
        elif state.step == "phone":
            phone = wa_id if lower == "same" else text
            if not phone.replace("+", "").isdigit() or len(phone) > 30:
                await client.send_text(wa_id, "Please send a valid phone number or SAME.")
                return
            self._put_detail(merchant.id, wa_id, "phone", phone)
            await self._fulfilment_choice(merchant, wa_id, client, state)
            return
        elif state.step == "fulfilment" and lower == "pickup" and merchant.pickup_location_id:
            await self._set_state(state, "confirm", {**payload, "fulfilment": "pickup"})
            await self._confirm(merchant, wa_id, client, state)
            return
        elif state.step == "fulfilment" and lower == "delivery" and merchant.delivery_enabled:
            await self._begin_delivery(merchant, wa_id, client, state)
            return
        elif state.step == "address":
            if not 5 <= len(text) <= 500:
                await client.send_text(wa_id, "Please send your full delivery address, including the area or a landmark.")
                return
            address = await assistant.delivery_address(text) if assistant is not None and assistant.enabled else local_delivery_address(text)
            postcode = supplied_postcode(text) or address.get("zip") or registered_postcode(text, address["city"], address["state"])
            if postcode:
                address["zip"] = postcode
            for field, value in address.items():
                if value:
                    self._put_detail(merchant.id, wa_id, field, value)
            if not address["state"]:
                await self._set_state(state, "address_state", payload)
                await client.send_text(wa_id, "Which state is that address in?")
                return
            await self._shipping(merchant, wa_id, client, state)
            return
        elif state.step == "address_state" and 1 <= len(text) <= 120:
            self._put_detail(merchant.id, wa_id, "state", text)
            await self._shipping(merchant, wa_id, client, state)
            return
        elif state.step == "zip":
            import re

            if not re.fullmatch(r"\d{6}|[A-Za-z]{2}[A-Za-z0-9]{9}", text):
                await client.send_text(wa_id, "Please send a valid Nigerian postcode.")
                return
            self._put_detail(merchant.id, wa_id, "zip", text.upper())
            await self._shipping(merchant, wa_id, client, state)
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
