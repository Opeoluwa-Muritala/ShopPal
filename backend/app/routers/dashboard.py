"""Vendor dashboard aggregate endpoint used by the frontend."""

from collections import defaultdict
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Account, Order, Product
from app.db.session import get_db
from app.services.auth import get_current_account

router = APIRouter(prefix="/api/dashboard", tags=["Frontend Dashboard"])


@router.get("")
def dashboard_summary(
    current_account: Account = Depends(get_current_account),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """Return a tenant-scoped dashboard summary; the vendor comes from the JWT."""
    if session is None:
        return {
            "stats": {
                "totalOrders": 0,
                "totalRevenue": 0,
                "commission": 0,
                "repeatCustomers": 0,
                "ordersTrend": "0 from last week",
                "revenueTrend": "₦0 from last week",
                "customersTrend": "0 from last week",
            },
            "orders": [],
            "products": [],
        }

    orders = session.scalars(
        select(Order)
        .where(Order.vendor_id == current_account.vendor_id)
        .order_by(Order.created_at.desc())
        .limit(100)
    ).all()
    products = session.scalars(
        select(Product)
        .where(Product.vendor_id == current_account.vendor_id)
        .order_by(Product.created_at.desc())
    ).all()

    total_revenue = sum((Decimal(order.total or 0) for order in orders), Decimal(0))
    customers = [order.customer_phone for order in orders if order.customer_phone]
    customer_counts: dict[str, int] = defaultdict(int)
    for phone in customers:
        customer_counts[phone] += 1
    repeat_customers = sum(1 for count in customer_counts.values() if count > 1)

    product_stats: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"ordersCount": 0, "revenue": Decimal(0)}
    )
    for order in orders:
        for item in order.items or []:
            if not isinstance(item, dict):
                continue
            key = str(item.get("product_id") or item.get("id") or item.get("name") or "item")
            quantity = int(item.get("quantity") or 1)
            unit_price = Decimal(str(item.get("unit_price") or item.get("price") or 0))
            product_stats[key]["ordersCount"] += quantity
            product_stats[key]["revenue"] += unit_price * quantity

    product_rows = []
    for product in products:
        stats = product_stats.get(str(product.id), {})
        product_rows.append({
            "id": str(product.id),
            "name": product.name,
            "category": "Product",
            "ordersCount": int(stats.get("ordersCount", 0)),
            "revenue": float(stats.get("revenue", 0)),
            "stock": product.stock,
        })
    product_rows.sort(key=lambda item: item["revenue"], reverse=True)

    order_rows = []
    for order in orders[:5]:
        item_names = []
        for item in order.items or []:
            if isinstance(item, dict) and item.get("name"):
                item_names.append(str(item["name"]))
        order_rows.append({
            "id": order.order_code or str(order.id),
            "customerPhone": order.customer_phone,
            "items": ", ".join(item_names) or "WhatsApp order",
            "total": float(order.total or 0),
            "status": str(order.status or "new").replace("_", " ").title(),
            "timestamp": order.created_at.isoformat() if order.created_at else None,
            "paystackRef": order.paystack_ref,
        })

    return {
        "stats": {
            "totalOrders": len(orders),
            "totalRevenue": float(total_revenue),
            "commission": float(total_revenue * Decimal("0.02")),
            "repeatCustomers": repeat_customers,
            "ordersTrend": "Live data",
            "revenueTrend": "Live data",
            "customersTrend": "Live data",
        },
        "orders": order_rows,
        "products": product_rows[:10],
    }
