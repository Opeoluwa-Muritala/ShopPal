"""Idempotent WhatsApp bank-transfer payment orchestration."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from urllib.parse import quote
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db.models import Cart, Customer, Order, Vendor, WebhookEvent
from app.logging_conf import logger
from app.services.flutterwave_v4 import FlutterwaveClientError, VirtualAccountProvider, get_virtual_account_provider
from app.services.receipt_images import render_payment_receipt
from app.services.whatsapp import send_whatsapp_buttons, send_whatsapp_cta_url, send_whatsapp_image_bytes, send_whatsapp_text


def _money(value: Decimal) -> str:
    return f"₦{value:,.2f}"


def _confirmation_caption(order: Order) -> str:
    reference = order.tx_ref or getattr(order, "order_code", None) or str(getattr(order, "id", "order"))
    lines = [
        "Payment received ✅",
        f"Order {reference} for {_money(Decimal(order.total))} is confirmed.",
        "Keep this receipt for your records. We’ll message you when your order is ready.",
    ]
    return "\n\n".join(lines)


async def _send_payment_confirmation(order: Order, settings: Settings, public_number: str = "") -> None:
    """Send a visual receipt, falling back to its full caption on media failure."""
    caption = _confirmation_caption(order)
    reference = order.tx_ref or getattr(order, "order_code", None) or str(getattr(order, "id", "order"))
    receipt = render_payment_receipt(
        business_name="ShopPal",
        order_reference=order.tx_ref or getattr(order, "order_code", None) or str(getattr(order, "id", "order")),
        amount=Decimal(order.total),
        items=list(getattr(order, "items", None) or []),
        paid_at=order.paid_at,
    )
    result = await send_whatsapp_image_bytes(
        order.wa_number or order.customer_phone,
        receipt,
        "image/png",
        caption,
        settings,
    )
    if result.get("ok") is False:
        await send_whatsapp_text(order.wa_number or order.customer_phone, caption, settings)
    digits = "".join(ch for ch in public_number if ch.isdigit())
    if digits:
        prompt = quote(f"Hi, I need help with order {reference}", safe="")
        await send_whatsapp_cta_url(
            order.wa_number or order.customer_phone,
            f"Need help with order {reference}? Tap below to open a prefilled support message.",
            "Get order help",
            f"https://wa.me/{digits}?text={prompt}",
            settings,
        )


async def create_bank_transfer_order(
    session: AsyncSession,
    *,
    vendor_id,
    wa_number: str,
    amount: Decimal,
    items: list,
    delivery_address: str | None,
    settings: Settings,
) -> Order:
    """Create one pending order and its dynamic account, with provider idempotency."""
    active = await session.scalar(select(Order).where(Order.wa_number == wa_number, Order.payment_status == "pending_payment", Order.expires_at > datetime.now(UTC)).with_for_update())
    if active is not None:
        return active
    tx_ref = f"ord-{uuid4().hex[:24]}"
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.order_expiry_minutes)
    order = Order(order_code=tx_ref[:20], vendor_id=vendor_id, customer_phone=wa_number, wa_number=wa_number, items=items, total=amount, currency="NGN", status="pending", payment_status="pending_payment", payment_provider="flutterwave", tx_ref=tx_ref, expires_at=expires_at, delivery_address=delivery_address)
    session.add(order)
    await session.flush()

    customer = await session.scalar(select(Customer).where(Customer.wa_number == wa_number).with_for_update())
    provider = get_virtual_account_provider(settings)
    if customer is None:
        customer = Customer(wa_number=wa_number)
        session.add(customer)
        await session.flush()
    if not customer.fw_customer_id:
        customer.fw_customer_id = await provider.create_customer(wa_number)
    account = await provider.create_virtual_account(customer_id=customer.fw_customer_id, tx_ref=tx_ref, amount=amount, expires_seconds=settings.order_expiry_minutes * 60)
    order.fw_reference = account.provider_reference
    order.account_number = account.account_number
    order.bank_name = account.bank_name
    await session.commit()
    logger.info("Dynamic virtual account created", extra={"step": "payment_account_created", "tx_ref": tx_ref, "status": "pending"})
    return order


async def send_payment_instructions(order: Order, settings: Settings) -> None:
    expiry = order.expires_at.astimezone(UTC).strftime("%d %b %Y %H:%M UTC") if order.expires_at else "soon"
    body = (f"Payment instructions for {order.tx_ref}\n\nBank: {order.bank_name}\nAccount number: {order.account_number}\nAmount: {_money(Decimal(order.total))}\nExpiry: {expiry}\nReference: {order.tx_ref}\n\nTransfer the exact amount from your bank app. You can stay in WhatsApp.")
    await send_whatsapp_buttons(order.wa_number or order.customer_phone, body, [(f"payment_paid:{order.tx_ref}", "I've paid"), (f"payment_cancel:{order.tx_ref}", "Cancel")], settings)


async def confirm_verified_charge(session: AsyncSession, *, transaction_id: str, payload: dict, settings: Settings, provider: VirtualAccountProvider | None = None) -> str:
    """Verify a provider notification, then atomically transition one order."""
    provider = provider or get_virtual_account_provider(settings)
    verified = await provider.verify_charge(transaction_id)
    public_number = settings.whatsapp_public_number
    async with session.begin():
        order = await session.scalar(select(Order).where(Order.tx_ref == verified.reference).with_for_update())
        if order is None:
            return "ignored"
        vendor_id = getattr(order, "vendor_id", None)
        if vendor_id is not None:
            vendor = await session.scalar(select(Vendor).where(Vendor.id == vendor_id))
            public_number = (
                getattr(vendor, "bot_number", None)
                or getattr(vendor, "whatsapp_number", None)
                or public_number
            )
        expected = Decimal(order.total)
        if verified.status not in {"succeeded", "successful"} or order.currency != verified.currency or expected != verified.amount or order.payment_status != "pending_payment" or (order.expires_at and order.expires_at <= datetime.now(UTC)):
            order.payment_status = "review"
            order.status = "review"
            recipient = order.wa_number or order.customer_phone
            review_message = f"We received a transfer for {order.tx_ref}, but it needs a manual check. Support is reviewing it before fulfilment."
            review_recipient = recipient
        else:
            review_recipient = None
            order.payment_status = "paid"
            order.status = "paid"
            order.paid_at = datetime.now(UTC)
            order.payment_transaction_id = verified.transaction_id
            order.fw_transaction_id = verified.transaction_id
            order.payment_confirmation_source = "flutterwave_webhook"
    if review_recipient:
        await send_whatsapp_text(review_recipient, review_message, settings)
        return "review"
    await _send_payment_confirmation(order, settings, public_number)
    return "paid"


async def process_flutterwave_webhook(payload: dict, settings: Settings) -> str:
    transaction_id = str((payload.get("data") or {}).get("id") or payload.get("id") or "")
    if not transaction_id:
        return "ignored"
    from app.db.session import get_async_session_factory
    async with get_async_session_factory()() as session:
        existing = await session.scalar(select(WebhookEvent).where(WebhookEvent.fw_transaction_id == transaction_id))
        if existing is not None and existing.processed_at is not None:
            return "duplicate"
        if existing is None:
            existing = WebhookEvent(fw_transaction_id=transaction_id, payload=payload)
            session.add(existing)
            await session.commit()
        try:
            result = await confirm_verified_charge(session, transaction_id=transaction_id, payload=payload, settings=settings)
            existing.processed_at = datetime.now(UTC)
            await session.commit()
            return result
        except FlutterwaveClientError:
            logger.warning("Flutterwave verification deferred", extra={"step": "payment_verify", "tx_ref": str((payload.get("data") or {}).get("tx_ref", "")), "status": "retryable"})
            return "retryable"


async def handle_whatsapp_payment_action(action: str, *, tx_ref: str | None, wa_number: str, bot_number: str | None, settings: Settings) -> None:
    """Handle only payment buttons; catalog/LLM messages remain on the existing worker."""
    from app.db.session import get_async_session_factory
    async with get_async_session_factory()() as session:
        if action == "pay":
            normalized_bot = "".join(ch for ch in (bot_number or "") if ch.isdigit())
            normalized_customer = "".join(ch for ch in wa_number if ch.isdigit())
            result = await session.execute(select(Cart, Vendor).join(Vendor, Vendor.id == Cart.vendor_id).where(Cart.customer_phone.in_([wa_number, normalized_customer]), Vendor.is_active.is_(True)).order_by(Cart.updated_at.desc()))
            row = result.first()
            if row is None:
                await send_whatsapp_text(wa_number, "I couldn't find an active cart. Please choose your items again.", settings)
                return
            cart, vendor = row
            if normalized_bot and normalized_bot not in {"".join(ch for ch in (vendor.bot_number or "") if ch.isdigit()), "".join(ch for ch in vendor.whatsapp_number if ch.isdigit())}:
                await send_whatsapp_text(wa_number, "This checkout session is no longer active. Please start again.", settings)
                return
            items = list(cart.items or [])
            amount = sum((Decimal(str(item["price"])) * int(item["qty"]) for item in items), Decimal("0"))
            if amount <= 0:
                await send_whatsapp_text(wa_number, "Your cart is empty. Please add an item before paying.", settings)
                return
            order = await create_bank_transfer_order(session, vendor_id=vendor.id, wa_number=wa_number, amount=amount, items=items, delivery_address=None, settings=settings)
            await send_payment_instructions(order, settings)
            return
        if not tx_ref:
            return
        order = await session.scalar(select(Order).where(Order.tx_ref == tx_ref, Order.wa_number == wa_number).with_for_update())
        if order is None:
            await send_whatsapp_text(wa_number, "I couldn't find that payment request. Please start checkout again.", settings)
            return
        if order.payment_status == "paid":
            await send_whatsapp_text(wa_number, f"Payment for {tx_ref} is already confirmed.", settings)
            return
        if action == "cancel":
            if order.payment_status == "pending_payment":
                order.payment_status = "cancelled"
                order.status = "cancelled"
                await session.commit()
            await send_whatsapp_text(wa_number, "Payment request cancelled. You can start again any time.", settings)
            return
        provider = get_virtual_account_provider(settings)
        charge = await provider.find_charge(tx_ref)
        if charge is None or charge.status not in {"succeeded", "successful"}:
            await send_whatsapp_text(wa_number, "Still waiting for your transfer. Send the exact amount to the account above and tap I've paid again.", settings)
            return
        await session.commit()
        await confirm_verified_charge(session, transaction_id=charge.transaction_id, payload={}, settings=settings, provider=provider)
