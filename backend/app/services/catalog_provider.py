"""Provider boundary for vendor-facing catalog and checkout behavior."""

from typing import Any, Protocol
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import CheckoutRef, Product, ProductCache, Vendor


class CatalogProvider(Protocol):
    def list_products(self) -> list[dict[str, Any]]: ...
    def get_product(self, product_id: str) -> dict[str, Any] | None: ...
    async def start_checkout(self, **kwargs: Any) -> Any: ...
    async def check_payment(self, checkout_ref: CheckoutRef, **kwargs: Any) -> str: ...


class LegacyProvider:
    """Adapter for existing SQL catalog; legacy checkout stays in customer tools."""

    def __init__(self, session: Session, merchant: Vendor) -> None:
        self.session = session
        self.merchant = merchant

    @staticmethod
    def _serialize(product: Product) -> dict[str, Any]:
        return {
            "id": str(product.id), "name": product.name, "price": str(product.price),
            "stock": product.stock, "image_url": product.image_url,
            "has_uploaded_image": product.image_media_id is not None,
            "description": product.description, "status": product.status,
        }

    def list_products(self) -> list[dict[str, Any]]:
        products = self.session.scalars(select(Product).where(Product.vendor_id == self.merchant.id)).all()
        return [self._serialize(product) for product in products]

    def get_product(self, product_id: str) -> dict[str, Any] | None:
        try:
            identifier = UUID(product_id)
        except ValueError:
            return None
        product = self.session.scalar(select(Product).where(Product.id == identifier, Product.vendor_id == self.merchant.id))
        return self._serialize(product) if product else None

    async def start_checkout(self, **kwargs: Any) -> Any:
        # Existing legacy checkout is intentionally owned by CustomerToolDispatcher.
        raise HTTPException(status_code=404, detail="Use the existing legacy WhatsApp checkout")

    async def check_payment(self, checkout_ref: CheckoutRef, **kwargs: Any) -> str:
        raise HTTPException(status_code=404, detail="Use the existing legacy payment flow")


class BumpaProvider:
    """Read from Neon cache; use the Bumpa service for live checkout/status."""

    def __init__(self, session: Session, merchant: Vendor) -> None:
        self.session = session
        self.merchant = merchant

    @staticmethod
    def _serialize(product: ProductCache) -> dict[str, Any]:
        return {
            "id": product.bumpa_product_id, "name": product.name,
            "price": str(product.price) if product.price is not None else None,
            "currency": product.currency, "stock": product.stock_qty,
            "image_url": product.image_urls[0] if product.image_urls else None,
            "image_urls": product.image_urls, "variations": product.variations,
            "description": product.description, "status": "active" if product.is_published else "unpublished",
        }

    def list_products(self) -> list[dict[str, Any]]:
        products = self.session.scalars(select(ProductCache).where(
            ProductCache.merchant_id == self.merchant.id,
            ProductCache.is_published.is_(True),
        ).order_by(ProductCache.name)).all()
        return [self._serialize(product) for product in products]

    def get_product(self, product_id: str) -> dict[str, Any] | None:
        product = self.session.scalar(select(ProductCache).where(
            ProductCache.merchant_id == self.merchant.id,
            ProductCache.bumpa_product_id == product_id,
            ProductCache.is_published.is_(True),
        ))
        return self._serialize(product) if product else None

    async def start_checkout(self, **kwargs: Any) -> Any:
        from app.services.bumpa_checkout import start_checkout

        return await start_checkout(self.merchant, **kwargs)

    async def check_payment(self, checkout_ref: CheckoutRef, **kwargs: Any) -> str:
        from app.services.bumpa_checkout import check_payment

        return await check_payment(self.merchant, checkout_ref, **kwargs)


def provider_for(session: Session, merchant_id: UUID) -> CatalogProvider:
    merchant = session.get(Vendor, merchant_id)
    if merchant is None:
        raise HTTPException(status_code=404, detail="Merchant not found")
    if merchant.catalog_provider == "bumpa":
        return BumpaProvider(session, merchant)
    return LegacyProvider(session, merchant)


def require_legacy_order_management(session: Session, merchant_id: UUID) -> None:
    merchant = session.get(Vendor, merchant_id)
    if merchant and getattr(merchant, "catalog_provider", None) == "bumpa":
        raise HTTPException(status_code=410, detail="Manage this shop's orders in Bumpa")


def require_legacy_catalog_write(session: Session, merchant_id: UUID) -> None:
    merchant = session.get(Vendor, merchant_id)
    if merchant and getattr(merchant, "catalog_provider", None) == "bumpa":
        raise HTTPException(status_code=410, detail="Manage this shop's products in Bumpa")
