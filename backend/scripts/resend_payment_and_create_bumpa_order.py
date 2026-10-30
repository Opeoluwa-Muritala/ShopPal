"""One-time deployed-server repair for a confirmed transfer.

Required environment variables:
    DATABASE_URL, EMAIL_API_URL, OWNER_ALERT_EMAIL
    BUMPA_BASE_URL, BUMPA_SECRET_KEY, BUMPA_LOCATION_ID
"""

import argparse
import asyncio
from decimal import Decimal
from html import escape
import os
from typing import Any

import httpx
from sqlalchemy import select

from app.config import Settings
from app.db.models import PendingTransfer
from app.db.session import get_async_session_factory
from app.services.email_alert import send_email


def build_bumpa_order_payload(row: PendingTransfer, location_id: str) -> dict[str, Any]:
    """Keep the one-time Bumpa request mapping isolated for easy correction."""
    items = row.items or []
    customer = next((item for item in items if item.get("type") == "customer"), {})
    delivery = next((item for item in items if item.get("type") == "delivery"), {})
    products = [
        {
            "product_id": str(item.get("bumpa_product_id") or item.get("product_id") or ""),
            "quantity": int(item.get("qty", 1)),
            "price": str(item.get("unit_price") or "0.00"),
        }
        for item in items
        if item.get("type") not in {"customer", "delivery"}
    ]
    if any(not item["product_id"] for item in products):
        raise RuntimeError(f"Transfer {row.reference} has an item without a Bumpa product mapping")
    return {
        "location_id": location_id,
        "customer": {
            "name": customer.get("name") or "Not provided",
            "phone": customer.get("phone") or row.customer_wa_id,
        },
        "sales_channel": "online",
        "payment_status": "paid",
        "payment_method": "bank_transfer",
        "currency": "NGN",
        "items": products,
        "shipping_fee": str(delivery.get("fee") or "0.00"),
        "notes": f"ShopPal order {row.id}; payment reference {row.reference}",
    }


def _details(row: PendingTransfer) -> tuple[str, str, str, list[str]]:
    items = row.items or []
    customer = next((item for item in items if item.get("type") == "customer"), {})
    delivery = next((item for item in items if item.get("type") == "delivery"), {})
    name = customer.get("name") or "Not provided"
    phone = customer.get("phone") or row.customer_wa_id or "Not provided"
    address = delivery.get("address") or "Pickup / not provided"
    products = [
        f"{item.get('name') or item.get('product_id') or 'Product'} x {item.get('qty', 1)}"
        for item in items
        if item.get("type") not in {"customer", "delivery"}
    ] or [f"{row.bumpa_product_id} x {row.quantity}"]
    return name, phone, address, products


async def run(reference: str) -> str:
    settings = Settings()
    required = {
        "BUMPA_BASE_URL": os.getenv("BUMPA_BASE_URL", ""),
        "BUMPA_SECRET_KEY": os.getenv("BUMPA_SECRET_KEY", ""),
        "BUMPA_LOCATION_ID": os.getenv("BUMPA_LOCATION_ID", ""),
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")

    async with get_async_session_factory()() as session:
        row = await session.scalar(
            select(PendingTransfer).where(PendingTransfer.reference == reference)
        )
        if row is None:
            raise RuntimeError(f"Transfer {reference} was not found")
        if row.status != "confirmed":
            raise RuntimeError(f"Transfer {reference} is {row.status}, not confirmed")
        payload = build_bumpa_order_payload(row, required["BUMPA_LOCATION_ID"])
        name, phone, address, products = _details(row)

    email_text = (
        f"Payment confirmed for order {reference}. Amount: NGN {Decimal(row.amount):,.2f}.\n"
        f"Buyer: {name}\nPhone: {phone}\nWhatsApp: {row.customer_wa_id}\n"
        f"Address: {address}\nItems: {', '.join(products)}"
    )
    item_lines = "".join(f"<li>{escape(item)}</li>" for item in products)
    email_html = (
        "<!doctype html><html><body style='font-family:Arial,sans-serif;line-height:1.5'>"
        f"<h1>Payment confirmed: {escape(reference)}</h1>"
        f"<p>Amount: <strong>NGN {Decimal(row.amount):,.2f}</strong></p>"
        f"<p>Buyer: {escape(name)}<br>Phone: {escape(phone)}<br>"
        f"WhatsApp: {escape(row.customer_wa_id or '')}<br>Address: {escape(address)}</p>"
        f"<h2>Items bought</h2><ul>{item_lines}</ul></body></html>"
    )

    async with httpx.AsyncClient(timeout=10.0) as http_client:
        await send_email(
            http_client,
            settings.email_api_url,
            settings.owner_alert_email,
            f"Payment confirmation: {reference}",
            email_text,
            html=email_html,
        )
        response = await http_client.post(
            f"{required['BUMPA_BASE_URL'].rstrip('/')}/orders",
            headers={
                "X-Api-Key": required["BUMPA_SECRET_KEY"],
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        try:
            response_payload = response.json()
        except ValueError:
            response_payload = {}
        bumpa_order_id = None
        if isinstance(response_payload, dict):
            data = response_payload.get("data")
            bumpa_order_id = response_payload.get("order_id") or response_payload.get("id")
            if bumpa_order_id is None and isinstance(data, dict):
                bumpa_order_id = data.get("order_id") or data.get("id")
        print(
            f"Resent payment email and created Bumpa order for {reference}"
            + (f" ({bumpa_order_id})." if bumpa_order_id else ".")
        )
        return str(bumpa_order_id or "")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", required=True)
    args = parser.parse_args()
    asyncio.run(run(args.reference))


if __name__ == "__main__":
    main()
