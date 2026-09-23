"""Allowlisted customer shopping tools available to Gemma."""

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.models import Cart, Product, Vendor
from app.services.orders import create_order_from_cart


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
        return self.view_cart({})

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
            commit=self.commit,
        )
        vendor = self.session.get(Vendor, self.vendor_id)
        return {
            "order_code": order.order_code,
            "total": str(order.total),
            "status": order.status,
            "payment_status": order.payment_status,
            "delivery_address": order.delivery_address,
            "payment_account": vendor.bank_account if vendor else None,
            "payment_instruction": (
                "Transfer the exact total to the vendor account shown, then wait for verified confirmation."
                if vendor and vendor.bank_account
                else "Payment details are not configured yet; please ask the vendor."
            ),
        }
