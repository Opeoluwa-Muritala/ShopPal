"""Async, merchant-scoped persistence for Bumpa's minimal local state."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    BumpaConnection,
    CheckoutRef,
    ConversationState,
    PendingTransfer,
    ProcessedMessage,
    ProductCache,
    SyncState,
)


async def get_connection(session: AsyncSession, merchant_id: UUID) -> BumpaConnection | None:
    return await session.scalar(select(BumpaConnection).where(BumpaConnection.merchant_id == merchant_id))


async def claim_sync(session: AsyncSession, merchant_id: UUID) -> bool:
    """Acquire the DB guard atomically; callers commit before the network sweep."""
    await session.execute(insert(SyncState).values(merchant_id=merchant_id).on_conflict_do_nothing())
    result = await session.execute(
        update(SyncState)
        .where(SyncState.merchant_id == merchant_id, SyncState.running.is_(False))
        .values(running=True, last_started_at=datetime.now(UTC), last_error=None)
        .returning(SyncState.merchant_id)
    )
    return result.scalar_one_or_none() is not None


async def finish_sync(session: AsyncSession, merchant_id: UUID, *, error: str | None = None) -> None:
    values: dict[str, Any] = {"running": False, "last_error": error[:1000] if error else None}
    if error is None:
        values["last_succeeded_at"] = datetime.now(UTC)
    await session.execute(update(SyncState).where(SyncState.merchant_id == merchant_id).values(**values))


async def upsert_product_cache(
    session: AsyncSession,
    merchant_id: UUID,
    bumpa_product_id: str,
    *,
    raw: dict[str, Any],
    name: str | None,
    description: str | None,
    price: Decimal | None,
    currency: str | None,
    stock_qty: int | None,
    image_urls: list[str],
    variations: list[dict[str, Any]],
    is_published: bool,
    synced_at: datetime,
) -> None:
    values = {
        "merchant_id": merchant_id,
        "bumpa_product_id": bumpa_product_id,
        "raw": raw,
        "name": name,
        "description": description,
        "price": price,
        "currency": currency,
        "stock_qty": stock_qty,
        "image_urls": image_urls,
        "variations": variations,
        "is_published": is_published,
        "synced_at": synced_at,
    }
    await session.execute(
        insert(ProductCache)
        .values(**values)
        .on_conflict_do_update(
            index_elements=[ProductCache.merchant_id, ProductCache.bumpa_product_id],
            set_={key: value for key, value in values.items() if key not in {"merchant_id", "bumpa_product_id"}},
        )
    )


async def get_cached_product(session: AsyncSession, merchant_id: UUID, product_id: str) -> ProductCache | None:
    return await session.scalar(
        select(ProductCache).where(
            ProductCache.merchant_id == merchant_id,
            ProductCache.bumpa_product_id == product_id,
        )
    )


async def save_checkout_ref(
    session: AsyncSession,
    merchant_id: UUID,
    checkout_id: str,
    customer_wa_id: str,
    *,
    order_id: str | None = None,
    payment_reference: str | None = None,
) -> CheckoutRef:
    row = CheckoutRef(
        merchant_id=merchant_id,
        bumpa_checkout_id=checkout_id,
        bumpa_order_id=order_id,
        payment_reference=payment_reference,
        customer_wa_id=customer_wa_id,
        status="awaiting_payment",
        next_poll_at=datetime.now(UTC) + timedelta(seconds=15),
    )
    session.add(row)
    await session.flush()
    return row


async def save_pending_transfer(
    session: AsyncSession,
    merchant_id: UUID,
    reference: str,
    product_id: str,
    quantity: int,
    amount: Decimal,
    customer_wa_id: str,
    items: list[dict] | None = None,
) -> PendingTransfer:
    if quantity < 1 or amount < 0:
        raise ValueError("Invalid transfer quantity or amount")
    row = PendingTransfer(
        merchant_id=merchant_id,
        reference=reference,
        bumpa_product_id=product_id,
        quantity=quantity,
        amount=amount,
        items=items,
        customer_wa_id=customer_wa_id,
        status="awaiting_proof",
    )
    session.add(row)
    await session.flush()
    return row


async def record_processed_message(session: AsyncSession, message_id: str) -> bool:
    if not message_id or len(message_id) > 255:
        raise ValueError("Invalid message ID")
    result = await session.execute(
        insert(ProcessedMessage).values(message_id=message_id).on_conflict_do_nothing().returning(ProcessedMessage.message_id)
    )
    return result.scalar_one_or_none() is not None


async def purge_expired_state(session: AsyncSession, *, now: datetime | None = None) -> None:
    """Delete temporary state and scrub contact/media IDs after their retention window."""
    now = now or datetime.now(UTC)
    await session.execute(delete(ConversationState).where(ConversationState.updated_at < now - timedelta(hours=24)))
    await session.execute(delete(ProcessedMessage).where(ProcessedMessage.created_at < now - timedelta(hours=48)))
    await session.execute(
        update(CheckoutRef)
        .where(
            CheckoutRef.status.in_(["paid", "expired", "failed"]),
            CheckoutRef.created_at < now - timedelta(days=7),
        )
        .values(customer_wa_id=None)
    )
    await session.execute(
        update(PendingTransfer)
        .where(
            PendingTransfer.status.in_(["confirmed", "rejected", "expired"]),
            PendingTransfer.resolved_at < now - timedelta(days=7),
        )
        .values(customer_wa_id=None, proof_media_id=None)
    )
