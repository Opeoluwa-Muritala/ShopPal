"""Allowlisted customer shopping tools available to Gemma."""

import asyncio
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Cart, Customer, Product, Vendor
from app.services.orders import create_order_from_cart
from app.services.flutterwave_v4 import FlutterwaveClientError, get_virtual_account_provider


class CustomerToolDispatcher:
    def __init__(self, session: Session, vendor_id: UUID, customer_phone: str, *, commit: bool = True):
        self.session = session
        self.vendor_id = vendor_id
        self.customer_phone = customer_phone
        self.commit = commit

    def _save(self):
        if self.commit:
            self.session.commit()
        else:
            self.session.flush()

    def __call__(self, name: str, args: dict[str, Any]) -> dict[str, Any]:
        handler = {
            "searchProducts": self.search_products,
            "showProductImage": self.show_product_image,
            "viewCart": self.view_cart,
            "addToCart": self.add_to_cart,
            "updateCartItem": self.update_cart_item,
            "removeCartItem": self.remove_cart_item,
            "checkoutCart": self.checkout_cart,
        }.get(name)
        if handler is None:
            return {"error": "That customer action is unavailable"}
        try:
            return handler(args)
        except (KeyError, TypeError, ValueError):
            return {"error": "I could not understand that shopping action"}

    def _cart(self) -> Cart:
        cart = self.session.scalar(
            select(Cart).where(
                Cart.vendor_id == self.vendor_id,
                Cart.customer_phone == self.customer_phone,
            )
        )
        if cart is not None and cart.state == "checked_out":
            cart.items = []
            cart.state = "active"
        if cart is None:
            cart = Cart(
                vendor_id=self.vendor_id,
                customer_phone=self.customer_phone,
                items=[],
                state="active",
            )
            self.session.add(cart)
            self.session.flush()
        return cart

    def _product(self, product_id: str) -> Product | None:
        try:
            product_uuid = UUID(product_id)
        except ValueError:
            return None
        return self.session.scalar(
            select(Product).where(
                Product.id == product_uuid,
                Product.vendor_id == self.vendor_id,
                Product.status == "active",
            )
        )

    def search_products(self, args: dict[str, Any]) -> dict[str, Any]:
        query = str(args["query"]).strip()
        products = self.session.scalars(
            select(Product)
            .where(
                Product.vendor_id == self.vendor_id,
                Product.status == "active",
                or_(
                    Product.name.ilike(f"%{query}%"),
                    Product.description.ilike(f"%{query}%"),
                ),
            )
            .limit(10)
        ).all()
        return {
            "products": [
                {
                    "product_id": str(product.id),
                    "name": product.name,
                    "price": str(product.price),
                    "stock": product.stock,
                    "description": product.description,
                    "has_image": product.image_media_id is not None,
                }
                for product in products
            ]
        }

    def view_cart(self, _args: dict[str, Any]) -> dict[str, Any]:
        cart = self._cart()
        total = sum(
            Decimal(str(item["price"])) * int(item["qty"])
            for item in (cart.items or [])
        )
        return {
            "items": cart.items or [],
            "total": str(total.quantize(Decimal("0.01"))),
        }

    def show_product_image(self, args: dict[str, Any]) -> dict[str, Any]:
        product = self._product(str(args["productId"]))
        if product is None or product.image_media_id is None:
            return {"error": "A photo is unavailable for that product"}
        return {"image_product_id": str(product.id), "caption": f"{product.name} — NGN {product.price:,.2f}"}

    def add_to_cart(self, args: dict[str, Any]) -> dict[str, Any]:
        product = self._product(str(args["productId"]))
        quantity = int(args["quantity"])
        if product is None or quantity < 1 or quantity > product.stock:
            return {"error": "That product or quantity is unavailable"}
        cart = self._cart()
        items = list(cart.items or [])
        existing = next(
            (item for item in items if item["product_id"] == str(product.id)),
            None,
        )
        previous_quantity = int(existing["qty"]) if existing else 0
        if existing:
            quantity += int(existing["qty"])
            if quantity > product.stock:
                return {"error": "That quantity is unavailable"}
            existing["qty"] = quantity
        else:
            items.append(
                {
                    "product_id": str(product.id),
                    "name": product.name,
                    "price": str(product.price),
                    "qty": quantity,
                }
            )
        cart.items = items
        self._save()
        result = self.view_cart({})
        result.update({
            "cart_action": "increased_existing" if existing else "added_new",
            "added_quantity": int(args["quantity"]),
            "previous_quantity": previous_quantity,
        })
        return result

    def update_cart_item(self, args: dict[str, Any]) -> dict[str, Any]:
        product = self._product(str(args["productId"]))
        quantity = int(args["quantity"])
        if product is None or quantity < 1 or quantity > product.stock:
            return {"error": "That product or quantity is unavailable"}
        cart = self._cart()
        items = list(cart.items or [])
        item = next(
            (row for row in items if row["product_id"] == str(product.id)),
            None,
        )
        if item is None:
            return {"error": "That product is not in the cart"}
        item["qty"] = quantity
        cart.items = items
        self._save()
        return self.view_cart({})

    def remove_cart_item(self, args: dict[str, Any]) -> dict[str, Any]:
        cart = self._cart()
        product_id = str(args["productId"])
        cart.items = [
            item for item in (cart.items or []) if item["product_id"] != product_id
        ]
        self._save()
        return self.view_cart({})

    def checkout_cart(self, args: dict[str, Any]) -> dict[str, Any]:
        cart = self._cart()
        address = str(args["deliveryAddress"]).strip()
        if not address or not cart.items:
            return {"error": "A delivery address and non-empty cart are required"}
        order = create_order_from_cart(
            self.session,
            self.vendor_id,
            self.customer_phone,
            address,
            [
                {"product_id": item["product_id"], "qty": item["qty"]}
                for item in cart.items
            ],
            commit=False,
        )
        vendor = self.session.get(Vendor, self.vendor_id)
        try:
            settings = get_settings()
            customer = self.session.scalar(select(Customer).where(Customer.wa_number == self.customer_phone).with_for_update())
            if customer is None:
                customer = Customer(wa_number=self.customer_phone)
                self.session.add(customer)
                self.session.flush()
            provider = get_virtual_account_provider(settings)
            if not customer.fw_customer_id:
                customer.fw_customer_id = asyncio.run(provider.create_customer(self.customer_phone))
            account = asyncio.run(provider.create_virtual_account(customer_id=customer.fw_customer_id, tx_ref=str(order.order_code), amount=Decimal(str(order.total)), expires_seconds=settings.order_expiry_minutes * 60))
            order.tx_ref = str(order.order_code)
            order.wa_number = self.customer_phone
            order.currency = "NGN"
            order.status = "pending"
            order.expires_at = datetime.now(UTC) + timedelta(minutes=settings.order_expiry_minutes)
            order.fw_reference = account.provider_reference
            order.account_number = account.account_number
            order.bank_name = account.bank_name
        except FlutterwaveClientError as exc:
            raise HTTPException(status_code=503, detail="Bank transfer checkout is temporarily unavailable") from exc
        order.payment_provider = "flutterwave"
        order.payment_reference = str(order.order_code)
        if self.commit:
            self.session.commit()
        else:
            self.session.flush()
        return {
            "order_code": order.order_code,
            "total": str(order.total),
            "status": order.status,
            "payment_status": order.payment_status,
            "delivery_address": order.delivery_address,
            "payment_provider": "flutterwave",
            "payment_reference": order.payment_reference,
            "payment_url": None,
            "bank_name": order.bank_name,
            "account_number": order.account_number,
            "expires_at": order.expires_at.isoformat() if order.expires_at else None,
            "payment_instruction": "Transfer the exact amount to the bank account shown in WhatsApp. Tap I've paid after sending; your order is confirmed only after Flutterwave verifies the transfer.",
        }
