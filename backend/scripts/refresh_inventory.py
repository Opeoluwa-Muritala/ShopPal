"""Refresh one merchant's Bumpa catalog, then copy only that cache to DB2.

Default mode previews provider fields without writing. --apply performs the
refresh. No checkout, payment, customer, account or credential rows are copied.
"""

import argparse
import asyncio
import json
import logging
import sys
from collections import Counter
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID

import httpx
from sqlalchemy import event, func, select, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.db.bumpa_repository import get_connection, upsert_product_cache_batch  # noqa: E402
from app.db.models import ProductCache, SyncState, Vendor  # noqa: E402
from app.db.session import database_url  # noqa: E402
from app.integrations.bumpa import mappers  # noqa: E402
from app.services.bumpa_sync import _client, sync_merchant_products  # noqa: E402
from app.services.scarf_collections import is_avaia  # noqa: E402


async def run(merchant_id: UUID, apply: bool, recover_stale_sync: bool = False) -> int:
    settings = get_settings()
    if not settings.database_url or not settings.database_url_2:
        raise ValueError("Both database URLs are required")
    # Explicit targets: a maintenance script must never silently fail over.
    engines = [create_async_engine(database_url(str(url)), poolclass=NullPool,
        hide_parameters=True, connect_args={"connect_timeout": 10})
        for url in (settings.database_url, settings.database_url_2)]
    counts = [Counter(), Counter()]
    for engine, count in zip(engines, counts, strict=True):
        def executed(conn, cursor, statement, params, context, many, *, bucket=count):
            bucket[statement.lstrip().split(None, 1)[0].upper()] += 1
        event.listen(engine.sync_engine, "after_cursor_execute", executed)
    primary, secondary = [async_sessionmaker(engine, expire_on_commit=False) for engine in engines]
    try:
        async with primary() as session:
            merchant = await session.get(Vendor, merchant_id)
            connection = await get_connection(session, merchant_id)
            if not merchant or not is_avaia(merchant.business_name) or not connection:
                raise ValueError("Expected Avaia merchant and Bumpa connection")
            sync_state = await session.get(SyncState, merchant_id)
            if sync_state:
                print(json.dumps({"sync_running": sync_state.running,
                    "last_started_at": str(sync_state.last_started_at),
                    "last_succeeded_at": str(sync_state.last_succeeded_at)}))
            if recover_stale_sync:
                if not apply or not sync_state or not sync_state.running or not sync_state.last_started_at:
                    raise ValueError("Recovery requires --apply and a timestamped running sync")
                if sync_state.last_started_at >= datetime.now(UTC) - timedelta(days=1):
                    raise ValueError("Refusing to recover a sync less than one day old")
                recovered = await session.execute(update(SyncState).where(
                    SyncState.merchant_id == merchant_id,
                    SyncState.running.is_(True),
                    SyncState.last_started_at == sync_state.last_started_at,
                ).values(running=False, last_error="Recovered stale sync during inventory maintenance"))
                if recovered.rowcount != 1:
                    raise ValueError("Sync state changed during recovery")
                await session.commit()
                print(json.dumps({"recovered_stale_sync": True}))
        async with secondary() as session:
            standby_merchant = await session.get(Vendor, merchant_id)
            if not standby_merchant or not is_avaia(standby_merchant.business_name):
                raise ValueError("Standby merchant identity does not match")
        async with httpx.AsyncClient(timeout=settings.bumpa_timeout_seconds) as http:
            client = _client(connection, http, settings)
            if not apply:
                response = await client.list_products(limit=50, page=1, variations=1)
                rows = mappers.extract_product_rows(response)
                if rows is None:
                    raise ValueError("Unrecognized product list")
                print(json.dumps({"preview_rows": len(rows),
                    "first_row_fields": sorted(rows[0]) if rows else [],
                    "mapped_prices": sum(mappers.extract_price(row) is not None for row in rows),
                    "mapped_stock": sum(mappers.extract_stock(row) is not None for row in rows)}))
                return 0
            result = await sync_merchant_products(merchant_id, session_factory=primary,
                http_client=http, settings=settings)
            print(json.dumps({"primary_sync": result.status, "products_fetched": result.product_count}))
            if result.status != "succeeded":
                return 1
        async with primary() as session:
            products = list((await session.scalars(select(ProductCache).where(
                ProductCache.merchant_id == merchant_id))).all())
            values = [{column.name: getattr(product, column.name)
                for column in ProductCache.__table__.columns if column.name != "id"}
                for product in products]
        async with secondary() as session, session.begin():
            for offset in range(0, len(values), 50):
                await upsert_product_cache_batch(session, values[offset:offset + 50])
        for number, factory in enumerate((primary, secondary), start=1):
            async with factory() as session:
                stats = (await session.execute(select(
                    func.count(),
                    func.count().filter(ProductCache.is_published.is_(True)),
                    func.count().filter(ProductCache.stock_qty > 0),
                    func.count().filter(ProductCache.stock_qty.is_(None)),
                    func.count().filter(ProductCache.price.is_(None)),
                ).select_from(ProductCache).where(ProductCache.merchant_id == merchant_id))).one()
                print(json.dumps({"database": number, "total": stats[0], "published": stats[1],
                    "in_stock": stats[2], "unknown_stock": stats[3], "unknown_price": stats[4]}))
        return 0
    finally:
        for number, engine in enumerate(engines, start=1):
            await engine.dispose()
            print(json.dumps({"database": number, "sql_statements": dict(counts[number - 1])}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--merchant-id", type=UUID, required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--recover-stale-sync", action="store_true",
        help="With --apply, release a stuck sync older than 24 hours using a conditional update")
    args = parser.parse_args()
    # Windows psycopg async needs a selector event loop.
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("app.integrations.bumpa.mappers").setLevel(logging.ERROR)
    try:
        raise SystemExit(asyncio.run(run(args.merchant_id, args.apply, args.recover_stale_sync)))
    except Exception as exc:
        print(f"Inventory refresh failed: {type(exc).__name__}", file=sys.stderr)
        raise SystemExit(1) from None
