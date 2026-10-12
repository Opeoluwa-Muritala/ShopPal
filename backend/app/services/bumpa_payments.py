"""Nonblocking checkout polling; the Bumpa order is the source of truth."""

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.db.bumpa_repository import purge_expired_state
from app.db.models import CheckoutRef, Vendor
from app.integrations.bumpa import mappers
from app.integrations.bumpa.client import BumpaError
from app.integrations.whatsapp.client import WhatsAppClient
from app.logging_conf import logger
from app.services.bumpa_checkout import (
    CheckoutError,
    _client_for_merchant,
    check_payment,
    finalize,
)
from app.services.bumpa_transfers import TransferService

PAYMENT_WINDOW = timedelta(minutes=20)
FAST_WINDOW = timedelta(minutes=2)
Notification = Callable[[Vendor, CheckoutRef, dict[str, Any], WhatsAppClient], Awaitable[None]]


def next_poll(created_at: datetime, now: datetime) -> datetime | None:
    age = now - created_at
    if age >= PAYMENT_WINDOW:
        return None
    return now + timedelta(seconds=15 if age < FAST_WINDOW else 60)


class PaymentTracker:
    def __init__(
        self, sessions: async_sessionmaker[AsyncSession], http_client: httpx.AsyncClient,
        settings: Settings, notify_paid: Notification | None = None,
    ) -> None:
        self.sessions = sessions
        self.http = http_client
        self.settings = settings
        self.notify_paid = notify_paid or self._plain_confirmation
        self.transfers = TransferService(sessions, http_client, settings)

    async def _plain_confirmation(self, merchant: Vendor, ref: CheckoutRef, finalized: dict[str, Any], client: WhatsAppClient) -> None:
        if not ref.customer_wa_id:
            return
        amount = mappers.extract_amount(finalized)
        currency = mappers.extract_currency(finalized)
        amount_text = f" {currency or 'NGN'} {amount:,.2f}." if amount is not None else "."
        await client.send_text(ref.customer_wa_id, f"Shoppal payment confirmation: Bumpa order {ref.bumpa_order_id or ref.payment_reference or 'pending number'} paid{amount_text}")
        if merchant.owner_whatsapp_number:
            await client.send_text(merchant.owner_whatsapp_number, f"Bumpa order {ref.bumpa_order_id or ref.payment_reference or 'pending number'} has been paid. Manage it in your Bumpa app.")

    async def _claim(self, now: datetime, *, ref_id: UUID | None = None) -> tuple[CheckoutRef, Vendor] | None:
        async with self.sessions() as session:
            query = select(CheckoutRef).where(CheckoutRef.status == "awaiting_payment")
            if ref_id is None:
                query = query.where(CheckoutRef.next_poll_at <= now)
            else:
                query = query.where(CheckoutRef.id == ref_id)
            ref = await session.scalar(query.order_by(CheckoutRef.next_poll_at).with_for_update(skip_locked=True))
            if ref is None:
                return None
            merchant = await session.get(Vendor, ref.merchant_id)
            if merchant is None or merchant.catalog_provider != "bumpa":
                return None
            ref.next_poll_at = now + timedelta(minutes=1)
            await session.commit()
            return ref, merchant

    async def _mark(self, ref_id: UUID, **values: Any) -> None:
        async with self.sessions() as session:
            await session.execute(update(CheckoutRef).where(CheckoutRef.id == ref_id, CheckoutRef.status == "awaiting_payment").values(**values))
            await session.commit()

    async def poll_one(self, *, now: datetime | None = None, ref_id: UUID | None = None) -> str:
        now = now or datetime.now(UTC)
        claimed = await self._claim(now, ref_id=ref_id)
        if claimed is None:
            return "not_due"
        ref, merchant = claimed
        client = self.transfers.client_for(merchant)
        try:
            status = await check_payment(merchant, ref, session_factory=self.sessions, http_client=self.http, settings=self.settings)
            if status == "paid":
                finalized = await finalize(merchant, ref, session_factory=self.sessions, http_client=self.http, settings=self.settings)
                if finalized is not None:
                    if client:
                        await self.notify_paid(merchant, ref, finalized, client)
                    await self._mark(ref.id, status="paid", paid_at=now, next_poll_at=None)
                    return "paid"
                await self._mark(ref.id, next_poll_at=now + timedelta(minutes=1))
                return "pending"
            if status == "failed":
                await self._mark(ref.id, status="failed", next_poll_at=None)
                if client and ref.customer_wa_id:
                    await client.send_text(ref.customer_wa_id, "Bumpa reports that this payment failed. Reply RESEND for a fresh link.")
                return "failed"
        except CheckoutError:
            logger.warning("Bumpa payment check deferred", extra={"step": "bumpa_payment_poll"})
            await self._mark(ref.id, next_poll_at=now + timedelta(minutes=1))
            return "pending"
        if next_poll(ref.created_at, now) is None:
            await self._mark(ref.id, status="expired", next_poll_at=None)
            if client and ref.customer_wa_id:
                await client.send_text(ref.customer_wa_id, "This payment link may have lapsed. Reply RESEND for a fresh link, or MENU to shop again.")
            return "expired"
        await self._mark(ref.id, next_poll_at=next_poll(ref.created_at, now))
        return "pending"

    async def poll_due(self) -> int:
        count = 0
        for _ in range(100):
            result = await self.poll_one()
            if result == "not_due":
                break
            count += 1
        return count

    async def latest_for_customer(self, merchant_id: UUID, wa_id: str) -> CheckoutRef | None:
        async with self.sessions() as session:
            return await session.scalar(
                select(CheckoutRef).where(
                    CheckoutRef.merchant_id == merchant_id,
                    CheckoutRef.customer_wa_id == wa_id,
                ).order_by(CheckoutRef.created_at.desc())
            )

    async def order_status(self, merchant: Vendor, ref: CheckoutRef) -> str:
        try:
            client = await _client_for_merchant(merchant.id, self.sessions, self.http, self.settings)
            checkout = await client.get_checkout(ref.bumpa_checkout_id)
            payment = mappers.extract_payment_status(checkout) or "pending"
            shipping = mappers.extract_shipping_status(checkout)
            if shipping is None and ref.bumpa_order_id and client.has_secret_key:
                orders = await client.list_orders(search=ref.bumpa_order_id, limit=1)
                for order in mappers.extract_order_rows(orders):
                    if mappers.extract_order_id(order) == ref.bumpa_order_id:
                        shipping = mappers.extract_shipping_status(order)
                        break
            return f"Bumpa reports payment {payment}" + (f" and shipping {shipping}." if shipping else ".")
        except (CheckoutError, BumpaError):
            return "Bumpa order status is temporarily unavailable. Please try again shortly."

    async def resend(self, merchant: Vendor, ref: CheckoutRef, client: WhatsAppClient) -> bool:
        if ref.status not in {"awaiting_payment", "expired", "failed"} or not ref.customer_wa_id:
            return False
        try:
            if await check_payment(merchant, ref, session_factory=self.sessions, http_client=self.http, settings=self.settings) == "paid":
                await client.send_text(ref.customer_wa_id, "Bumpa already reports this order as paid. Send ORDER STATUS for an update.")
                return True
            bumpa = await _client_for_merchant(merchant.id, self.sessions, self.http, self.settings)
            intent = await bumpa.payment_intent(ref.bumpa_checkout_id)
            url = mappers.extract_authorization_url(intent)
            reference = mappers.extract_payment_reference(intent)
            amount = mappers.extract_amount(intent)
            currency = mappers.extract_currency(intent)
            if not url or not reference or amount is None:
                raise ValueError("Incomplete Bumpa payment intent")
        except (CheckoutError, BumpaError, ValueError):
            await client.send_text(ref.customer_wa_id, "A fresh payment link is temporarily unavailable. Please try again shortly.")
            return True
        now = datetime.now(UTC)
        async with self.sessions() as session:
            await session.execute(update(CheckoutRef).where(
                CheckoutRef.id == ref.id,
                CheckoutRef.merchant_id == merchant.id,
                CheckoutRef.status.in_(["awaiting_payment", "expired", "failed"]),
            ).values(
                status="awaiting_payment", payment_reference=reference,
                bumpa_order_id=mappers.extract_order_id(intent) or ref.bumpa_order_id,
                created_at=now, next_poll_at=now + timedelta(seconds=15),
            ))
            await session.commit()
        await client.send_text(ref.customer_wa_id, f"Fresh pay-only link: {currency or 'NGN'} {amount:,.2f}. Reference {reference}. {url}")
        return True


async def retention_job(sessions: async_sessionmaker[AsyncSession]) -> None:
    async with sessions() as session:
        await purge_expired_state(session)
        await session.commit()
