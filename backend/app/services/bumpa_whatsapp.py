"""Signed Meta event routing and minimal Bumpa message intake."""

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
import json
from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.bumpa_repository import record_processed_message
from app.db.models import (
    CheckoutRef,
    ConversationState,
    PendingTransfer,
    Vendor,
    WhatsAppMessage,
    WhatsAppOptOut,
)
from app.logging_conf import logger

MessageHandler = Callable[[Vendor, dict[str, Any]], Awaitable[None]]


async def classify_events(
    payload: dict[str, Any],
    *,
    session_factory: async_sessionmaker[AsyncSession],
    legacy_phone_number_id: str,
) -> tuple[dict[str, Any], list[tuple[UUID, dict[str, Any]]]]:
    """Route Bumpa messages while persisting them for conversation history."""
    ids: set[str] = set()
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            phone_id = change.get("value", {}).get("metadata", {}).get("phone_number_id")
            if isinstance(phone_id, str) and phone_id:
                ids.add(phone_id)
    async with session_factory() as session:
        merchants = (
            await session.scalars(
                select(Vendor).where(
                    Vendor.catalog_provider == "bumpa",
                    Vendor.is_active.is_(True),
                    Vendor.whatsapp_phone_number_id.in_(ids),
                )
            )
        ).all() if ids else []
    by_phone = {merchant.whatsapp_phone_number_id: merchant.id for merchant in merchants}
    legacy_entries: list[dict[str, Any]] = []
    bumpa_messages: list[tuple[UUID, dict[str, Any]]] = []
    for entry in payload.get("entry", []):
        legacy_changes = []
        for change in entry.get("changes", []):
            value = change.get("value", {})
            phone_id = value.get("metadata", {}).get("phone_number_id")
            merchant_id = by_phone.get(phone_id)
            if merchant_id is not None:
                for message in value.get("messages", []):
                    bumpa_messages.append((merchant_id, message))
                    message_id = message.get("id")
                    if message_id:
                        await session.execute(
                            insert(WhatsAppMessage)
                            .values(
                                message_id=str(message_id),
                                from_number=str(message.get("from", "")) or None,
                                message_type=str(message.get("type", "unknown")),
                                body=_bumpa_message_body(message),
                                status="received",
                                wa_timestamp=_bumpa_timestamp(message.get("timestamp")),
                                raw_payload=message,
                            )
                            .on_conflict_do_nothing(index_elements=[WhatsAppMessage.message_id])
                        )
                for status in value.get("statuses", []):
                    if status.get("status") == "failed":
                        logger.warning("Bumpa WhatsApp delivery failed", extra={"message_id": status.get("id"), "step": "bumpa_delivery"})
            elif phone_id == legacy_phone_number_id:
                legacy_changes.append(change)
        if legacy_changes:
            legacy_entries.append({**entry, "changes": legacy_changes})
        await session.commit()
    return {**payload, "entry": legacy_entries}, bumpa_messages


def _bumpa_timestamp(value: Any) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(value), tz=UTC)
    except (TypeError, ValueError, OSError):
        return None


def _bumpa_message_body(message: dict[str, Any]) -> str | None:
    message_type = str(message.get("type", "unknown"))
    typed = message.get(message_type)
    if message_type == "text" and isinstance(typed, dict):
        return str(typed.get("body", ""))
    if message_type == "interactive" and isinstance(typed, dict):
        reply = typed.get("button_reply") or typed.get("list_reply") or {}
        if isinstance(reply, dict):
            return str(reply.get("title") or reply.get("id") or "")
    return json.dumps(typed, separators=(",", ":"), default=str) if typed is not None else None


async def _rate_allowed(session: AsyncSession, merchant_id: UUID, customer_wa_id: str) -> bool:
    await session.execute(
        insert(ConversationState)
        .values(merchant_id=merchant_id, customer_wa_id=customer_wa_id, step="start", payload={})
        .on_conflict_do_nothing()
    )
    state = await session.scalar(
        select(ConversationState)
        .where(ConversationState.merchant_id == merchant_id, ConversationState.customer_wa_id == customer_wa_id)
        .with_for_update()
    )
    if state is None:
        return False
    now = datetime.now(UTC)
    payload = dict(state.payload or {})
    try:
        window = datetime.fromisoformat(payload.get("_rate_window", ""))
    except (TypeError, ValueError):
        window = now - timedelta(minutes=2)
    count = int(payload.get("_rate_count", 0)) if window > now - timedelta(minutes=1) else 0
    count += 1
    payload["_rate_window"] = (window if count > 1 else now).isoformat()
    payload["_rate_count"] = count
    state.payload = payload
    state.updated_at = now
    return count <= 20


async def has_open_capacity(session: AsyncSession, merchant_id: UUID, customer_wa_id: str, *, kind: str) -> bool:
    if kind == "checkout":
        count = await session.scalar(
            select(func.count()).select_from(CheckoutRef).where(
                CheckoutRef.merchant_id == merchant_id,
                CheckoutRef.customer_wa_id == customer_wa_id,
                CheckoutRef.status.in_(["created", "awaiting_payment"]),
            )
        )
    elif kind == "transfer":
        count = await session.scalar(
            select(func.count()).select_from(PendingTransfer).where(
                PendingTransfer.merchant_id == merchant_id,
                PendingTransfer.customer_wa_id == customer_wa_id,
                PendingTransfer.status.in_(["awaiting_proof", "proof_received"]),
            )
        )
    else:
        raise ValueError("Unknown pending transaction kind")
    return (count or 0) < 3


async def process_bumpa_message(
    merchant_id: UUID,
    message: dict[str, Any],
    *,
    session_factory: async_sessionmaker[AsyncSession],
    handler: MessageHandler | None = None,
) -> str:
    message_id = str(message.get("id") or "")
    customer_wa_id = str(message.get("from") or "")
    if not message_id or not customer_wa_id or len(customer_wa_id) > 30:
        return "ignored"
    async with session_factory() as session:
        merchant = await session.get(Vendor, merchant_id)
        if merchant is None or merchant.catalog_provider != "bumpa" or not merchant.is_active:
            return "ignored"
        if not await record_processed_message(session, message_id):
            await session.rollback()
            return "duplicate"
        body = message.get("text", {}).get("body", "") if message.get("type") == "text" else ""
        if isinstance(body, str) and body.strip().upper() == "STOP":
            await session.execute(
                insert(WhatsAppOptOut)
                .values(merchant_id=merchant_id, customer_wa_id=customer_wa_id)
                .on_conflict_do_nothing()
            )
            await session.commit()
            logger.info("Bumpa WhatsApp opt-out", extra={"message_id": message_id, "step": "bumpa_opt_out"})
            return "opted_out"
        await session.execute(
            delete(WhatsAppOptOut).where(
                WhatsAppOptOut.merchant_id == merchant_id,
                WhatsAppOptOut.customer_wa_id == customer_wa_id,
            )
        )
        allowed = await _rate_allowed(session, merchant_id, customer_wa_id)
        await session.commit()
    if not allowed:
        logger.info("Bumpa WhatsApp rate limit", extra={"message_id": message_id, "step": "bumpa_rate_limit"})
        return "rate_limited"
    if handler is not None:
        await handler(merchant, message)
    logger.info("Bumpa WhatsApp message processed", extra={"message_id": message_id, "step": "bumpa_message"})
    return "processed"
