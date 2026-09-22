"""Vendor-scoped orders router with IDOR mitigation via X-Vendor-API-Key."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Order
from app.db.session import get_db
from app.services.security import verify_vendor_access

router = APIRouter(prefix="/api/orders", tags=["orders"])


class OrderUpdateSchema(BaseModel):
    status: str = Field(..., pattern="^(new|processing|shipped|delivered|cancelled)$")


@router.get("")
def list_vendor_orders(
    vendor_id: UUID,
    x_vendor_api_key: str | None = Header(default=None, alias="X-Vendor-API-Key"),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Returns orders for a vendor.
    IDOR DEFENSE: Validates X-Vendor-API-Key matches requested vendor_id.
    """
    verify_vendor_access(vendor_id, x_vendor_api_key, session)

    stmt = select(Order).where(Order.vendor_id == vendor_id)
    orders = session.scalars(stmt).all()
    return {
        "vendor_id": str(vendor_id),
        "count": len(orders),
        "orders": [
            {
                "id": str(o.id),
                "order_code": o.order_code,
                "customer_phone": o.customer_phone,
                "total": str(o.total),
                "status": o.status,
                "payment_status": o.payment_status,
                "items": o.items,
            }
            for o in orders
        ],
    }


@router.patch("/{order_id}")
def update_order_status(
    order_id: UUID,
    body: OrderUpdateSchema,
    x_vendor_api_key: str | None = Header(default=None, alias="X-Vendor-API-Key"),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Updates order status.
    IDOR DEFENSE: Validates X-Vendor-API-Key matches the owner vendor of the order.
    """
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order '{order_id}' not found",
        )

    # Enforce vendor key ownership on order
    verify_vendor_access(order.vendor_id, x_vendor_api_key, session)

    order.status = body.status
    session.commit()
    return {
        "id": str(order.id),
        "order_code": order.order_code,
        "status": order.status,
        "updated": True,
    }
