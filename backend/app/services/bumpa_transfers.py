"""Human-verified transfer fallback; Bumpa remains the order ledger."""

import secrets
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.db.bumpa_repository import save_pending_transfer
from app.db.models import ConversationState, PendingTransfer, Vendor
from app.integrations.bumpa.credentials import decrypt_credential
from app.integrations.whatsapp.client import MetaWhatsAppClient, WhatsAppClient
from app.logging_conf import logger
from app.services.bumpa_sync import refresh_product_live
from app.services.bumpa_whatsapp import has_open_capacity
from app.services.email_alert import send_email

TRANSFER_TTL = timedelta(hours=24)
REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


def _reference() -> str:
    return "SHP-" + "".join(secrets.choice(REFERENCE_ALPHABET) for _ in range(4))


def _same_number(left: str, right: str | None) -> bool:
    return right is not None and bool(right) and left.lstrip("+") == right.lstrip("+")


def _amount(amount: Decimal) -> str:
    return f"NGN {amount:,.2f}"


def _message_text(message: dict[str, Any]) -> str:
    text = message.get("text")
    if isinstance(text, dict):
        return str(text.get("body", "")).strip()
    if message.get("type") == "button":
        button = message.get("button")
        return str(button.get("payload", "")).strip() if isinstance(button, dict) else ""
    if message.get("type") == "interactive":
        interactive = message.get("interactive") or {}
        reply = interactive.get("button_reply") or {}
        return str(reply.get("id", "")).strip()
    return ""


class TransferService:
    def __init__(self, sessions: async_sessionmaker[AsyncSession], http_client: httpx.AsyncClient, settings: Settings) -> None:
        self.sessions = sessions
        self.http = http_client
        self.settings = settings
        self.on_confirm: Callable[[PendingTransfer], Awaitable[None]] | None = None
        self.on_owner_notified: Callable[[str, str], Awaitable[None]] | None = None

    async def resend(self, merchant: Vendor, wa_id: str, client: WhatsAppClient) -> bool:
        """Resend active transfer instructions instead of an online link."""
        async with self.sessions() as session:
            row = await session.scalar(
                select(PendingTransfer).where(
                    PendingTransfer.merchant_id == merchant.id,
                    PendingTransfer.customer_wa_id == wa_id,
                    PendingTransfer.status.in_(["awaiting_proof", "proof_received"]),
                ).order_by(PendingTransfer.created_at.desc())
            )
        if row is None:
            return False
        await client.send_text(
            wa_id,
            f"*Amount to pay:*\n{_amount(row.amount)}\n\n"
            f"*Bank:*\n{merchant.payout_bank_name}\n"
            f"*Account name:*\n{merchant.payout_account_name}\n"
            f"*Account number:*\n{merchant.payout_account_number}\n\n"
            f"Put {row.reference} in the transfer narration. "
            "Send 'I've paid' or a screenshot of your receipt when done. "
            "Your payment is confirmed only after the owner checks their bank.",
        )
        return True

    def client_for(self, merchant: Vendor) -> WhatsAppClient | None:
        if not merchant.whatsapp_phone_number_id or not merchant.whatsapp_token_enc:
            return None
        token = decrypt_credential(merchant.whatsapp_token_enc, self.settings)
        return MetaWhatsAppClient(self.settings.whatsapp_api_base, merchant.whatsapp_phone_number_id, token, self.http)

    async def create(
        self, merchant: Vendor, customer_wa_id: str, product_id: str, qty: int, client: WhatsAppClient,
        *, items: list[dict[str, Any]] | None = None,
        delivery_fee: Decimal = Decimal("0"), delivery_name: str | None = None,
        delivery_address: str | None = None,
        customer_name: str | None = None, customer_phone: str | None = None,
    ) -> PendingTransfer | None:
        if qty < 1 or qty > 100:
            await client.send_text(customer_wa_id, "Choose a quantity from 1 to 100 first.")
            return None
        if not all((merchant.payout_bank_name, merchant.payout_account_name, merchant.payout_account_number)):
            await client.send_text(customer_wa_id, "Bank transfer is not configured for this shop.")
            return None
        basket = items or [{"product_id": product_id, "variation_id": None, "qty": qty}]
        quoted: list[dict[str, Any]] = []
        amount = Decimal(0)
        for item in basket:
            product, cached_only = await refresh_product_live(
                merchant.id, item["product_id"], session_factory=self.sessions, http_client=self.http, settings=self.settings,
            )
            item_qty = int(item["qty"])
            currency = (product.currency or "NGN").upper() if product is not None else None
            if product is None:
                reason = "missing_product"
            elif not product.is_published:
                reason = "unpublished_product"
            elif product.price is None:
                reason = "missing_price"
            elif currency != "NGN":
                reason = "unsupported_currency"
            else:
                reason = None
            if reason is not None:
                logger.warning("Transfer item could not be quoted", extra={
                    "step": "bumpa_transfer_quote",
                    "merchant_id": str(merchant.id),
                    "product_id": str(item.get("product_id", ""))[:120],
                    "reason": reason,
                })
                await client.send_text(customer_wa_id, "One of the items cannot be quoted for transfer right now.")
                return None
            if product.stock_qty is not None and product.stock_qty < item_qty:
                await client.send_text(customer_wa_id, f"{product.name or 'An item'} is not available in that quantity.")
                return None
            line_total = product.price * item_qty
            amount += line_total
            quoted.append({"product_id": item["product_id"], "variation_id": item.get("variation_id"), "qty": item_qty, "name": product.name, "unit_price": str(product.price), "currency": currency, "cached_only": cached_only})
        if delivery_fee < 0:
            raise ValueError("Invalid delivery fee")
        amount += delivery_fee
        if delivery_name or delivery_address:
            quoted.append({"type": "delivery", "name": delivery_name or "Delivery", "fee": str(delivery_fee), "address": delivery_address})
        quoted.append({"type": "customer", "name": (customer_name or "").strip()[:120],
                       "phone": (customer_phone or customer_wa_id)[:30]})
        row: PendingTransfer | None = None
        for _ in range(5):
            try:
                async with self.sessions() as session:
                    await session.scalar(select(ConversationState).where(
                        ConversationState.merchant_id == merchant.id,
                        ConversationState.customer_wa_id == customer_wa_id,
                    ).with_for_update())
                    if not await has_open_capacity(session, merchant.id, customer_wa_id, kind="transfer"):
                        await client.send_text(customer_wa_id, "You have three pending transfers. Please resolve one before starting another.")
                        return None
                    row = await save_pending_transfer(session, merchant.id, _reference(), product_id, qty, amount, customer_wa_id, items=quoted)
                    await session.commit()
                    break
            except IntegrityError:
                continue
        if row is None:
            await client.send_text(customer_wa_id, "Transfer instructions are temporarily unavailable. Please try again.")
            return None
        await client.send_text(
            customer_wa_id,
            f"*Amount to pay:*\n{_amount(amount)}\n\n"
            f"*Bank:*\n{merchant.payout_bank_name}\n"
            f"*Account name:*\n{merchant.payout_account_name}\n"
            f"*Account number:*\n{merchant.payout_account_number}\n\n"
            f"Put {row.reference} in the transfer narration. "
            "Send 'I've paid' or a screenshot of your receipt when done. Your payment is confirmed only after the owner checks their bank.",
        )
        return row

    async def customer_proof(self, merchant: Vendor, message: dict[str, Any], client: WhatsAppClient) -> bool:
        wa_id = str(message.get("from") or "")
        if not wa_id:
            return False
        text = _message_text(message).casefold().replace("’", "'")
        is_paid = text in {"i've paid", "ive paid", "paid"}
        image = message.get("image") if message.get("type") == "image" else None
        media_id = image.get("id") if isinstance(image, dict) else None
        if not is_paid and not media_id:
            return False
        async with self.sessions() as session:
            row = await session.scalar(
                select(PendingTransfer).where(
                    PendingTransfer.merchant_id == merchant.id,
                    PendingTransfer.customer_wa_id == wa_id,
                    PendingTransfer.status.in_(["awaiting_proof", "proof_received"]),
                ).order_by(PendingTransfer.created_at.desc()).with_for_update()
            )
            if row is None:
                return False
            first_proof = row.status == "awaiting_proof"
            row.status = "proof_received"
            if isinstance(media_id, str) and len(media_id) <= 255:
                row.proof_media_id = media_id
            reference, amount = row.reference, row.amount
            await session.commit()
        if first_proof:
            await send_email(
                self.http,
                self.settings.email_api_url,
                self.settings.owner_alert_email,
                f"Payment alert: {reference}",
                f"Order {reference} got a {'payment claim' if is_paid else 'receipt screenshot'}. "
                f"Customer: {wa_id}. Amount: {_amount(amount)}. Verify the transfer in your bank app.",
            )
        send_buttons = getattr(client, "send_buttons", None)
        if send_buttons is not None:
            await send_buttons(
                wa_id,
                "While we wait for confirmation, would you like to order anything else?",
                [("order_more", "Yes, order more"), ("done_waiting", "No, that's all")],
            )
        if first_proof and merchant.owner_whatsapp_number:
            items = getattr(row, "items", None) or []
            delivery = next((item for item in items if item.get("type") == "delivery"), None)
            customer = next((item for item in items if item.get("type") == "customer"), None)
            name = (customer or {}).get("name") or "Not provided"
            phone = (customer or {}).get("phone") or wa_id
            address = (delivery or {}).get("address") or "Pickup / not provided"
            products = ", ".join(
                f"{item.get('name') or item.get('product_id') or 'Product'} x {item.get('qty', 1)}"
                for item in items if item.get("type") not in {"delivery", "customer"}
            ) or f"{row.bumpa_product_id} x {row.quantity}"
            fulfilment = (delivery or {}).get("name") or "Pickup"
            notice = (
                f"Transfer {reference}\nCustomer: {name}\nPhone: {phone}\nWhatsApp: {wa_id}\n"
                f"Items: {products}\nAmount: {_amount(amount)}\nFulfilment: {fulfilment}\nAddress: {address}\n\n"
                "A screenshot or 'I've paid' is never proof of payment. Verify in your bank app, "
                f"then reply CONFIRM {reference} or REJECT {reference}. Record confirmed sales in Bumpa."
            )
            template = self.settings.whatsapp_template_owner_transfer_alert
            if template:
                await client.send_template(merchant.owner_whatsapp_number, template, "en_US",
                                           [reference, name, phone, wa_id, products, _amount(amount), fulfilment, address],
                                           buttons=[f"CONFIRM {reference}", f"REJECT {reference}"])
            else:
                # TODO(WHATSAPP_OWNER_TEMPLATE): register this template for alerts
                # outside the owner conversation window.
                await client.send_text(merchant.owner_whatsapp_number, notice)
            on_owner_notified = getattr(self, "on_owner_notified", None)
            if on_owner_notified is not None:
                await on_owner_notified(merchant.owner_whatsapp_number, notice)
        return True

    async def owner_action(self, merchant: Vendor, message: dict[str, Any], client: WhatsAppClient) -> bool:
        sender = str(message.get("from") or "")
        if not _same_number(sender, merchant.owner_whatsapp_number):
            return False
        words = _message_text(message).upper().split()
        if len(words) != 2 or words[0] not in {"CONFIRM", "REJECT"} or not words[1].startswith("SHP-"):
            return False
        action, reference = words
        async with self.sessions() as session:
            row = await session.scalar(
                select(PendingTransfer).where(
                    PendingTransfer.merchant_id == merchant.id,
                    PendingTransfer.reference == reference,
                    PendingTransfer.status.in_(["awaiting_proof", "proof_received"]),
                ).with_for_update()
            )
            if row is None:
                await client.send_text(sender, "That transfer reference is not open for this shop.")
                return True
            row.status = "confirmed" if action == "CONFIRM" else "rejected"
            row.resolved_at = datetime.now(UTC)
            customer_wa_id = row.customer_wa_id
            await session.commit()
        if customer_wa_id:
            if action == "CONFIRM":
                await client.send_text(customer_wa_id, f"Payment received for {reference}. The owner will send your invoice after recording the sale in Bumpa.")
            else:
                await client.send_text(customer_wa_id, f"Payment not received for {reference}. The owner could not verify the transfer. Please contact the shop to resolve it.")
        if action == "CONFIRM":
            if self.on_confirm:
                await self.on_confirm(row)
            await client.send_text(sender, f"Confirmed {reference}. Please record the sale in your Bumpa app; Bumpa stock only reduces once you do.")
        else:
            await client.send_text(sender, f"Rejected {reference}.")
        return True

    async def expire(self, *, now: datetime | None = None) -> int:
        now = now or datetime.now(UTC)
        async with self.sessions() as session:
            rows = (await session.scalars(
                select(PendingTransfer).where(
                    PendingTransfer.status.in_(["awaiting_proof", "proof_received"]),
                    PendingTransfer.created_at < now - TRANSFER_TTL,
                ).with_for_update(skip_locked=True)
            )).all()
            notices = []
            for row in rows:
                row.status = "expired"
                row.resolved_at = now
                merchant = await session.get(Vendor, row.merchant_id)
                if merchant is not None:
                    notices.append((merchant, row.reference, row.customer_wa_id))
            await session.commit()
        for merchant, reference, customer_wa_id in notices:
            client = self.client_for(merchant)
            if client is None:
                continue
            if customer_wa_id:
                template = self.settings.whatsapp_template_transfer_expiry
                if template:
                    await client.send_template(customer_wa_id, template, "en_US", [reference])
                else:
                    # TODO(WHATSAPP_TRANSFER_EXPIRY_TEMPLATE): an approved
                    # template is required after the 24-hour conversation window.
                    logger.warning("Transfer expiry customer template is not configured", extra={"step": "bumpa_transfer_expiry"})
            if merchant.owner_whatsapp_number:
                owner_template = self.settings.whatsapp_template_owner_transfer_expiry
                if owner_template:
                    await client.send_template(merchant.owner_whatsapp_number, owner_template, "en_US", [reference])
                else:
                    logger.warning("Transfer expiry owner template is not configured", extra={"step": "bumpa_transfer_expiry"})
        return len(notices)
