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
    return str(text.get("body", "")).strip() if isinstance(text, dict) else ""


class TransferService:
    def __init__(self, sessions: async_sessionmaker[AsyncSession], http_client: httpx.AsyncClient, settings: Settings) -> None:
        self.sessions = sessions
        self.http = http_client
        self.settings = settings
        self.on_confirm: Callable[[PendingTransfer], Awaitable[None]] | None = None

    def client_for(self, merchant: Vendor) -> WhatsAppClient | None:
        if not merchant.whatsapp_phone_number_id or not merchant.whatsapp_token_enc:
            return None
        token = decrypt_credential(merchant.whatsapp_token_enc, self.settings)
        return MetaWhatsAppClient(self.settings.whatsapp_api_base, merchant.whatsapp_phone_number_id, token, self.http)

    async def create(
        self, merchant: Vendor, customer_wa_id: str, product_id: str, qty: int, client: WhatsAppClient,
        *, items: list[dict[str, Any]] | None = None,
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
            if product is None or not product.is_published or product.price is None or product.currency != "NGN":
                await client.send_text(customer_wa_id, "One of the items cannot be quoted for transfer right now.")
                return None
            if product.stock_qty is not None and product.stock_qty < item_qty:
                await client.send_text(customer_wa_id, f"{product.name or 'An item'} is not available in that quantity.")
                return None
            if cached_only:
                await client.send_text(customer_wa_id, "Bumpa is unavailable, so I cannot confirm the transfer total. Please try again shortly.")
                return None
            line_total = product.price * item_qty
            amount += line_total
            quoted.append({"product_id": item["product_id"], "variation_id": item.get("variation_id"), "qty": item_qty, "name": product.name, "unit_price": str(product.price)})
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
            f"Pay {_amount(amount)} to {merchant.payout_bank_name}, {merchant.payout_account_name}, "
            f"account {merchant.payout_account_number}. Put {row.reference} in the transfer narration. "
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
            reference, amount, product_id, qty = row.reference, row.amount, row.bumpa_product_id, row.quantity
            await session.commit()
        await client.send_text(wa_id, f"Thanks. We have sent {reference} to the owner for a bank check. A screenshot or message alone does not confirm payment.")
        if first_proof and merchant.owner_whatsapp_number:
            notice = (
                f"Transfer {reference}: product {product_id} × {qty}, {_amount(amount)}, customer {wa_id}. "
                "A screenshot or 'I've paid' is never proof of payment. Verify in your bank app, "
                f"record the sale in Bumpa, then reply CONFIRM {reference} or REJECT {reference}."
            )
            template = self.settings.whatsapp_template_owner_transfer_alert
            if template:
                await client.send_template(merchant.owner_whatsapp_number, template, "en_US", [reference, product_id, str(qty), _amount(amount), wa_id])
            else:
                # TODO(WHATSAPP_OWNER_TEMPLATE): register this template for alerts
                # outside the owner conversation window.
                await client.send_text(merchant.owner_whatsapp_number, notice)
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
                await client.send_text(customer_wa_id, f"The owner confirmed transfer {reference}. The owner will send your invoice after recording the sale in Bumpa.")
            else:
                await client.send_text(customer_wa_id, f"The owner could not verify transfer {reference}. Please contact the shop to resolve it.")
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
