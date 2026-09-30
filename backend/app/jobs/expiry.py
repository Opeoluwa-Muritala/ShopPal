import asyncio
from datetime import UTC, datetime

from sqlalchemy import select

from app.config import Settings
from app.db.models import Order
from app.db.session import get_async_session_factory
from app.services.whatsapp import send_whatsapp_text


async def expire_orders_once(settings: Settings) -> int:
    count = 0
    async with get_async_session_factory()() as session:
        async with session.begin():
            result = await session.execute(select(Order).where(Order.payment_status == "pending_payment", Order.expires_at <= datetime.now(UTC)).with_for_update(skip_locked=True))
            orders = list(result.scalars())
            for order in orders:
                order.payment_status = "expired"
                order.status = "expired"
                count += 1
        for order in orders:
            await send_whatsapp_text(order.wa_number or order.customer_phone, f"Payment request {order.tx_ref} expired. You can start checkout again.", settings)
    return count


async def expiry_loop(stop, settings: Settings) -> None:
    while not stop.is_set():
        try:
            await expire_orders_once(settings)
        except Exception:
            pass
        try:
            await asyncio.wait_for(stop.wait(), timeout=60)
        except asyncio.TimeoutError:
            continue
