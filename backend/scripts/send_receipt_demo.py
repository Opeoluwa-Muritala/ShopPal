"""Send the receipt message sequence to the explicitly configured test recipient."""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote

from sqlalchemy import select
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.db.models import ReplyJob  # noqa: E402
from app.db.session import get_engine  # noqa: E402
from app.services.receipt_images import render_payment_receipt  # noqa: E402
from app.services.whatsapp import (  # noqa: E402
    send_whatsapp_cta_url,
    send_whatsapp_image_bytes,
    send_whatsapp_template,
    send_whatsapp_text,
)


def _load_test_recipient() -> str:
    value = os.getenv("WHATSAPP_TEST_RECIPIENT", "")
    if not value:
        env_path = Path(__file__).resolve().parents[1] / ".env"
        for line in env_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("WHATSAPP_TEST_RECIPIENT="):
                value = line.split("=", 1)[1].strip().strip('"\'')
                break
    digits = "".join(character for character in value if character.isdigit())
    if not 10 <= len(digits) <= 15:
        raise RuntimeError("WHATSAPP_TEST_RECIPIENT is missing or invalid")
    return digits


def _latest_bot_number(recipient: str) -> str:
    """Use Meta's signed inbound display number; do not depend on local env edits."""
    with Session(get_engine()) as session:
        job = session.scalar(
            select(ReplyJob)
            .where(ReplyJob.customer_phone.in_([recipient, f"+{recipient}"]))
            .order_by(ReplyJob.created_at.desc())
        )
    digits = "".join(character for character in (job.display_number if job else "") if character.isdigit())
    if not 10 <= len(digits) <= 15:
        raise RuntimeError("Could not resolve the bot's public WhatsApp number")
    return digits


def _action_link(bot_number: str, prompt: str) -> str:
    return f"https://wa.me/{bot_number}?text={quote(prompt, safe='')}"


async def main() -> None:
    settings = get_settings()
    recipient = _load_test_recipient()
    reference = "DEMO-RECEIPT-001"
    if "--reopen" in sys.argv:
        await send_whatsapp_template(recipient, "hello_world", "en_US", settings)
        print("The approved WhatsApp conversation template was accepted by Meta.")
        return
    try:
        bot_number_index = sys.argv.index("--bot-number")
        supplied_bot_number = sys.argv[bot_number_index + 1]
    except (ValueError, IndexError):
        supplied_bot_number = ""
    supplied_bot_number = "".join(character for character in supplied_bot_number if character.isdigit())
    link_number = supplied_bot_number or _latest_bot_number(recipient)
    if not 10 <= len(link_number) <= 15:
        raise RuntimeError("The supplied bot number is invalid")
    browse_link = _action_link(link_number, "What do you sell?")
    image_link = _action_link(link_number, "Can I get images?")
    help_link = _action_link(link_number, f"Hi, I need help with order {reference}")
    if "--follow-up-only" in sys.argv:
        result = await send_whatsapp_cta_url(
            recipient,
            "Receipt demo 3/3 🎉\nTap below to ask ShopPal for product images.",
            "View product images",
            image_link,
            settings,
        )
        if result.get("ok") is False:
            raise RuntimeError(f"Meta rejected the CTA: {result.get('error', 'unknown error')}")
        print("The receipt demo follow-up was accepted by Meta.")
        return

    if "--skip-intro" not in sys.argv:
        result = await send_whatsapp_cta_url(
            recipient,
            "Receipt demo 1/3 👋\nTap the button below to browse the live catalog.",
            "Browse products",
            browse_link,
            settings,
        )
        if result.get("ok") is False:
            raise RuntimeError(f"Meta rejected the CTA: {result.get('error', 'unknown error')}")
    receipt = render_payment_receipt(
        business_name="ShopPal Demo Store",
        order_reference=reference,
        amount=Decimal("25000.00"),
        items=[
            {"name": "Classic Leather Bag", "qty": 1},
            {"name": "Delivery", "qty": 1},
        ],
        paid_at=datetime.now(UTC),
    )
    result = await send_whatsapp_image_bytes(
        recipient,
        receipt,
        "image/png",
        (
            "Receipt demo 2/3 ✅\n\n"
            f"Payment received for order {reference}.\n"
            "Amount: ₦25,000.00\n\n"
            "Keep this image for your records. We’ll message you when your order is ready.\n\n"
            "Use the action buttons that follow to continue shopping or get help."
        ),
        settings,
    )
    if result.get("ok") is False:
        raise RuntimeError(f"Meta rejected the receipt image: {result.get('error', 'unknown error')}")
    result = await send_whatsapp_cta_url(
        recipient,
        "Want to see another item? Tap below to request product images.",
        "View product images",
        image_link,
        settings,
    )
    if result.get("ok") is False:
        raise RuntimeError(f"Meta rejected the image CTA: {result.get('error', 'unknown error')}")
    result = await send_whatsapp_cta_url(
        recipient,
        f"Need help with {reference}? Tap below to open a prefilled support message.",
        "Get order help",
        help_link,
        settings,
    )
    if result.get("ok") is False:
        raise RuntimeError(f"Meta rejected the help CTA: {result.get('error', 'unknown error')}")
    count = 3 if "--skip-intro" in sys.argv else 4
    print(f"{count} receipt demo messages were accepted by Meta.")


if __name__ == "__main__":
    asyncio.run(main())
