import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.config import Settings
from app.db.models import Order
from app.db.session import get_async_session_factory
from app.services.flutterwave_v4 import FlutterwaveClientError, get_virtual_account_provider
from app.services.payments import confirm_verified_charge


async def reconcile_orders_once(settings: Settings) -> int:
    checked = 0
    provider = get_virtual_account_provider(settings)
    async with get_async_session_factory()() as session:
        result = await session.execute(select(Order).where(Order.payment_status == "pending_payment", Order.created_at <= datetime.now(UTC) - timedelta(minutes=5)).limit(100))
        for order in result.scalars():
            checked += 1
            try:
                charge = await provider.find_charge(order.tx_ref or "")
                if charge is not None:
                    await session.commit()
                    await confirm_verified_charge(session, transaction_id=charge.transaction_id, payload={}, settings=settings, provider=provider)
            except FlutterwaveClientError:
                continue
    return checked


async def reconciliation_loop(stop, settings: Settings) -> None:
    while not stop.is_set():
        try:
            await reconcile_orders_once(settings)
        except Exception:
            pass
        try:
            await asyncio.wait_for(stop.wait(), timeout=600)
        except asyncio.TimeoutError:
            continue
