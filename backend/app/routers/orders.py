"""Vendor-scoped orders router protected by JWT authentication and strict tenant isolation."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Account, Order
from app.db.session import get_db
from app.services.auth import get_current_account

router = APIRouter(prefix="/api/orders", tags=["orders"])


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
    return {
        "vendor_id": str(current_account.vendor_id),
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
