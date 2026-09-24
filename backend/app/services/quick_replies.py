"""Deterministic replies for unambiguous greetings and general catalog requests."""

import re
from decimal import Decimal

from sqlalchemy import select

from app.db.models import Product
from app.services.customer_tools import CustomerToolDispatcher
from app.services.reply_templates import load_templates

GREETINGS = {"hi", "hello", "hey", "good morning", "good afternoon", "good evening"}
CATALOG_REQUESTS = {
    "what do you sell", "what do you have", "what do you have in stock",
    "what is available", "what's available", "show me your products",
    "show products", "show me your catalog", "catalog", "catalogue",
    "what can i buy", "wetin you dey sell", "wetin dey available",
}


def quick_intent(message):
    normalized = " ".join(message.casefold().replace("’", "'").split()).strip(" .,!?👋")
    if normalized in GREETINGS:
        return "greeting"
    for greeting in sorted(GREETINGS, key=len, reverse=True):
        if normalized.startswith(greeting + " ") or normalized.startswith(greeting + ","):
            normalized = normalized[len(greeting):].lstrip(" ,.!?")
            break
    return "catalog" if normalized in CATALOG_REQUESTS else None


def quick_reply(session, vendor, messages):
    # Never discard an outstanding question or bypass a shopping mutation.
    intents = [quick_intent(message) for message in messages]
    if not intents or any(intent is None for intent in intents):
        return None
    templates = load_templates(session)
    if "catalog" not in intents:
        return templates["greeting"]
    products = session.scalars(
        select(Product).where(
            Product.vendor_id == vendor.id,
            Product.status == "active",
            Product.stock > 0,
        ).order_by(Product.name, Product.id).limit(10)
    ).all()
    if not products:
        return templates["catalog_empty"]
    lines = [templates["catalog_header"], ""]
    for product in products:
        # Keep database text inside one WhatsApp list entry.
        name = re.sub(r"[*_~`]", "", " ".join(product.name.split()))[:120]
        lines.append(f"• {name} — ₦{product.price:,.2f}")
    lines.extend(["", templates["catalog_footer"]])
    return "\n".join(lines)


def _cart_text(cart_result):
    items = cart_result.get("items") or []
    if not items:
        return "Your cart is empty. Send a product name and quantity to add an item."
    lines = ["*Your cart:*", ""]
    for item in items:
        lines.append(f"• {item['name']} x{item['qty']} — ₦{Decimal(str(item['price'])) * int(item['qty']):,.2f}")
    lines.extend(["", f"*Total: ₦{Decimal(str(cart_result['total'])):,.2f}*"])
    return "\n".join(lines)


def ai_failure_reply(session, vendor, message, customer_phone=None):
    """Guide the customer with safe presets when no AI provider is available."""
    preset = quick_reply(session, vendor, [message])
    if preset:
        return preset
    normalized = " ".join(message.casefold().split())
    dispatcher = (
        CustomerToolDispatcher(session, vendor.id, customer_phone, commit=False)
        if customer_phone else None
    )
    if normalized in {"1", "1.", "products", "catalog", "catalogue"}:
        return quick_reply(session, vendor, ["what do you sell"])
    if normalized in {"2", "2.", "cart", "my cart", "view cart"} and dispatcher:
        return _cart_text(dispatcher.view_cart({}))
    if normalized in {"3", "3.", "checkout"} and dispatcher:
        cart = dispatcher.view_cart({})
        if not cart.get("items"):
            return "Your cart is empty. Choose 1 to see products, then send the product name and quantity."
        return _cart_text(cart) + "\n\nSend your delivery address to complete checkout."
    if "cart" in normalized:
        return (
            "I can help with your cart. Send the product name and quantity to add an item, "
            "or send *checkout* when you are ready."
        )
    if "checkout" in normalized or "order" in normalized:
        return (
            "To checkout: add your product and quantity first, then send *checkout*. "
            "I will ask for your delivery address and show the payment details."
        )
    return (
        "Reply with:\n"
        "1 — See available products\n"
        "2 — View my cart\n"
        "3 — Checkout\n\n"
        "You can also send a product name and quantity."
    )
