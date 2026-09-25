"""Vendor-scoped orders router protected by JWT authentication and strict tenant isolation."""

from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import Account, Cart, Order
from app.db.session import get_db
from app.logging_conf import logger
from app.services.auth import get_current_account
from app.services.whatsapp import send_whatsapp_text

router = APIRouter(prefix="/api/orders", tags=["Frontend Orders"])


def _cart_item_rows(items: list[dict[str, Any]] | None) -> tuple[list[dict[str, Any]], Decimal]:
    rows: list[dict[str, Any]] = []
    total = Decimal("0.00")
    for item in items or []:
        if not isinstance(item, dict) or not item.get("name"):
            continue
        try:
            quantity = int(item.get("qty", item.get("quantity", 0)))
            unit_price = Decimal(str(item.get("price", item.get("unit_price", 0))))
        except (InvalidOperation, TypeError, ValueError):
            continue
        if quantity < 1 or unit_price < 0:
            continue
        rows.append({
            "product_id": item.get("product_id"),
            "name": str(item["name"]),
            "quantity": quantity,
            "unit_price": str(unit_price),
            "subtotal": str(unit_price * quantity),
        })
        total += unit_price * quantity
    return rows, total.quantize(Decimal("0.01"))


def pending_cart_rows(session: Session, vendor_id) -> list[dict[str, Any]]:
    """Expose active, non-empty carts as read-only pending dashboard orders."""
    carts = session.scalars(
        select(Cart)
        .where(Cart.vendor_id == vendor_id, Cart.state == "active")
        .order_by(Cart.updated_at.desc())
    ).all()
    rows = []
    for cart in carts:
        items, total = _cart_item_rows(cart.items)
        if not items:
            continue
        rows.append({
            "id": f"cart-{cart.id}",
            "order_code": f"CART-{str(cart.id).replace('-', '')[:8].upper()}",
            "customer_phone": cart.customer_phone,
            "total": str(total),
            "status": "pending",
            "payment_status": "pending",
            "items": items,
            "created_at": cart.updated_at.isoformat() if cart.updated_at else None,
            "is_cart": True,
        })
    return rows


class OrderUpdateSchema(BaseModel):
    status: str = Field(..., pattern="^(new|processing|shipped|delivered|cancelled)$")


@router.get("")
def list_vendor_orders(
    current_account: Account = Depends(get_current_account),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns orders strictly scoped to the authenticated account's vendor_id.
    IDOR IMMUNE: vendor_id is derived exclusively from the validated JWT token.
    """
    if session is None:
        return {
            "vendor_id": str(current_account.vendor_id),
            "count": 0,
            "orders": [],
        }

    stmt = select(Order).where(Order.vendor_id == current_account.vendor_id)
    orders = session.scalars(stmt).all()
    pending_carts = pending_cart_rows(session, current_account.vendor_id)
    return {
        "vendor_id": str(current_account.vendor_id),
        "count": len(orders) + len(pending_carts),
        "orders": [
            *[{
                "id": str(o.id),
                "order_code": o.order_code,
                "customer_phone": o.customer_phone,
                "total": str(o.total),
                "status": o.status,
                "payment_status": o.payment_status,
                "items": _cart_item_rows(o.items)[0],
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "is_cart": False,
            } for o in orders],
            *pending_carts,
        ],
    }


@router.patch("/{order_id}")
def update_order_status(
    order_id: UUID,
    body: OrderUpdateSchema,
    current_account: Account = Depends(get_current_account),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Updates order status.
    IDOR DEFENSE: Validates the target order strictly belongs to current_account.vendor_id.
    Cross-vendor access returns 403 Forbidden.
    """
    if session is None:
        return {
            "id": str(order_id),
            "order_code": "ORD-MOCK-001",
            "status": body.status,
            "updated": True,
        }

    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order '{order_id}' not found",
        )

    # Cross-tenant IDOR check: enforce ownership
    if order.vendor_id != current_account.vendor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: you cannot modify orders belonging to another vendor",
        )

    order.status = body.status
    session.commit()
    return {
        "id": str(order.id),
        "order_code": order.order_code,
        "status": order.status,
        "updated": True,
    }


@router.get("/payment-reviews")
def payment_reviews(
    current_account: Account = Depends(get_current_account),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return payment-review notifications for this vendor only."""
    if session is None:
        return {"count": 0, "payments": []}
    orders = session.scalars(
        select(Order).where(
            Order.vendor_id == current_account.vendor_id,
            Order.payment_status.in_(["pending_payment", "manual_review"]),
        ).order_by(Order.created_at.desc()).limit(100)
    ).all()
    return {
        "count": len(orders),
        "payments": [{
            "id": str(order.id), "order_code": order.order_code,
            "customer_phone": order.customer_phone, "total": str(order.total),
            "payment_status": order.payment_status, "items": order.items,
        } for order in orders],
    }


@router.post("/{order_id}/confirm-payment")
async def confirm_payment(
    order_id: UUID,
    current_account: Account = Depends(get_current_account),
    session: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """Vendor-confirm a payment after reviewing proof; scope and audit it."""
    if session is None:
        raise HTTPException(status_code=503, detail="Payment confirmation unavailable")
    order = session.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.vendor_id != current_account.vendor_id:
        raise HTTPException(status_code=403, detail="Access forbidden")
    if order.payment_status == "paid":
        return {"order_code": order.order_code, "payment_status": "paid", "notification_sent": False}
    if order.payment_status not in ("pending_payment", "manual_review"):
        raise HTTPException(status_code=409, detail="Order is not awaiting payment confirmation")
    order.payment_status = "paid"
    order.status = "processing"
    order.payment_confirmed_by = current_account.id
    order.payment_confirmed_at = datetime.now(UTC)
    order.payment_confirmation_source = "vendor_manual"
    session.commit()
    notification_sent = False
    try:
        await send_whatsapp_text(
            order.customer_phone,
            "Payment confirmed. Please send your delivery address so we can arrange delivery.",
            settings,
        )
        notification_sent = True
    except Exception:
        logger.error("Payment confirmed but customer notification failed", extra={
            "step": "payment_confirmation_notification", "order_code": order.order_code,
            "error_type": "whatsapp_send_failed",
        })
    return {
        "order_code": order.order_code, "payment_status": order.payment_status,
        "notification_sent": notification_sent,
    }
