"""Opt-in staging probe. Never import or invoke this from the application."""

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

import httpx
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.integrations.bumpa import mappers  # noqa: E402
from app.integrations.bumpa.client import (  # noqa: E402
    BumpaClient,
    BumpaValidationError,
)

STAGING_URL = "https://api.bumpa.xyz"
REAL = BACKEND / "tests" / "fixtures" / "bumpa" / "real"
SENSITIVE_KEYS = {"x-api-key", "x-cart-token", "api_key", "public_key", "secret_key", "cart_token", "access_token", "token", "account_number"}


class ProbeSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND / ".env", env_ignore_empty=True, extra="ignore")

    bumpa_base_url: str = STAGING_URL
    bumpa_public_key: SecretStr = SecretStr("")
    bumpa_secret_key: SecretStr = SecretStr("")
    bumpa_location_id: str = ""


def _redact(value: Any, secrets: tuple[str, ...]) -> Any:
    if isinstance(value, dict):
        return {key: "[REDACTED]" if str(key).lower() in SENSITIVE_KEYS else _redact(item, secrets) for key, item in value.items()}
    if isinstance(value, list):
        return [_redact(item, secrets) for item in value]
    if isinstance(value, str):
        result = value
        for secret in secrets:
            if secret:
                result = result.replace(secret, "[REDACTED]")
        return result
    return value


def _save(name: str, raw: Any, settings: ProbeSettings) -> None:
    REAL.mkdir(parents=True, exist_ok=True)
    safe = _redact(raw, (
        settings.bumpa_public_key.get_secret_value(),
        settings.bumpa_secret_key.get_secret_value(),
        settings.bumpa_location_id,
    ))
    (REAL / f"{name}.json").write_text(json.dumps(safe, indent=2, ensure_ascii=False), encoding="utf-8")


def _report(name: str, raw: Any) -> None:
    checks = {
        "products-list": [("extract_product_rows", mappers.extract_product_rows(raw) is not None)],
        "product-detail": [("extract_product_id", mappers.extract_product_id(raw) is not None),
                           ("extract_name", mappers.extract_name(raw) is not None),
                           ("extract_price", mappers.extract_price(raw) is not None),
                           ("extract_currency", mappers.extract_currency(raw) is not None),
                           ("extract_stock", mappers.extract_stock(raw) is not None),
                           ("extract_image_urls", bool(mappers.extract_image_urls(raw))),
                           ("extract_variations", bool(mappers.extract_variations(raw))),
                           ("extract_is_published", mappers.extract_is_published(raw) is not None),
                           ("extract_product_url", mappers.extract_product_url(raw) is not None)],
        "cart-create": [("extract_cart_id", mappers.extract_cart_id(raw) is not None),
                        ("extract_cart_token", mappers.extract_cart_token(raw) is not None)],
        "shipping-options": [("extract_shipping_options", bool(mappers.extract_shipping_options(raw)))],
        "checkout-create": [("extract_checkout_id", mappers.extract_checkout_id(raw) is not None)],
        "payment-intent": [("extract_authorization_url", mappers.extract_authorization_url(raw) is not None),
                           ("extract_payment_reference", mappers.extract_payment_reference(raw) is not None),
                           ("extract_order_id", mappers.extract_order_id(raw) is not None),
                           ("extract_amount", mappers.extract_amount(raw) is not None),
                           ("extract_currency", mappers.extract_currency(raw) is not None)],
        "checkout-read": [("extract_payment_status", mappers.extract_payment_status(raw) is not None),
                          ("extract_shipping_status", mappers.extract_shipping_status(raw) is not None),
                          ("extract_invoice_url", mappers.extract_invoice_url(raw) is not None)],
        "checkout-finalize": [("extract_order_id", mappers.extract_order_id(raw) is not None),
                              ("extract_invoice_url", mappers.extract_invoice_url(raw) is not None)],
    }
    if name.startswith("orders"):
        orders = mappers.extract_order_rows(raw)
        sample = orders[0] if orders else {}
        checks[name] = [("extract_order_rows", bool(orders)),
                        ("extract_order_id", mappers.extract_order_id(sample) is not None),
                        ("extract_payment_status", mappers.extract_payment_status(sample) is not None),
                        ("extract_shipping_status", mappers.extract_shipping_status(sample) is not None),
                        ("extract_invoice_url", mappers.extract_invoice_url(sample) is not None)]
    selected = next((rows for prefix, rows in checks.items() if name.startswith(prefix)), [])
    for mapper_name, found in selected:
        print(f"{name:<22} {mapper_name:<30} {'found' if found else 'UNKNOWN'}")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Read-only Bumpa staging probe unless explicitly told to create a test checkout")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--checkout", action="store_true", help="Create a test checkout and payment intent; stop before finalize")
    mode.add_argument("--after-payment", metavar="CHECKOUT_ID", help="Fetch, finalize, and inspect a checkout after a test payment")
    parser.add_argument("--i-know-this-is-production", action="store_true")
    parser.add_argument("--product-id")
    parser.add_argument("--variation-id")
    parser.add_argument("--quantity", type=int, default=1)
    for name in ("first-name", "last-name", "email", "phone", "street", "city", "state", "country", "zip"):
        parser.add_argument(f"--{name}")
    parser.add_argument("--shipping-id")
    return parser


async def _run(args: argparse.Namespace, settings: ProbeSettings) -> None:
    if settings.bumpa_base_url.rstrip("/") != STAGING_URL and not args.i_know_this_is_production:
        raise SystemExit("Refusing non-staging BUMPA_BASE_URL without --i-know-this-is-production")
    if args.checkout:
        required = ("first_name", "last_name", "email", "phone", "street", "city", "state", "country", "zip")
        missing = [field for field in required if not getattr(args, field)]
        if missing or args.quantity < 1:
            raise SystemExit("--checkout requires a positive quantity and all customer/delivery fields: " + ", ".join(missing))
    print(f"{'response':<22} {'mapper':<30} result")
    async with httpx.AsyncClient(timeout=10) as http:
        client = BumpaClient(
            settings.bumpa_base_url, settings.bumpa_public_key.get_secret_value(),
            settings.bumpa_secret_key.get_secret_value(), settings.bumpa_location_id, http,
        )

        def capture(name: str, response: Any) -> Any:
            _save(name, response, settings)
            _report(name, response)
            return response

        if args.after_payment:
            checkout = capture("checkout-read", await client.get_checkout(args.after_payment))
            try:
                finalized = capture("checkout-finalize", await client.finalize(args.after_payment))
            except BumpaValidationError as exc:
                capture("checkout-finalize-error", {"errors": exc.errors_payload})
                raise SystemExit("Bumpa has not confirmed payment; finalize remains pending") from exc
            order_id = mappers.extract_order_id(finalized) or mappers.extract_order_id(checkout)
            capture("orders-after-payment", await client.list_orders(search=order_id, limit=10) if order_id else await client.list_orders(limit=10))
            return

        products = capture("products-list-page-1", await client.list_products(limit=10, page=1, variations=1))
        product_rows = mappers.extract_product_rows(products) or []
        product_id = args.product_id or (mappers.extract_product_id(product_rows[0]) if product_rows else None)
        if product_id:
            capture("product-detail", await client.get_product(product_id, variations=True))
        capture("orders-list", await client.list_orders(limit=10))
        if not args.checkout:
            return
        if not product_id:
            raise SystemExit("No product ID found; rerun with --product-id after updating mappers")
        cart = capture("cart-create", await client.create_cart())
        cart_id, token = mappers.extract_cart_id(cart), mappers.extract_cart_token(cart)
        if not cart_id or not token:
            raise SystemExit("Cart ID/token shape unknown; update mappers and retry")
        added = capture("cart-add-item", await client.add_cart_item(token, product_id, args.quantity, args.variation_id))
        token = mappers.extract_cart_token(added) or token
        address = {"type": "delivery", "first_name": args.first_name, "last_name": args.last_name,
                   "email": args.email, "phone": args.phone, "street": args.street, "city": args.city,
                   "state": args.state, "country": args.country, "zip": args.zip}
        options_response = capture("shipping-options", await client.shipping_options(cart_id, address))
        options = mappers.extract_shipping_options(options_response)
        shipping_id = args.shipping_id or next((value for option in options if (value := mappers.extract_shipping_id(option))), None)
        if not shipping_id:
            raise SystemExit("No shipping ID found; update mappers or choose --shipping-id")
        customer = {"email": args.email, "first_name": args.first_name, "last_name": args.last_name, "phone": args.phone}
        # TODO(BUMPA_SHIPPING_FIELD): verify shipping_method_id against staging's
        # documented shipping_id response before production use.
        created = capture("checkout-create", await client.create_checkout(cart_id, customer, {"type": "delivery", "shipping_method_id": shipping_id}))
        checkout_id = mappers.extract_checkout_id(created)
        if not checkout_id:
            raise SystemExit("Checkout ID shape unknown; update mappers and retry")
        capture("checkout-totals", await client.calculate_totals(checkout_id))
        capture("payment-intent", await client.payment_intent(checkout_id))
        print(f"STOPPED BEFORE FINALIZE. Checkout ID for --after-payment: {checkout_id}")


def main() -> None:
    args = _parser().parse_args()
    settings = ProbeSettings()
    if not all((settings.bumpa_public_key.get_secret_value(), settings.bumpa_secret_key.get_secret_value(), settings.bumpa_location_id)):
        raise SystemExit("Set BUMPA_PUBLIC_KEY, BUMPA_SECRET_KEY and BUMPA_LOCATION_ID in backend/.env")
    asyncio.run(_run(args, settings))


if __name__ == "__main__":
    main()
