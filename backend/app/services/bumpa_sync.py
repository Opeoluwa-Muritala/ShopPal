"""Bumpa product cache refresh; Bumpa remains the inventory source of truth."""

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import Settings
from app.db.bumpa_repository import (
    claim_sync,
    finish_sync,
    get_cached_product,
    get_connection,
    upsert_product_cache,
)
from app.db.models import BumpaConnection, ProductCache, Vendor
from app.integrations.bumpa import mappers
from app.integrations.bumpa.client import (
    BumpaAuthError,
    BumpaClient,
    BumpaRateLimited,
    BumpaUnavailable,
)
from app.integrations.bumpa.credentials import decrypt_credential

PAGE_SIZE = 50


@dataclass(frozen=True)
class SyncResult:
    status: str
    product_count: int = 0


def _client(connection: BumpaConnection, http_client: httpx.AsyncClient, settings: Settings) -> BumpaClient:
    return BumpaClient(
        settings.bumpa_base_url,
        decrypt_credential(connection.public_key_enc, settings),
        decrypt_credential(connection.secret_key_enc, settings) if connection.secret_key_enc else None,
        connection.location_id,
        http_client,
    )


async def _cache_product(session: AsyncSession, merchant_id: UUID, raw: dict, synced_at: datetime, *, known_id: str | None = None) -> None:
    product_id = mappers.extract_product_id(raw) or known_id
    if product_id is None:
        raise ValueError("Bumpa product ID could not be mapped")
    await upsert_product_cache(
        session,
        merchant_id,
        product_id,
        raw=raw,
        name=mappers.extract_name(raw),
        description=mappers.extract_description(raw),
        price=mappers.extract_price(raw),
        currency=mappers.extract_currency(raw),
        stock_qty=mappers.extract_stock(raw),
        image_urls=mappers.extract_image_urls(raw),
        variations=mappers.extract_variations(raw),
        is_published=mappers.extract_is_published(raw) is not False,
        synced_at=synced_at,
    )


async def sync_merchant_products(
    merchant_id: UUID,
    *,
    session_factory: async_sessionmaker[AsyncSession],
    http_client: httpx.AsyncClient,
    settings: Settings,
    preclaimed: bool = False,
) -> SyncResult:
    started_at = datetime.now(UTC)
    async with session_factory() as session:
        if not preclaimed:
            if not await claim_sync(session, merchant_id):
                await session.rollback()
                return SyncResult("already_running")
            await session.commit()
        connection = await get_connection(session, merchant_id)
        if connection is None or connection.status != "active":
            await finish_sync(session, merchant_id, error="Bumpa connection is inactive")
            await session.commit()
            return SyncResult("inactive")
        client = _client(connection, http_client, settings)

    count = 0
    page = 1
    try:
        while True:
            response = await client.list_products(limit=PAGE_SIZE, page=page, variations=1)
            rows = mappers.extract_product_rows(response)
            if rows is None:
                raise ValueError("Bumpa product list shape is unknown")
            if not rows:
                break
            async with session_factory() as session:
                for raw in rows:
                    await _cache_product(session, merchant_id, raw, started_at)
                    count += 1
                await session.commit()
            page += 1
        async with session_factory() as session:
            await session.execute(
                update(ProductCache)
                .where(
                    ProductCache.merchant_id == merchant_id,
                    ProductCache.synced_at < started_at,
                    ProductCache.is_published.is_(True),
                )
                .values(is_published=False)
            )
            await finish_sync(session, merchant_id)
            await session.commit()
        return SyncResult("succeeded", count)
    except Exception as exc:
        async with session_factory() as session:
            if isinstance(exc, BumpaAuthError):
                await session.execute(
                    update(BumpaConnection)
                    .where(BumpaConnection.merchant_id == merchant_id)
                    .values(status="invalid")
                )
            await finish_sync(session, merchant_id, error=type(exc).__name__)
            await session.commit()
        return SyncResult("failed", count)


async def refresh_product_live(
    merchant_id: UUID,
    product_id: str,
    *,
    session_factory: async_sessionmaker[AsyncSession],
    http_client: httpx.AsyncClient,
    settings: Settings,
) -> tuple[ProductCache | None, bool]:
    """Return (product, cached_only); cached price always needs final checkout validation."""
    async with session_factory() as session:
        connection = await get_connection(session, merchant_id)
        cached = await get_cached_product(session, merchant_id, product_id)
        if connection is None or connection.status != "active":
            return cached, True
        client = _client(connection, http_client, settings)
    try:
        raw = await client.get_product(product_id, variations=True)
    except (BumpaUnavailable, BumpaRateLimited):
        return cached, True
    except BumpaAuthError:
        async with session_factory() as session:
            await session.execute(update(BumpaConnection).where(BumpaConnection.merchant_id == merchant_id).values(status="invalid"))
            await session.commit()
        return cached, True
    if not isinstance(raw, dict):
        return cached, True
    async with session_factory() as session:
        await _cache_product(session, merchant_id, raw, datetime.now(UTC), known_id=product_id)
        await session.commit()
        return await get_cached_product(session, merchant_id, product_id), False


async def sync_active_merchants(
    *,
    session_factory: async_sessionmaker[AsyncSession],
    http_client: httpx.AsyncClient,
    settings: Settings,
) -> None:
    async with session_factory() as session:
        merchant_ids = (
            await session.scalars(
                select(Vendor.id)
                .join(BumpaConnection, BumpaConnection.merchant_id == Vendor.id)
                .where(Vendor.catalog_provider == "bumpa", Vendor.is_active.is_(True), BumpaConnection.status == "active")
            )
        ).all()
    semaphore = asyncio.Semaphore(3)

    async def run(merchant_id: UUID) -> None:
        async with semaphore:
            await sync_merchant_products(
                merchant_id,
                session_factory=session_factory,
                http_client=http_client,
                settings=settings,
            )

    await asyncio.gather(*(run(merchant_id) for merchant_id in merchant_ids))
