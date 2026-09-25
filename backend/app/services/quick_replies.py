"""Deterministic replies for unambiguous greetings and general catalog requests."""

import re
from decimal import Decimal

from sqlalchemy import select

from app.db.models import Conversation, Product
from app.services.customer_tools import CustomerToolDispatcher
from app.services.reply_templates import load_templates

GREETINGS = {"hi", "hello", "hey", "good morning", "good afternoon", "good evening"}
CATALOG_REQUESTS = {
    "what do you sell", "what do you have", "what do you have in stock",
    "what is available", "what's available", "show me your products",
    "show products", "show me your catalog", "catalog", "catalogue",
    "what can i buy", "wetin you dey sell", "wetin dey available",
}
NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}


def quick_intent(message):
    normalized = " ".join(message.casefold().replace("’", "'").split())
    normalized = re.sub(r"[^\w\s']", "", normalized).strip()
    if normalized in GREETINGS:
        return "greeting"
    for greeting in sorted(GREETINGS, key=len, reverse=True):
        if normalized.startswith(greeting + " ") or normalized.startswith(greeting + ","):
            normalized = normalized[len(greeting):].lstrip(" ,.!?")
            break
    return "catalog" if normalized in CATALOG_REQUESTS else None


def quick_reply(session, vendor, messages, customer_phone=None, history=None):
    # Never discard an outstanding question or bypass a shopping mutation.
    intents = [quick_intent(message) for message in messages]
    if customer_phone and messages:
        shopping_reply = _explicit_shopping_reply(
            session, vendor, messages[-1], customer_phone, history or []
        )
        if shopping_reply:
            return shopping_reply
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
    for number, product in enumerate(products, start=1):
        # Keep database text inside one WhatsApp list entry.
        name = re.sub(r"[*_~`]", "", " ".join(product.name.split()))[:120]
        lines.append(f"{number}. {name} — ₦{product.price:,.2f}")
    lines.extend(["", templates["catalog_footer"]])
    return "\n".join(lines)


def _quantity(value):
    value = value.casefold().strip()
    if value.isdigit():
        quantity = int(value)
        return quantity if 1 <= quantity <= 1000 else None
    return NUMBER_WORDS.get(value)


def _clean_product_name(value):
    return " ".join(re.sub(r"[^\w\s]", " ", value.casefold()).split())


def _find_product(session, vendor, text):
    products = session.scalars(
        select(Product).where(
            Product.vendor_id == vendor.id,
            Product.status == "active",
            Product.stock > 0,
        ).order_by(Product.name, Product.id).limit(100)
    ).all()
    normalized = _clean_product_name(text)
    matches = [
        product for product in products
        if _clean_product_name(product.name) == normalized
        or _clean_product_name(product.name) in normalized
        or _clean_product_name(product.name).startswith(normalized + " ")
    ]
    return matches[0] if len(matches) == 1 else None


def _previous_selection(session, vendor, customer_phone, history):
    selected = next(
        (
            str(row.get("content", ""))
            for row in reversed(history)
            if row.get("role") == "assistant"
            and str(row.get("content", "")).startswith("You selected ")
        ),
        None,
    )
    if not selected:
        return None
    name = selected.removeprefix("You selected ").removesuffix(
        ". How many would you like?"
    )
    return _find_product(session, vendor, name)


def _explicit_shopping_reply(session, vendor, message, customer_phone, history):
    """Handle unambiguous product/quantity messages before invoking the LLM."""
    normalized = " ".join(message.casefold().split())
    dispatcher = CustomerToolDispatcher(
        session, vendor.id, customer_phone, commit=False
    )

    # A quantity sent in response to "How many?" belongs to the remembered item.
    quantity = _quantity(normalized)
    if quantity is not None:
        product = _previous_selection(session, vendor, customer_phone, history)
        if product:
            result = dispatcher.add_to_cart(
                {"productId": str(product.id), "quantity": quantity}
            )
            if "error" not in result:
                return _cart_text(result) + (
                    f"\n\nAdded {quantity} of {product.name} to your cart."
                )

    # Resolve a catalog number locally so the next message can use the selection.
    if normalized.isdigit() and 1 <= int(normalized) <= 10:
        catalogue = next(
            (
                str(row.get("content", ""))
                for row in reversed(history)
                if row.get("role") == "assistant" and "1." in str(row.get("content", ""))
            ),
            None,
        )
        if catalogue:
            entries = [
                line for line in catalogue.splitlines() if re.match(r"^\d+\.\s", line)
            ]
            index = int(normalized) - 1
            if index < len(entries):
                name = re.sub(r"^\d+\.\s|\s+—.*$", "", entries[index]).strip()
                product = _find_product(session, vendor, name)
                if product:
                    return f"You selected {product.name}. How many would you like?"

    # Accept both "10 velvet rose" and "midnight musk quantity 4".
    match = re.match(
        r"^(?:i\s+want\s+to\s+buy|i\s+want|add|buy)?\s*"
        r"(?:(\d{1,4}|one|two|three|four|five|six|seven|eight|nine|ten)\s+)?"
        r"(.+?)\s+(?:quantity|qty|units?|pieces?|pcs?)\s*"
        r"(?:is|=)?\s*(\d{1,4}|one|two|three|four|five|six|seven|eight|nine|ten)"
        r"$|^(?:i\s+want\s+to\s+buy|i\s+want|add|buy)?\s*"
        r"(\d{1,4}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)$",
        normalized,
    )
    if not match:
        return None
    groups = match.groups()
    if groups[1] is not None:
        quantity_value, product_text = groups[0] or groups[2], groups[1]
    else:
        quantity_value, product_text = groups[3], groups[4]
    quantity = _quantity(quantity_value)
    product = _find_product(session, vendor, product_text)
    if quantity is None or product is None:
        return None
    result = dispatcher.add_to_cart(
        {"productId": str(product.id), "quantity": quantity}
    )
    if "error" in result:
        return result["error"]
    return _cart_text(result) + f"\n\nAdded {quantity} of {product.name} to your cart."


def _cart_text(cart_result):
    items = cart_result.get("items") or []
    if not items:
        return "Your cart is empty. Send a product name and quantity to add an item."
    lines = ["*Your cart:*", ""]
    for item in items:
        lines.append(f"• {item['name']} x{item['qty']} — ₦{Decimal(str(item['price'])) * int(item['qty']):,.2f}")
    lines.extend(["", f"*Total: ₦{Decimal(str(cart_result['total'])):,.2f}*"])
    return "\n".join(lines)


def ai_failure_reply(session, vendor, message, customer_phone=None, *, structured=False):
    """Guide the customer with safe presets when no AI provider is available."""
    preset = quick_reply(session, vendor, [message])
    if preset:
        return preset
    normalized = " ".join(message.casefold().split())
    dispatcher = (
        CustomerToolDispatcher(session, vendor.id, customer_phone, commit=False)
        if customer_phone else None
    )
    if customer_phone and normalized.isdigit() and 1 <= int(normalized) <= 10:
        conversation = session.scalar(select(Conversation).where(
            Conversation.vendor_id == vendor.id,
            Conversation.customer_phone == customer_phone,
        ))
        raw_history = getattr(conversation, "message_history", None) if conversation else None
        history = list(raw_history) if isinstance(raw_history, list) else []
        previous_selection = next(
            (str(row.get("content", "")) for row in reversed(history)
             if row.get("role") == "assistant" and str(row.get("content", "")).startswith("You selected ")),
            None,
        )
        if previous_selection and dispatcher:
            selected_name = previous_selection.removeprefix("You selected ").removesuffix(". How many would you like?")
            products = session.scalars(select(Product).where(
                Product.vendor_id == vendor.id,
                Product.status == "active",
                Product.name == selected_name,
            )).all()
            if len(products) == 1:
                result = dispatcher.add_to_cart({"productId": str(products[0].id), "quantity": int(normalized)})
                if "error" not in result:
                    return _cart_text(result) + f"\n\nAdded {normalized} of {selected_name} to your cart."
        catalogue = next(
            (row.get("content", "") for row in reversed(history)
             if row.get("role") == "assistant" and "1." in str(row.get("content", ""))),
            None,
        )
        if catalogue:
            entries = [line for line in str(catalogue).splitlines() if re.match(r"^\d+\.\s", line)]
            selected = entries[int(normalized) - 1] if int(normalized) <= len(entries) else None
            if selected:
                name = re.sub(r"^\d+\.\s|\s+—.*$", "", selected).strip()
                return f"You selected {name}. How many would you like?"
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
    if structured:
        return "Please reply with:\n1 — See available products\n2 — View your cart\n3 — Checkout"
    return "Could you tell me a little more about what you would like to do? For example, you can ask about products, your cart, or checkout."
