"""Headless Bumpa checkout; customer details are passed through, never persisted."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID

import httpx
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.db.bumpa_repository import get_connection, save_checkout_ref
from app.db.models import BumpaConnection, CheckoutRef, Vendor
from app.integrations.bumpa import mappers
from app.integrations.bumpa.client import (
    BumpaAuthError,
    BumpaClient,
    BumpaError,
    BumpaNotFound,
    BumpaRateLimited,
    BumpaUnavailable,
    BumpaValidationError,
)
from app.integrations.bumpa.credentials import decrypt_credential
from app.services.bumpa_sync import refresh_product_live


class CheckoutError(Exception):
    """Safe checkout failure suitable for a short customer response."""


class CheckoutUnavailable(CheckoutError):
    pass


class CheckoutConnectionInvalid(CheckoutError):
    pass


class CheckoutRejected(CheckoutError):
    pass


class CheckoutPostcodeRequired(CheckoutRejected):
    pass


class CustomerDetails(BaseModel):
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=30)


class CheckoutItem(BaseModel):
    product_id: str = Field(min_length=1, max_length=120)
    variation_id: str | None = Field(default=None, max_length=120)
    qty: int = Field(ge=1, le=100)


class FulfilmentDetails(BaseModel):
    type: Literal["delivery", "pickup"]
    street: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    zip: str | None = None
    pickup_location_id: str | None = None
    shipping_id: str | None = None


@dataclass(frozen=True)
class CheckoutResult:
    checkout_id: str
    order_id: str | None
    authorization_url: str
    reference: str
    amount: Decimal
    currency: str
    local_ref_id: UUID


async def _client_for_merchant(
    merchant_id: UUID,
    session_factory: async_sessionmaker[AsyncSession],
    http_client: httpx.AsyncClient,
    settings: Settings,
) -> BumpaClient:
    async with session_factory() as session:
        connection = await get_connection(session, merchant_id)
        if connection is None or connection.status != "active":
            raise CheckoutConnectionInvalid("This shop's Bumpa connection needs attention")
        return BumpaClient(
            settings.bumpa_base_url,
            decrypt_credential(connection.public_key_enc, settings),
            decrypt_credential(connection.secret_key_enc, settings) if connection.secret_key_enc else None,
            connection.location_id,
            http_client,
        )


async def _flag_invalid(merchant_id: UUID, session_factory: async_sessionmaker[AsyncSession]) -> None:
    async with session_factory() as session:
        await session.execute(
            update(BumpaConnection)
            .where(BumpaConnection.merchant_id == merchant_id)
            .values(status="invalid")
        )
        await session.commit()


def _customer_context(customer: CustomerDetails) -> dict[str, Any]:
    context: dict[str, Any] = {
        "email": str(customer.email),
        "first_name": customer.first_name,
        "last_name": customer.last_name,
    }
    if customer.phone:
        context["phone"] = customer.phone
    return context


def _delivery_context(customer: CustomerDetails, fulfilment: FulfilmentDetails) -> dict[str, Any]:
    # Bumpa's checkout marks city as optional. Requiring it here prevents
    # valid state-based delivery rules, such as Kwara-wide options, from
    # reaching Bumpa's shipping calculator.
    if not all((fulfilment.street, fulfilment.state, fulfilment.country)):
        raise CheckoutRejected("Delivery address is incomplete")
    context = {
        "type": "delivery",
        **_customer_context(customer),
        "phone": customer.phone or "",
        "street": fulfilment.street,
        "state": fulfilment.state,
        "country": fulfilment.country,
        # TODO(BUMPA_OPTIONAL_POSTCODE): verify empty zip support on staging.
        # Ask only if Bumpa rejects it; never invent a customer's postcode.
        "zip": fulfilment.zip or "",
    }
    if fulfilment.city:
        context["city"] = fulfilment.city
    return context


async def _new_cart(client: BumpaClient, product_id: str, variation_id: str | None, qty: int, items: list[CheckoutItem] | None = None) -> tuple[str, str]:
    created = await client.create_cart()
    cart_id = mappers.extract_cart_id(created)
    cart_token = mappers.extract_cart_token(created)
    if cart_id is None:
        raise CheckoutRejected("Bumpa did not return a cart ID")
    if cart_token is None:
        raise CheckoutRejected("Bumpa did not return a guest cart token")
    for item in items or [CheckoutItem(product_id=product_id, variation_id=variation_id, qty=qty)]:
        added = await client.add_cart_item(cart_token, item.product_id, item.qty, item.variation_id)
        cart_token = mappers.extract_cart_token(added) or cart_token
    return cart_id, cart_token


async def list_shipping_options(
    merchant: Vendor,
    product_id: str,
    variation_id: str | None,
    qty: int,
    customer: CustomerDetails,
    fulfilment: FulfilmentDetails,
    *,
    session_factory: async_sessionmaker[AsyncSession],
    http_client: httpx.AsyncClient,
    settings: Settings,
    items: list[CheckoutItem] | None = None,
    cart_id: str | None = None,
    cart_token: str | None = None,
) -> list[dict[str, Any]]:
    if qty < 1 or fulfilment.type != "delivery":
        raise CheckoutRejected("A delivery product and quantity are required")
    client = await _client_for_merchant(merchant.id, session_factory, http_client, settings)
    try:
        if cart_id is None:
            cart_id, _token = await _new_cart(client, product_id, variation_id, qty, items)
        response = await client.shipping_options(cart_id, _delivery_context(customer, fulfilment), cart_token=cart_token)
        return mappers.extract_shipping_options(response)
    except BumpaAuthError as exc:
        await _flag_invalid(merchant.id, session_factory)
        raise CheckoutConnectionInvalid("This shop's Bumpa connection needs attention") from exc
    except (BumpaRateLimited, BumpaUnavailable) as exc:
        raise CheckoutUnavailable("Checkout is temporarily unavailable; please try again shortly") from exc
    except BumpaValidationError as exc:
        if not fulfilment.zip and mappers.extract_requires_postcode(exc.errors_payload):
            raise CheckoutPostcodeRequired("Bumpa requires a delivery postcode") from exc
        raise CheckoutRejected("Bumpa could not calculate shipping") from exc
    except BumpaError as exc:
        raise CheckoutRejected("Bumpa could not calculate shipping") from exc


async def start_checkout(
    merchant: Vendor,
    product_id: str,
    variation_id: str | None,
    qty: int,
    customer: CustomerDetails,
    fulfilment: FulfilmentDetails,
    customer_wa_id: str,
    *,
    session_factory: async_sessionmaker[AsyncSession],
    http_client: httpx.AsyncClient,
    settings: Settings,
    items: list[CheckoutItem] | None = None,
    cart_id: str | None = None,
    cart_token: str | None = None,
) -> CheckoutResult:
    if qty < 1 or qty > 100:
        raise CheckoutRejected("Quantity must be between 1 and 100")
    basket = items or [CheckoutItem(product_id=product_id, variation_id=variation_id, qty=qty)]
    if len(basket) > 20:
        raise CheckoutRejected("A checkout supports up to 20 products")
    for item in basket:
        cached, _cached_only = await refresh_product_live(
            merchant.id, item.product_id,
            session_factory=session_factory, http_client=http_client, settings=settings,
        )
        if cached and cached.stock_qty is not None and cached.stock_qty < item.qty:
            raise CheckoutRejected("This product is out of stock")
    client = await _client_for_merchant(merchant.id, session_factory, http_client, settings)
    try:
        if cart_id is None:
            cart_id, _token = await _new_cart(client, product_id, variation_id, qty, basket)
        if fulfilment.type == "pickup":
            pickup_id = fulfilment.pickup_location_id or merchant.pickup_location_id
            if not pickup_id:
                raise CheckoutRejected("Pickup is not configured for this shop")
            checkout_fulfilment = {"type": "pickup", "pickup_location_id": pickup_id}
        else:
            shipping_response = await client.shipping_options(cart_id, _delivery_context(customer, fulfilment), cart_token=cart_token)
            options = mappers.extract_shipping_options(shipping_response)
            chosen = next((option for option in options if mappers.extract_shipping_id(option) == fulfilment.shipping_id), None)
            if chosen is None or fulfilment.shipping_id is None:
                raise CheckoutRejected("Choose an available shipping option")
            # TODO(BUMPA_SHIPPING_FIELD): staging must confirm shipping_method_id
            # versus shipping_id in the create-checkout request.
            checkout_fulfilment = {"type": "delivery", "shipping_method_id": fulfilment.shipping_id}
        created = await client.create_checkout(cart_id, _customer_context(customer), checkout_fulfilment)
        checkout_id = mappers.extract_checkout_id(created)
        if checkout_id is None:
            raise CheckoutRejected("Bumpa did not return a checkout ID")
        await client.calculate_totals(checkout_id)
        intent = await client.payment_intent(checkout_id)
        authorization_url = mappers.extract_authorization_url(intent)
        reference = mappers.extract_payment_reference(intent)
        amount = mappers.extract_amount(intent)
        currency = mappers.extract_currency(intent)
        if authorization_url is None or reference is None or amount is None or currency is None:
            raise CheckoutRejected("Bumpa payment details were incomplete")
        order_id = mappers.extract_order_id(intent)
        async with session_factory() as session:
            local_ref = await save_checkout_ref(
                session, merchant.id, checkout_id, customer_wa_id,
                order_id=order_id, payment_reference=reference,
            )
            await session.commit()
            local_ref_id = local_ref.id
        return CheckoutResult(checkout_id, order_id, authorization_url, reference, amount, currency, local_ref_id)
    except BumpaAuthError as exc:
        await _flag_invalid(merchant.id, session_factory)
        raise CheckoutConnectionInvalid("This shop's Bumpa connection needs attention") from exc
    except (BumpaRateLimited, BumpaUnavailable) as exc:
        raise CheckoutUnavailable("Checkout is temporarily unavailable; please try again shortly") from exc
    except BumpaError as exc:
        raise CheckoutRejected("Bumpa could not create this checkout") from exc


async def check_payment(
    merchant: Vendor,
    checkout_ref: CheckoutRef,
    *,
    session_factory: async_sessionmaker[AsyncSession],
    http_client: httpx.AsyncClient,
    settings: Settings,
) -> Literal["paid", "pending", "failed"]:
    if checkout_ref.merchant_id != merchant.id:
        raise CheckoutRejected("Checkout was not found for this shop")
    client = await _client_for_merchant(merchant.id, session_factory, http_client, settings)
    try:
        try:
            response = await client.get_checkout(checkout_ref.bumpa_checkout_id)
        except (BumpaNotFound, BumpaRateLimited, BumpaUnavailable):
            if not (checkout_ref.bumpa_order_id and client.has_secret_key):
                raise
            response = {}
        status = (mappers.extract_payment_status(response) or "").lower()
        if status in {"paid", "success", "successful", "completed"}:
            return "paid"
        if status in {"failed", "cancelled", "canceled"}:
            return "failed"
        if checkout_ref.bumpa_order_id and client.has_secret_key:
            orders = await client.list_orders(search=checkout_ref.bumpa_order_id, limit=1)
            for order in mappers.extract_order_rows(orders):
                if mappers.extract_order_id(order) == checkout_ref.bumpa_order_id:
                    order_status = (mappers.extract_payment_status(order) or "").lower()
                    if order_status in {"paid", "success", "successful", "completed"}:
                        return "paid"
                    if order_status in {"failed", "cancelled", "canceled"}:
                        return "failed"
        return "pending"
    except BumpaAuthError as exc:
        await _flag_invalid(merchant.id, session_factory)
        raise CheckoutConnectionInvalid("This shop's Bumpa connection needs attention") from exc
    except (BumpaRateLimited, BumpaUnavailable) as exc:
        raise CheckoutUnavailable("Payment status is temporarily unavailable") from exc
    except BumpaError as exc:
        raise CheckoutRejected("Bumpa could not read this checkout") from exc


async def finalize(
    merchant: Vendor,
    checkout_ref: CheckoutRef,
    *,
    session_factory: async_sessionmaker[AsyncSession],
    http_client: httpx.AsyncClient,
    settings: Settings,
) -> dict[str, Any] | None:
    if checkout_ref.merchant_id != merchant.id:
        raise CheckoutRejected("Checkout was not found for this shop")
    client = await _client_for_merchant(merchant.id, session_factory, http_client, settings)
    try:
        response = await client.finalize(checkout_ref.bumpa_checkout_id)
        return response if isinstance(response, dict) else None
    except BumpaValidationError as exc:
        if "payment has not been confirmed" in str(exc.errors_payload).lower():
            return None
        raise CheckoutRejected("Bumpa could not finalize the checkout") from exc
    except BumpaAuthError as exc:
        await _flag_invalid(merchant.id, session_factory)
        raise CheckoutConnectionInvalid("This shop's Bumpa connection needs attention") from exc
    except (BumpaRateLimited, BumpaUnavailable) as exc:
        raise CheckoutUnavailable("Payment confirmation is temporarily unavailable") from exc
    except BumpaError as exc:
        raise CheckoutRejected("Bumpa could not finalize the checkout") from exc
