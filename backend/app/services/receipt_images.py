"""Render compact payment receipts suitable for WhatsApp image messages."""

from __future__ import annotations

import io
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from PIL import Image, ImageDraw, ImageFont


def _text(value: Any, limit: int = 64) -> str:
    """Keep order data printable and bounded before drawing it."""
    return " ".join(str(value or "").split())[:limit]


def render_payment_receipt(
    *,
    business_name: str,
    order_reference: str,
    amount: Decimal,
    items: list[dict[str, Any]],
    paid_at: datetime | None,
) -> bytes:
    """Return a metadata-free PNG receipt using server-verified values."""
    width = 1080
    line_items = items[:8]
    height = 720 + max(0, len(line_items) - 1) * 54
    image = Image.new("RGB", (width, height), "#f8fafc")
    draw = ImageDraw.Draw(image)
    title_font = ImageFont.load_default(size=48)
    heading_font = ImageFont.load_default(size=30)
    body_font = ImageFont.load_default(size=25)
    small_font = ImageFont.load_default(size=21)

    draw.rounded_rectangle((45, 35, width - 45, height - 35), radius=30, fill="white", outline="#d1fae5", width=4)
    draw.rounded_rectangle((45, 35, width - 45, 190), radius=30, fill="#047857")
    draw.text((90, 74), "PAYMENT RECEIPT", font=title_font, fill="white")
    draw.text((90, 140), _text(business_name, 48), font=small_font, fill="#d1fae5")

    y = 235
    draw.text((90, y), "Payment confirmed", font=heading_font, fill="#047857")
    y += 60
    draw.text((90, y), f"Order: {_text(order_reference, 42)}", font=body_font, fill="#0f172a")
    paid = (paid_at or datetime.now(UTC)).astimezone(UTC).strftime("%d %b %Y, %H:%M UTC")
    draw.text((90, y + 42), paid, font=small_font, fill="#64748b")
    y += 115
    draw.line((90, y, width - 90, y), fill="#e2e8f0", width=3)
    y += 34

    for item in line_items:
        quantity = item.get("qty", item.get("quantity", 1))
        draw.text((90, y), f"{_text(quantity, 4)} x {_text(item.get('name', 'Item'), 48)}", font=body_font, fill="#334155")
        y += 54
    if len(items) > len(line_items):
        draw.text((90, y), f"+ {len(items) - len(line_items)} more item(s)", font=small_font, fill="#64748b")
        y += 45

    y = max(y + 20, height - 205)
    draw.line((90, y, width - 90, y), fill="#e2e8f0", width=3)
    draw.text((90, y + 35), "TOTAL PAID", font=heading_font, fill="#0f172a")
    amount_text = f"NGN {Decimal(amount):,.2f}"
    amount_width = draw.textbbox((0, 0), amount_text, font=heading_font)[2]
    draw.text((width - 90 - amount_width, y + 35), amount_text, font=heading_font, fill="#047857")
    draw.text((90, height - 85), "Verified automatically by ShopPal", font=small_font, fill="#64748b")

    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()
