"""Idempotent post-payment order synchronization to Bumpa."""

import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import select, update

from app.config import Settings
from app.db.models import Order, Product, Vendor
from app.db.session import get_async_session_factory
from app.logging_conf import logger
from app.services.whatsapp import send_whatsapp_text

CLAIM_LEASE = timedelta(minutes=5)


def build_order_payload(
    order: Order,
    products: dict[str, Product],
    *,
    location_id: str,
) -> dict[str, Any]:
    """Map one local order to Bumpa's Create Order request in one place."""
    mapped_items: list[dict[str, Any]] = []
    shipping_fee = Decimal("0.00")
    for item in order.items or []:
        if item.get("type") == "delivery":
            shipping_fee += Decimal(str(item.get("fee") or "0"))
            continue
        local_id = str(item.get("product_id") or "")
        product = products.get(local_id)
        if product is None or not product.bumpa_product_id:
            raise ValueError(f"Missing Bumpa product mapping for local product {local_id}")
        mapped_items.append({
            "product_id": product.bumpa_product_id,
            "quantity": int(item.get("qty", 1)),
            "price": str(Decimal(str(item.get("unit_price") or product.price)).quantize(Decimal("0.01"))),
        })
    if not mapped_items:
        raise ValueError(f"Order {order.id} has no products to sync")
    return {
        "location_id": location_id,
        "customer": {
            "name": order.customer_name or "Not provided",
            "phone": order.customer_phone,
        },
        "sales_channel": "online",
        "payment_status": "paid",
        "payment_method": "bank_transfer",
        "currency": (order.currency or "NGN").upper(),
        "items": mapped_items,
        "shipping_fee": str(shipping_fee.quantize(Decimal("0.01"))),
        "notes": (
            f"ShopPal order {order.id}; "
            f"payment reference {order.payment_reference or order.tx_ref or order.order_code or order.id}"
        ),
    }


def _orders_url(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/orders"):
        return base
    if base.endswith("/api/commerce/v1"):
        return f"{base}/orders"
    return f"{base}/api/commerce/v1/orders"


def _response_order_id(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    data = payload.get("data")
    if isinstance(data, dict):
        return str(data.get("order_id") or data.get("id") or "") or None
    return str(payload.get("order_id") or payload.get("id") or "") or None


async def _post_order(
    payload: dict[str, Any],
    settings: Settings,
    http_client: httpx.AsyncClient,
) -> str:
    key = settings.bumpa_secret_key.get_secret_value()
    if not key or not settings.bumpa_location_id:
        raise ValueError("Bumpa order sync is not configured")
    headers = {
        "X-Api-Key": key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    for attempt in range(3):
        try:
            response = await http_client.post(
                _orders_url(settings.bumpa_base_url),
                headers=headers,
                json=payload,
                timeout=settings.bumpa_timeout_seconds,
            )
        except httpx.TimeoutException:
            if attempt == 2:
                raise
            await asyncio.sleep(2**attempt)
            continue
        if response.status_code >= 500:
            if attempt == 2:
                response.raise_for_status()
            await asyncio.sleep(2**attempt)
            continue
        response.raise_for_status()
        order_id = _response_order_id(response.json())
        if not order_id:
            raise ValueError("Bumpa did not return an order ID")
        return order_id
    raise RuntimeError("Bumpa order retry exhausted")


async def _notify_failure(order: Order, settings: Settings, message: str) -> None:
    async with get_async_session_factory()() as session:
        vendor = await session.get(Vendor, order.vendor_id)
    merchant_phone = vendor.owner_whatsapp_number if vendor else None
    if not merchant_phone and vendor:
        merchant_phone = vendor.whatsapp_number
    if merchant_phone:
        try:
            await send_whatsapp_text(
                merchant_phone,
                f"Bumpa order sync failed for {order.order_code or order.id}: {message[:300]}",
                settings,
            )
        except Exception:
            logger.exception("Failed to notify merchant about Bumpa sync failure")


async def sync_order_to_bumpa(order_id: UUID, settings: Settings) -> str:
    """Claim, send, and persist one order sync without blocking payment confirmation."""
    session_factory = get_async_session_factory()
    async with session_factory() as session:
        order = await session.scalar(select(Order).where(Order.id == order_id).with_for_update())
        if order is None or order.payment_status != "paid":
            return "ignored"
        if order.bumpa_sync_status == "synced" or order.bumpa_order_id:
            return "synced"
        now = datetime.now(UTC)
        if order.bumpa_sync_claimed_at and order.bumpa_sync_claimed_at > now - CLAIM_LEASE:
            return "in_progress"
        order.bumpa_sync_claimed_at = now
        order.bumpa_sync_status = "pending"
        await session.commit()

    try:
        async with session_factory() as session:
            order = await session.get(Order, order_id)
            if order is None:
                return "ignored"
            item_ids = [
                str(item.get("product_id"))
                for item in order.items or []
                if item.get("type") != "delivery" and item.get("product_id")
            ]
            products = {
                str(product.id): product
                for product in (
                    await session.scalars(
                        select(Product).where(
                            Product.vendor_id == order.vendor_id,
                            Product.id.in_(item_ids),
                        )
                    )
                ).all()
            }
            payload = build_order_payload(
                order, products, location_id=settings.bumpa_location_id
            )
        async with httpx.AsyncClient(timeout=settings.bumpa_timeout_seconds) as client:
            bumpa_order_id = await _post_order(payload, settings, client)
    except Exception as exc:
        error = str(exc)[:1000]
        response = getattr(exc, "response", None)
        if response is not None:
            error = f"{error}: {response.text[:500]}"
        async with session_factory() as session:
            await session.execute(
                update(Order)
                .where(Order.id == order_id)
                .values(
                    bumpa_sync_status="failed",
                    bumpa_sync_error=error,
                    bumpa_sync_claimed_at=None,
                )
            )
            await session.commit()
            failed_order = await session.get(Order, order_id)
        logger.error(
            "Bumpa order sync failed",
            extra={"step": "bumpa_order_sync", "order_id": str(order_id), "error": error},
        )
        if failed_order is not None:
            await _notify_failure(failed_order, settings, error)
        return "failed"

    async with session_factory() as session:
        await session.execute(
            update(Order)
            .where(Order.id == order_id, Order.bumpa_order_id.is_(None))
            .values(
                bumpa_order_id=bumpa_order_id,
                bumpa_sync_status="synced",
                bumpa_sync_error=None,
                bumpa_sync_claimed_at=None,
            )
        )
        await session.commit()
    logger.info(
        "Bumpa order synced",
        extra={"step": "bumpa_order_sync", "order_id": str(order_id)},
    )
    return "synced"


def schedule_order_bumpa_sync(order_id: UUID, settings: Settings) -> None:
    task = asyncio.create_task(sync_order_to_bumpa(order_id, settings))
    task.add_done_callback(_report_background_failure)


def _report_background_failure(task: asyncio.Task) -> None:
    if not task.cancelled() and task.exception() is not None:
        logger.error(
            "Unexpected Bumpa sync task failure",
            extra={"step": "bumpa_order_sync", "error_type": type(task.exception()).__name__},
        )


async def retry_failed_bumpa_orders(settings: Settings) -> None:
    async with get_async_session_factory()() as session:
        order_ids = (
            await session.scalars(
                select(Order.id)
                .where(
                    Order.payment_status == "paid",
                    Order.bumpa_sync_status == "failed",
                    Order.bumpa_order_id.is_(None),
                )
                .order_by(Order.updated_at.asc())
                .limit(50)
            )
        ).all()
    for order_id in order_ids:
        await sync_order_to_bumpa(order_id, settings)
