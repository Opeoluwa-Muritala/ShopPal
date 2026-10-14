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
from uuid import UUID, uuid4

import httpx
from pydantic import ValidationError
from sqlalchemy import Text, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.db.models import ConversationState, ProductCache, Vendor, WhatsAppMessage
from app.integrations.bumpa import mappers
from app.integrations.bumpa.credentials import decrypt_credential, encrypt_credential
from app.integrations.whatsapp.client import ListRow, MetaWhatsAppClient, WhatsAppClient
from app.logging_conf import logger
from app.services.bumpa_assistant import (
    BumpaAssistant,
    ConversationalWhatsAppClient,
    geocode_delivery_address,
)
from app.services.bumpa_baskets import BumpaBaskets
from app.services.bumpa_checkout import (
    CheckoutError,
    CheckoutItem,
    CheckoutPostcodeRequired,
    CheckoutUnavailable,
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
BASKET_TTL = timedelta(hours=24)
PAGE_SIZE = 10
SCARF_COLLECTIONS = [
    "Printed scarves", "Ombre scarves", "Asma scarves", "Gold Dust Chiffon",
    "silky scarves", "Snake Scarves", "Two-toned scarves", "Chiffon scarves",
    "Shadow Jersey", "Crinkled scarves", "2 in 1 Jersey scarves", "Flower Bouquet",
    "Rainbow scarves", "Vintage scarf", "Cotton Printed Scarf", "Mini Jersey",
]


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


def _default_customer_email(wa_id: str) -> str:
    digits = "".join(character for character in wa_id if character.isdigit())
    return f"wa-{digits[-15:] or 'customer'}@checkout.shoppal.app"


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
        self._baskets: dict[tuple[UUID, str], tuple[datetime, list[CheckoutItem]]] = {}
        self._remote_baskets = BumpaBaskets(session_factory, http_client, settings)
        self._transfers = TransferService(session_factory, http_client, settings)
        self._transfers.on_confirm = self._basket_paid
        self._transfers.on_owner_notified = self._record_outbound_message
        self._payments = payment_tracker or PaymentTracker(session_factory, http_client, settings)
        self._payments.on_paid = self._basket_paid
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

    async def _record_outbound_message(self, wa_id: str, body: str) -> None:
        async with self._sessions() as session:
            session.add(WhatsAppMessage(
                message_id=f"bot-{uuid4()}", from_number=wa_id, message_type="bot_text",
                body=body, status="sent", raw_payload={"direction": "outbound", "body": body},
                wa_timestamp=datetime.now(UTC),
            ))
            await session.commit()

    def _basket_for(self, merchant_id: UUID, wa_id: str) -> list[CheckoutItem]:
        if not hasattr(self, "_baskets"):
            self._baskets = {}
        cutoff = datetime.now(UTC) - BASKET_TTL
        for key in [key for key, (updated, _) in self._baskets.items() if updated < cutoff]:
            self._baskets.pop(key, None)
        return list(self._baskets.get((merchant_id, wa_id), (datetime.now(UTC), []))[1])

    def _checkout_items(self, state: ConversationState) -> list[CheckoutItem]:
        items = self._basket_for(state.merchant_id, state.customer_wa_id)
        if items:
            return items
        saved_items = state.payload.get("basket_items") or []
        if saved_items:
            return [
                CheckoutItem(
                    product_id=str(item["product_id"]),
                    variation_id=item.get("variation_id"),
                    qty=int(item["qty"]),
                )
                for item in saved_items
            ]
        if state.payload.get("basket_count", 0) > 1:
            raise CheckoutError("The temporary basket has expired")
        return [CheckoutItem(product_id=state.payload["product_id"], variation_id=state.payload.get("variation_id"), qty=state.payload["qty"])]

    async def _basket_paid(self, ref: Any) -> None:
        if not ref.customer_wa_id:
            return
        state = await self._state(ref.merchant_id, ref.customer_wa_id)
        if str(ref.id) in (state.payload.get("checkout_ref_id"), state.payload.get("transfer_ref_id")):
            self._basket_for(ref.merchant_id, ref.customer_wa_id)
            self._baskets.pop((ref.merchant_id, ref.customer_wa_id), None)
            self._remote_baskets.forget(ref.merchant_id, ref.customer_wa_id)
            await self._set_state(state, "start", {})

    async def _sync_basket(self, merchant: Vendor, wa_id: str, client: WhatsAppClient) -> str | None:
        try:
            return await self._remote_baskets.sync(merchant.id, wa_id, self._basket_for(merchant.id, wa_id))
        except CheckoutError:
            await client.send_text(wa_id, "Bumpa couldn't update your cart just now. Your selection is kept here; I'll retry before checkout.")
            return None

    async def _payment_choices(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState) -> None:
        items = self._basket_for(merchant.id, wa_id)
        if items:
            last = items[-1]
            payload = {"product_id": last.product_id, "variation_id": last.variation_id,
                       "qty": last.qty, "basket_count": len(items),
                       "basket_items": [item.model_dump(mode="json") for item in items]}
        else:
            payload = state.payload
        if not payload.get("product_id"):
            await client.send_text(wa_id, "Choose a product first.")
            await self._menu(merchant, wa_id, client)
            return
        transfer_payload = {**payload, "payment_method": "transfer"}
        await self._set_state(state, "payment_method", transfer_payload)
        await self._checkout_details(merchant, wa_id, client, state)

    async def _start_transfer(
        self, merchant: Vendor, wa_id: str, client: WhatsAppClient,
        state: ConversationState, payload: dict[str, Any],
    ) -> None:
        """Start the single supported payment path for every customer."""
        basket = self._checkout_items(state)
        delivery_fee = Decimal("0")
        delivery_name = None
        delivery_address = None
        for option in state.payload.get("shipping_options", []):
            if option.get("id") == state.payload.get("shipping_id"):
                delivery_name = option.get("name")
                if option.get("fee") is not None:
                    delivery_fee = Decimal(str(option["fee"]))
                break
        if state.payload.get("fulfilment") == "delivery":
            details = self._details_for(merchant.id, wa_id)
            delivery_address = ", ".join(filter(None, [details.get("street"), details.get("city"), details.get("state")]))
        row = await self._transfers.create(
            merchant, wa_id, payload["product_id"], int(payload["qty"]), client,
            items=[item.model_dump() for item in basket],
            delivery_fee=delivery_fee, delivery_name=delivery_name, delivery_address=delivery_address,
        )
        if row is not None:
            await self._set_state(state, "awaiting_transfer", {"transfer_ref_id": str(row.id)})

    async def _add_selection(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState,
                             payload: dict[str, Any], product: ProductCache, *, replace: bool = False) -> None:
        items = self._basket_for(merchant.id, wa_id)
        item = CheckoutItem(product_id=payload["product_id"], variation_id=payload.get("variation_id"), qty=payload["qty"])
        previous = next((row for row in items if (row.product_id, row.variation_id) == (item.product_id, item.variation_id)), None)
        qty = item.qty + previous.qty if previous and not replace else item.qty
        if qty > 100 or (product.stock_qty is not None and qty > product.stock_qty):
            await client.send_text(wa_id, "That quantity isn't available. Please choose a smaller quantity.")
            return
        if previous is None and len(items) >= 20:
            await client.send_text(wa_id, "Your basket has 20 products. Reply NO to proceed to payment.")
            return
        items = [row for row in items if row is not previous] + [item.model_copy(update={"qty": qty})]
        if len(self._baskets) >= 1000 and (merchant.id, wa_id) not in self._baskets:
            self._baskets.pop(min(self._baskets, key=lambda key: self._baskets[key][0]))
        self._baskets[merchant.id, wa_id] = datetime.now(UTC), items
        await self._sync_basket(merchant, wa_id, client)
        await self._set_state(state, "more_items", {
            **payload,
            "qty": qty,
            "basket_count": len(items),
            "basket_items": [item.model_dump(mode="json") for item in items],
        })
        await client.send_buttons(wa_id, f"{product.name or 'Product'}: quantity {qty} in your basket, {_money(product.price, product.currency)} each. Would you like anything else?",
                                  [("more_yes", "Yes, browse more"), ("more_no", "No, let's pay"), ("cart", "Edit basket")])

    async def _show_basket(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState, *, page: int = 0) -> None:
        items = self._basket_for(merchant.id, wa_id)
        if not items:
            await client.send_text(wa_id, "Your basket is empty. Choose a product to get started.")
            await self._menu(merchant, wa_id, client)
            return
        rows: list[ListRow] = []
        start = max(0, min(page, 2)) * 9
        for index, item in enumerate(items[start:start + 9], start):
            product, _ = await self._product(merchant, item.product_id)
            name = product.name if product else "Unavailable product"
            rows.append((f"cart:{index}", f"{index + 1}. {name}", f"{name}: quantity {item.qty}"))
        if state.step in {"awaiting_payment", "awaiting_transfer"}:
            await client.send_text(wa_id, "Your basket is awaiting payment confirmation:\n" + "\n".join(row[2] if len(row) == 3 else row[1] for row in rows))
            return
        if len(items) > start + 9:
            rows.append((f"cartpage:{page + 1}", "More basket items"))
        await self._set_state(state, "cart_menu", {
            "basket_count": len(items),
            "basket_items": [item.model_dump(mode="json") for item in items],
        })
        await client.send_list(wa_id, "Choose an item to change its quantity or remove it. Reply NO when you're ready to pay.", rows)

    async def _remove_selection(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState) -> None:
        items = [item for item in self._basket_for(merchant.id, wa_id)
                 if (item.product_id, item.variation_id) != (state.payload.get("product_id"), state.payload.get("variation_id"))]
        self._baskets[merchant.id, wa_id] = datetime.now(UTC), items
        await self._sync_basket(merchant, wa_id, client)
        await client.send_text(wa_id, "Removed from your basket.")
        if not items:
            await self._set_state(state, "start", {})
            await self._menu(merchant, wa_id, client)
            return
        last = items[-1]
        await self._set_state(state, "more_items", {
            "product_id": last.product_id,
            "variation_id": last.variation_id,
            "qty": last.qty,
            "basket_count": len(items),
            "basket_items": [item.model_dump(mode="json") for item in items],
        })
        await client.send_buttons(wa_id, "Would you like anything else?",
                                  [("more_yes", "Yes, browse more"), ("more_no", "No, let's pay"), ("cart", "Edit basket")])

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
            encrypted = (state.payload or {}).get("_details_enc")
            if encrypted and not self._details_for(merchant_id, wa_id):
                try:
                    details = json.loads(decrypt_credential(encrypted, self._settings))
                    if isinstance(details, dict):
                        self._details[merchant_id, wa_id] = datetime.now(UTC), {
                            str(key): str(value) for key, value in details.items() if isinstance(value, str)
                        }
                except (TypeError, ValueError, json.JSONDecodeError):
                    logger.warning("Stored checkout details could not be restored", extra={"step": "bumpa_restore_details"})
            return state

    async def _set_state(self, state: ConversationState, step: str, payload: dict[str, Any]) -> None:
        async with self._sessions() as session:
            row = await session.get(ConversationState, (state.merchant_id, state.customer_wa_id))
            if row is None:
                return
            rates = {key: value for key, value in (row.payload or {}).items() if key.startswith("_rate_")}
            if step != "start" and "basket_items" not in payload:
                saved_items = (row.payload or {}).get("basket_items")
                if saved_items:
                    payload = {**payload, "basket_items": saved_items}
            details = self._details_for(state.merchant_id, state.customer_wa_id)
            if details:
                payload = {**payload, "_details_enc": encrypt_credential(json.dumps(details), self._settings)}
            row.step = step
            row.payload = {**rates, **payload}
            row.updated_at = datetime.now(UTC)
            await session.commit()
        state.step = step
        state.payload = payload

    async def _menu(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, *, page: int = 0, search: str | None = None) -> None:
        if search is None and page == 0:
            state = await self._state(merchant.id, wa_id)
            await self._set_state(state, "collection_select", {"collection_page": 0, "basket_count": len(self._basket_for(merchant.id, wa_id))})
            collection_rows = [(f"collection:{index}", name) for index, name in enumerate(SCARF_COLLECTIONS[:9])]
            collection_rows.append(("collection:more", "More collections", "See more scarf collections"))
            await client.send_list(wa_id, "Choose a scarf collection first.", collection_rows)
            return
        async with self._sessions() as session:
            query = select(ProductCache).where(
                ProductCache.merchant_id == merchant.id,
                ProductCache.is_published.is_(True),
                (ProductCache.stock_qty.is_(None) | (ProductCache.stock_qty > 0)),
            )
            if search:
                query = query.where(
                    ProductCache.name.ilike(f"%{search[:80]}%")
                    | cast(ProductCache.raw, Text).ilike(f"%{search[:80]}%")
                )
            rows = _unique_offers(list((await session.scalars(query.order_by(ProductCache.name, ProductCache.bumpa_product_id))).all()))
        rows = rows[page * PAGE_SIZE: (page + 1) * PAGE_SIZE + 1]
        products = rows[:PAGE_SIZE - 1] if len(rows) > PAGE_SIZE else rows
        if not products:
            if search:
                await client.send_text(
                    wa_id,
                    f"I couldn't find a product matching \"{search[:80]}\". Here are the available scarves instead:",
                )
                await self._menu(merchant, wa_id, client)
                return
            await client.send_text(wa_id, "No matching products right now. Send a product name to search, or MENU to browse.")
            return
        state = await self._state(merchant.id, wa_id)
        await self._set_state(state, "start", {
            "menu_ids": [item.bumpa_product_id for item in products],
            "menu_page": page, "menu_search": search, "menu_more": len(rows) > PAGE_SIZE,
            "basket_count": len(self._basket_for(merchant.id, wa_id)),
        })
        business = merchant.business_name or merchant.name
        menu_rows: list[ListRow] = [
            (f"product:{item.bumpa_product_id}", f"{number}. {item.name or 'Product'}",
             f"{item.name or 'Product'}: {_money(item.price, item.currency)}")
            for number, item in enumerate(products, 1)
        ]
        if len(rows) > PAGE_SIZE:
            menu_rows.append(("menu:more", "More scarves", "See more scarves"))
        note = " Send NEXT for more." if len(rows) > PAGE_SIZE else ""
        await client.send_list(wa_id, f"Choose an item from {business}.{note}", menu_rows)

    async def _product(self, merchant: Vendor, product_id: str) -> tuple[ProductCache | None, bool]:
        return await refresh_product_live(
            merchant.id, product_id, session_factory=self._sessions,
            http_client=self._http, settings=self._settings,
        )

    async def _selected(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState, product_id: str, qty: int | None = None, *, show_image: bool = True) -> None:
        product, cached_only = await self._product(merchant, product_id)
        if product is None or not product.is_published:
            await client.send_text(wa_id, "That product is no longer available. Choose another from the menu.")
            await self._menu(merchant, wa_id, client)
            return
        if product.stock_qty is not None and product.stock_qty < 1:
            await client.send_text(wa_id, "That product is out of stock. Here are other available items.")
            await self._menu(merchant, wa_id, client)
            return
        image_url = str(product.image_urls[0]) if getattr(product, "image_urls", []) else None
        if show_image and image_url:
            try:
                await client.send_image(wa_id, image_url, product.name or "Product")
            except (httpx.HTTPError, ValueError) as exc:
                logger.warning("Selected product photo unavailable", extra={
                    "step": "bumpa_product_image", "error_type": type(exc).__name__,
                })
        payload = {"product_id": product_id}
        if not show_image and state.payload.get("product_id") == product_id and state.payload.get("variation_id"):
            payload["variation_id"] = state.payload["variation_id"]
        description = f"{product.name or 'Product'} — {_money(product.price, product.currency)}."
        if cached_only:
            description += " Price and stock will be checked again at payment."
        if product.variations and not payload.get("variation_id"):
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
            await self._add_selection(merchant, wa_id, client, state, {**payload, "qty": qty}, product, replace=not show_image)
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
                items=self._checkout_items(state),
                cart_id=await self._remote_baskets.sync(merchant.id, wa_id, self._checkout_items(state)),
                cart_token=self._remote_baskets.token_for(merchant.id, wa_id),
            )
        except CheckoutPostcodeRequired:
            await self._set_state(state, "zip", state.payload)
            await client.send_text(wa_id, "Bumpa needs a postcode for this address. What is your delivery postcode?")
            return
        except CheckoutUnavailable:
            await self._payment_outage(merchant, wa_id, client)
            return
        except (CheckoutError, ValidationError, KeyError, ValueError):
            await client.send_text(wa_id, "Shipping is unavailable. Please try again shortly or send CANCEL.")
            return
        shipping_options: list[dict[str, Any]] = []
        rows = []
        for option in options:
            shipping_id = mappers.extract_shipping_id(option)
            if not shipping_id:
                continue
            name = str(option.get("name") or option.get("title") or "Delivery option")
            fee = mappers.extract_shipping_fee(option)
            label = name[:24]
            description = f"Delivery fee: {_money(fee, 'NGN')}" if fee is not None else "Fee confirmed by the shop"
            rows.append((f"shipping:{shipping_id}", label, description))
            shipping_options.append({"id": shipping_id, "name": name, "fee": str(fee) if fee is not None else None})
        if not rows:
            await client.send_text(wa_id, "No delivery options are available for that address. Send CANCEL to start over.")
            return
        await self._set_state(state, "shipping", {**state.payload, "shipping_options": shipping_options,
                                                   "shipping_ids": [row[0][9:] for row in rows]})
        await client.send_list(wa_id, "These delivery options match your address. Choose one to see the final amount.", rows[:10])

    async def _payment_outage(self, merchant: Vendor, wa_id: str, client: WhatsAppClient) -> None:
        """Hand off to the owner without pretending an unquoted sale is paid."""
        bank = getattr(merchant, "payout_bank_name", None)
        name = getattr(merchant, "payout_account_name", None)
        number = getattr(merchant, "payout_account_number", None)
        if not all((bank, name, number)):
            await client.send_text(wa_id, "Online checkout is temporarily unavailable, and this shop hasn't set up bank transfer yet. Your cart is still here; please try again shortly.")
            return
        owner = getattr(merchant, "owner_whatsapp_number", None)
        contact = f" Contact the owner on {owner}." if owner else " Contact the shop owner."
        await client.send_text(
            wa_id,
            f"Online checkout is temporarily unavailable. You can arrange a transfer to {bank}, {name}, account {number}."
            f"{contact} Ask them to confirm the full amount, including delivery, before transferring. "
            "If you already tried paying online, ask them to check that payment first. "
            "The owner will verify the transfer and record your sale in Bumpa. Your cart is still here.",
        )

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

    async def _checkout_details(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState) -> None:
        """Ask only for details missing from this short-lived checkout session."""
        details = self._details_for(merchant.id, wa_id)
        if not all(details.get(field) for field in ("first_name", "last_name")):
            await self._set_state(state, "full_name", state.payload)
            await client.send_text(wa_id, "What is your full name?")
        else:
            if not details.get("email"):
                self._put_detail(merchant.id, wa_id, "email", _default_customer_email(wa_id))
            if not details.get("phone"):
                self._put_detail(merchant.id, wa_id, "phone", "+" + wa_id.lstrip("+"))
            await self._fulfilment_choice(merchant, wa_id, client, state)

    async def _begin_delivery(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState) -> None:
        self._put_detail(merchant.id, wa_id, "country", "Nigeria")
        await self._set_state(state, "address", {**state.payload, "fulfilment": "delivery"})
        await client.send_text(wa_id, "What's your delivery address? Include the area or a nearby landmark.")

    async def _confirm(self, merchant: Vendor, wa_id: str, client: WhatsAppClient, state: ConversationState) -> None:
        try:
            items = self._checkout_items(state)
        except CheckoutError:
            await client.send_text(wa_id, "Your temporary basket expired. Send CANCEL to choose your products again.")
            return
        summaries, total, currency = [], Decimal(0), None
        for item in items:
            product, _ = await self._product(merchant, item.product_id)
            if product is None or not product.is_published or product.price is None or (product.stock_qty is not None and product.stock_qty < item.qty):
                await client.send_text(wa_id, "An item is unavailable in that quantity. Send CANCEL to choose again.")
                return
            if currency is not None and currency != product.currency:
                await client.send_text(wa_id, "These products have different currencies. Send CANCEL and purchase them separately.")
                return
            currency = product.currency
            total += product.price * item.qty
            summaries.append(f"{product.name or 'Product'} x {item.qty}")
        note = "Final amount is checked by Bumpa before payment."
        await self._set_state(state, "confirm", state.payload)
        address_note = ""
        if state.payload.get("fulfilment") == "delivery":
            details = self._details_for(merchant.id, wa_id)
            address_note = f" Deliver to: {details.get('street', '')}, {details.get('city', '')}, {details.get('state', '')}."
        shipping_fee = Decimal("0")
        shipping_id = state.payload.get("shipping_id")
        for option in state.payload.get("shipping_options", []):
            if option.get("id") == shipping_id and option.get("fee") is not None:
                shipping_fee = Decimal(str(option["fee"]))
                break
        if shipping_fee:
            summaries.append(f"*Delivery fee:*\n{_money(shipping_fee, currency)}")
            total += shipping_fee
        summary = "\n".join(summaries)
        await client.send_buttons(
            wa_id,
            f"*Order summary*\n{summary}\n\n*Total:*\n{_money(total, currency)}\n\n{address_note.strip()}\n{note}\n\nConfirm your order?",
            [("confirm", "Confirm"), ("cancel", "Cancel")],
        )

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
                items=self._checkout_items(state),
                cart_id=await self._remote_baskets.sync(merchant.id, wa_id, self._checkout_items(state)),
                cart_token=self._remote_baskets.token_for(merchant.id, wa_id),
            )
        except CheckoutUnavailable:
            await self._payment_outage(merchant, wa_id, client)
            return
        except (CheckoutError, ValidationError, KeyError, ValueError):
            await client.send_text(wa_id, "Checkout could not be created. Please try again shortly.")
            return
        self._details.pop((merchant.id, wa_id), None)
        self._remote_baskets.forget(merchant.id, wa_id)
        await self._set_state(state, "awaiting_payment", {"checkout_ref_id": str(result.local_ref_id)})
        await client.send_text(wa_id, f"Pay for your basket: {_money(result.amount, result.currency)}. Reference {result.reference}. {result.authorization_url}")

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
        if lower in {"orders", "my orders", "view orders", "show orders", "show my orders"}:
            await client.send_text(wa_id, await self._payments.customer_orders(merchant, wa_id))
            return
        if lower in {"i've paid", "ive paid", "paid", "order status", "resend"}:
            if lower == "resend" and await self._transfers.resend(merchant, wa_id, client):
                return
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
                    await client.send_text(wa_id, "That payment attempt is no longer active. Reply RESEND for the bank transfer details again.")
                    return
        state = await self._state(merchant.id, wa_id)
        if (
            state.payload.get("basket_count", 0) > 1
            and not self._basket_for(merchant.id, wa_id)
            and not state.payload.get("basket_items")
            and lower not in {"cancel", "start over"}
        ):
            await self._set_state(state, "start", {})
            await client.send_text(wa_id, "Your temporary basket expired. Please choose your products again.")
            await self._menu(merchant, wa_id, client)
            return
        if lower in {"cart", "my cart", "view cart", "show cart", "show my cart", "edit cart", "basket", "edit basket"}:
            await self._show_basket(merchant, wa_id, client, state)
            return
        if state.step in {"awaiting_payment", "awaiting_transfer"} and lower in {"new order", "order more", "order_more", "shop more", "browse more"}:
            self._details.pop((merchant.id, wa_id), None)
            self._baskets.pop((merchant.id, wa_id), None)
            self._remote_baskets.forget(merchant.id, wa_id)
            await self._set_state(state, "start", {})
            await self._menu(merchant, wa_id, client)
            return
        if state.step in {"awaiting_payment", "awaiting_transfer"} and lower not in {"cancel", "start over"}:
            await client.send_text(wa_id, "Your basket is waiting for transfer confirmation. Reply RESEND if you need the bank details again, or send I've paid after transferring.")
            return
        if state.step == "cart_menu":
            if lower.startswith("cartpage:"):
                try:
                    page = int(lower.split(":", 1)[1])
                except ValueError:
                    page = 0
                await self._show_basket(merchant, wa_id, client, state, page=page)
                return
            if lower in {"no", "more_no", "checkout", "pay"}:
                await self._payment_choices(merchant, wa_id, client, state)
                return
            if lower.startswith("cart:") or lower.isdigit():
                try:
                    index = int(lower.split(":", 1)[1]) if ":" in lower else int(lower) - 1
                    items = self._basket_for(merchant.id, wa_id)
                    item = items[index] if 0 <= index < len(items) else None
                except ValueError:
                    item = None
                if item:
                    await self._set_state(state, "edit_quantity", {"product_id": item.product_id, "variation_id": item.variation_id,
                                                                 "qty": item.qty, "basket_count": len(items)})
                    await client.send_text(wa_id, f"Current quantity: {item.qty}. What quantity would you like? Reply 0 to remove this item.")
                    return
        if state.step in {"more_items", "payment_method", "edit_quantity"}:
            if lower in {"0", "remove", "remove this", "remove item"}:
                await self._remove_selection(merchant, wa_id, client, state)
                return
            if lower in {"edit quantity", "change quantity", "quantity"}:
                await self._set_state(state, "edit_quantity", state.payload)
                await client.send_text(wa_id, "What quantity would you like? Reply 0 to remove this item.")
                return
        if state.step == "more_items":
            if lower in {"yes", "y", "more_yes", "yes please", "more", "add more"}:
                await self._menu(merchant, wa_id, client)
                return
            if lower in {"no", "n", "more_no", "no thanks", "no thank you", "that's all", "thats all", "checkout", "check out"}:
                await self._payment_choices(merchant, wa_id, client, state)
                return
            if lower in {"pay_online", "pay_transfer", "online", "pay online", "transfer", "pay by transfer"}:
                await self._set_state(state, "payment_method", state.payload)
        if state.step == "start" and lower in {"checkout", "check out", "no", "more_no"} and self._basket_for(merchant.id, wa_id):
            await self._payment_choices(merchant, wa_id, client, state)
            return
        # Resolve deterministic choices before invoking the language model.
        if state.step == "start" and lower.isdigit():
            ids = (state.payload or {}).get("menu_ids", [])
            number = int(lower)
            if 1 <= number <= len(ids):
                await self._selected(merchant, wa_id, client, state, ids[number - 1], 1)
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
        if state.step in {"start", "quantity", "payment_method", "more_items"} and lower not in {
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
        if state.step == "start" and lower in {
            "what is available", "what's available", "what do you have",
            "what do you have in stock", "what products are available",
            "show me your products", "show products", "catalog", "catalogue",
        }:
            await self._menu(merchant, wa_id, client)
            return
        if state.step in {"payment_method", "more_items", "edit_quantity"} and lower.isdigit():
            qty = int(lower)
            if 1 <= qty <= 100:
                await self._selected(merchant, wa_id, client, state, state.payload["product_id"], qty, show_image=False)
            else:
                await client.send_text(wa_id, "Choose a quantity from 1 to 100.")
            return
        online = lower in {"online", "pay online", "card", "pay by card", "payment link", "pay_online"}
        transfer = lower in {"transfer", "bank transfer", "pay by transfer", "pay_transfer"}
        checkout = lower in {"checkout", "check out", "buy", "buy now", "proceed", "continue"}
        if state.step == "quantity" and (online or transfer or checkout):
            product, _ = await self._product(merchant, state.payload["product_id"])
            if product is None or not product.is_published:
                await client.send_text(wa_id, "This product is no longer available.")
                return
            await self._add_selection(merchant, wa_id, client, state, {**state.payload, "qty": 1}, product)
            if state.step != "more_items":
                return
            await self._payment_choices(merchant, wa_id, client, state)
            return
        if state.step == "payment_method":
            if online or transfer or checkout:
                await self._start_transfer(merchant, wa_id, client, state, state.payload)
                return
        if state.step in {"email", "phone", "fulfilment", "address", "address_state", "street", "city", "state", "country", "zip", "shipping", "confirm"} and lower not in {"cancel", "start over", "menu"}:
            details = self._details_for(merchant.id, wa_id)
            if state.step == "email":
                self._put_detail(merchant.id, wa_id, "email", details.get("email") or _default_customer_email(wa_id))
                self._put_detail(merchant.id, wa_id, "phone", details.get("phone") or "+" + wa_id.lstrip("+"))
                await self._fulfilment_choice(merchant, wa_id, client, state)
                return
            needed = ("first_name", "last_name", "email")
            if not all(details.get(field) for field in needed):
                payload = {key: value for key, value in state.payload.items() if key in {"product_id", "variation_id", "qty", "basket_count"}}
                await self._set_state(state, "full_name", payload)
                await client.send_text(wa_id, "Your checkout details have expired. I still have your selection—what's your full name?")
                return
        assistant = getattr(self, "_assistant", None)
        if assistant is not None and assistant.enabled:
            key = merchant.id, wa_id
            if not getattr(assistant, "history", lambda _key: [])(key):
                async with self._sessions() as session:
                    saved_messages = (await session.execute(
                        select(WhatsAppMessage.message_type, WhatsAppMessage.body)
                        .where(
                            WhatsAppMessage.from_number == wa_id,
                            WhatsAppMessage.body.is_not(None),
                            WhatsAppMessage.message_type != "status",
                        )
                        .order_by(WhatsAppMessage.received_at.desc())
                        .limit(6)
                    )).all()
                assistant.restore_conversation_history(key, [
                    {"role": "assistant" if message_type == "bot_text" else "user", "content": body or ""}
                    for message_type, body in reversed(saved_messages)
                ])
            business = merchant.business_name or merchant.name
            client = ConversationalWhatsAppClient(client, assistant, key, business, [
                getattr(merchant, "payout_bank_name", None) or "", getattr(merchant, "payout_account_name", None) or "",
                getattr(merchant, "payout_account_number", None) or "",
                *self._details_for(merchant.id, wa_id).values(),
            ], self._record_outbound_message)
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
                        await self._selected(merchant, wa_id, client, state, intent.product_id, intent.quantity or 1)
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
            if lower != "menu":
                self._details.pop((merchant.id, wa_id), None)
                self._basket_for(merchant.id, wa_id)
                self._baskets.pop((merchant.id, wa_id), None)
                await self._sync_basket(merchant, wa_id, client)
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
            await self._selected(merchant, wa_id, client, state, text.split(":", 1)[1], 1)
            return
        if state.step == "collection_select" and lower.startswith("collection:"):
            value = text.split(":", 1)[1]
            if value == "more":
                rows = [(f"collection:{index}", name) for index, name in enumerate(SCARF_COLLECTIONS[9:], 9)]
                await self._set_state(state, "collection_select", {"collection_page": 1, "basket_count": len(self._basket_for(merchant.id, wa_id))})
                await client.send_list(wa_id, "Choose another scarf collection.", rows)
                return
            try:
                collection = SCARF_COLLECTIONS[int(value)]
            except (ValueError, IndexError):
                await client.send_text(wa_id, "Please choose one of the collections shown.")
                return
            await self._menu(merchant, wa_id, client, search=collection)
            return
        if state.step == "collection_select" and message.get("type") == "text":
            if lower not in {"menu", "cancel", "start over", "more", "next"} and not lower.startswith("collection:"):
                await self._menu(merchant, wa_id, client, search=text)
                return
        if state.step == "start" and lower == "menu:more":
            await self._menu(merchant, wa_id, client, page=int(state.payload.get("menu_page", 0)) + 1,
                             search=state.payload.get("menu_search"))
            return
        if state.step == "start":
            if lower in {"hi", "hello", "start", ""}:
                await client.send_text(wa_id, f"Hi! Welcome to {merchant.business_name or merchant.name}. What are you looking for today?")
                return
            async with self._sessions() as exact:
                matches = list((await exact.scalars(select(ProductCache).where(
                    ProductCache.merchant_id == merchant.id,
                    ProductCache.is_published.is_(True),
                    (ProductCache.stock_qty.is_(None) | (ProductCache.stock_qty > 0)),
                    func.lower(ProductCache.name).ilike(f"%{lower[:80]}%"),
                ))).all())
            matches = _unique_offers(matches)
            if len(matches) == 1:
                await self._selected(merchant, wa_id, client, state, matches[0].bumpa_product_id, 1)
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
                product, _ = await self._product(merchant, payload["product_id"])
                if product and product.is_published:
                    await self._add_selection(merchant, wa_id, client, state, {**payload, "qty": qty}, product)
                return
            await client.send_text(wa_id, "Reply with a quantity from 1 to 100.")
            return
        elif state.step == "payment_method" and lower in {"pay_online", "pay_transfer"}:
            transfer_payload = {**payload, "payment_method": "transfer"}
            await self._set_state(state, "payment_method", transfer_payload)
            await self._checkout_details(merchant, wa_id, client, state)
            return
        elif state.step == "full_name":
            names = text.split(maxsplit=1)
            if not 2 <= len(text) <= 240 or len(names) != 2:
                await client.send_text(wa_id, "Please send your first and last name so Bumpa can attach them to your order.")
                return
            first, last = names
            self._put_detail(merchant.id, wa_id, "first_name", first)
            self._put_detail(merchant.id, wa_id, "last_name", last)
            await self._checkout_details(merchant, wa_id, client, state)
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
            address = await assistant.delivery_address(text) if assistant is not None and assistant.enabled else await geocode_delivery_address(text)
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
            await self._start_transfer(merchant, wa_id, client, state, state.payload)
            return
        await client.send_text(wa_id, "Please use the choices shown, or send MENU to browse and CANCEL to start over.")
