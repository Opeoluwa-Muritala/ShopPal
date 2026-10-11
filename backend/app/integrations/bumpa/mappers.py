"""All response-shape assumptions live here until staging confirms them.

TODO(BUMPA_RESPONSE_SHAPES): compare these candidates with probe fixtures.
Only top-level field names are logged; raw values may contain customer data.
"""

import logging
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlsplit

logger = logging.getLogger(__name__)


def _lookup(raw: Any, *paths: str) -> Any | None:
    for path in paths:
        value = raw
        for part in path.split("."):
            if not isinstance(value, dict) or part not in value:
                break
            value = value[part]
        else:
            if value is not None and value != "":
                return value
    return None


def _missing(field: str, raw: Any) -> None:
    keys = tuple(str(key) for key in raw.keys()) if isinstance(raw, dict) else ()
    logger.warning("Bumpa field %s not found; raw top-level keys: %s", field, keys)


def _string(raw: Any, field: str, *paths: str) -> str | None:
    value = _lookup(raw, *paths)
    if isinstance(value, (str, int)) and not isinstance(value, bool):
        return str(value)
    _missing(field, raw)
    return None


def _decimal(raw: Any, field: str, *paths: str) -> Decimal | None:
    value = _lookup(raw, *paths)
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        _missing(field, raw)
        return None
    if not amount.is_finite() or amount < 0:
        _missing(field, raw)
        return None
    return amount


def extract_product_id(raw: Any) -> str | None:
    return _string(raw, "product_id", "id", "product_id", "data.id", "data.product_id")


def extract_name(raw: Any) -> str | None:
    return _string(raw, "name", "name", "title", "data.name", "data.title")


def extract_description(raw: Any) -> str | None:
    return _string(raw, "description", "description", "data.description")


def extract_price(raw: Any) -> Decimal | None:
    return _decimal(raw, "price", "price", "selling_price", "price.amount", "data.price", "data.selling_price", "data.price.amount")


def extract_currency(raw: Any) -> str | None:
    return _string(raw, "currency", "currency", "price.currency", "data.currency", "data.price.currency")


def extract_stock(raw: Any) -> int | None:
    value = _lookup(raw, "stock", "quantity", "inventory", "stock_qty", "data.stock", "data.quantity", "data.inventory")
    try:
        stock = int(str(value))
    except (TypeError, ValueError):
        _missing("stock", raw)
        return None
    if stock < 0:
        _missing("stock", raw)
        return None
    return stock


def extract_image_urls(raw: Any) -> list[str]:
    value = _lookup(raw, "image_urls", "images", "image_url", "image", "data.image_urls", "data.images", "data.image_url")
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        urls = [item if isinstance(item, str) else item.get("url") if isinstance(item, dict) else None for item in value]
        return [url for url in urls if isinstance(url, str)]
    if isinstance(value, dict) and isinstance(value.get("url"), str):
        return [value["url"]]
    _missing("image_urls", raw)
    return []


def extract_variations(raw: Any) -> list[dict[str, Any]]:
    value = _lookup(raw, "variations", "variants", "data.variations", "data.variants")
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    _missing("variations", raw)
    return []


def extract_is_published(raw: Any) -> bool | None:
    value = _lookup(raw, "is_published", "published", "status", "data.is_published", "data.published", "data.status")
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.lower()
        if normalized in {"published", "active", "true"}:
            return True
        if normalized in {"unpublished", "draft", "inactive", "false"}:
            return False
    _missing("is_published", raw)
    return None


def extract_product_url(raw: Any) -> str | None:
    return _string(raw, "product_url", "product_url", "url", "link", "data.product_url", "data.url")


def extract_cart_id(raw: Any) -> str | None:
    return _string(raw, "cart_id", "id", "cart_id", "data.id", "data.cart_id")


def extract_cart_token(raw: Any) -> str | None:
    return _string(raw, "cart_token", "cart_token", "data.cart_token")


def extract_checkout_id(raw: Any) -> str | None:
    return _string(raw, "checkout_id", "checkout_id", "id", "data.checkout_id", "data.id")


def extract_order_id(raw: Any) -> str | None:
    return _string(raw, "order_id", "order_id", "order.id", "data.order_id", "data.order.id", "data.id")


def extract_payment_status(raw: Any) -> str | None:
    return _string(raw, "payment_status", "payment_status", "payment.status", "data.payment_status", "data.payment.status", "status", "data.status")


def extract_shipping_status(raw: Any) -> str | None:
    return _string(raw, "shipping_status", "shipping_status", "shipping.status", "data.shipping_status", "data.shipping.status")


def extract_invoice_url(raw: Any) -> str | None:
    value = _string(raw, "invoice_url", "invoice_url", "receipt_url", "invoice.link", "invoice.url", "receipt.link", "data.invoice_url", "data.receipt_url", "data.invoice.link", "data.invoice.url")
    if value is None:
        return None
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname:
        _missing("invoice_url_https", raw)
        return None
    return value


def extract_authorization_url(raw: Any) -> str | None:
    value = _string(raw, "authorization_url", "authorization_url", "data.authorization_url")
    if value is None:
        return None
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname:
        _missing("authorization_url_https", raw)
        return None
    return value


def extract_payment_reference(raw: Any) -> str | None:
    return _string(raw, "reference", "reference", "payment_reference", "data.reference", "data.payment_reference")


def extract_amount(raw: Any) -> Decimal | None:
    return _decimal(raw, "amount", "amount", "total", "data.amount", "data.total")


def extract_shipping_options(raw: Any) -> list[dict[str, Any]]:
    value = _lookup(raw, "shipping_options", "data.shipping_options")
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    _missing("shipping_options", raw)
    return []


def extract_product_rows(raw: Any) -> list[dict[str, Any]] | None:
    value = raw if isinstance(raw, list) else _lookup(raw, "data.products", "products", "data", "items")
    if isinstance(value, list):
        if all(isinstance(item, dict) for item in value):
            return value
    _missing("product_rows", raw)
    return None


def extract_order_rows(raw: Any) -> list[dict[str, Any]]:
    value = raw if isinstance(raw, list) else _lookup(raw, "data.orders", "orders", "data", "items")
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    _missing("order_rows", raw)
    return []
