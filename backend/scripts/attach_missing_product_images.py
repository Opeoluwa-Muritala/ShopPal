"""Attach reviewed workspace images to exact products that still lack one."""

import sys
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.models import Product, Vendor, WhatsAppMedia  # noqa: E402
from app.db.session import get_engine  # noqa: E402
from app.services.product_images import compress_product_image  # noqa: E402

ASSET_DIR = Path(__file__).resolve().parents[1] / "assets" / "generated-products"
PRODUCT_ASSETS = {
    "Sneakers Red": "sneakers-red.png",
    "foodc": "foodc.png",
    "red": "red.png",
}
VENDOR_NAME = "OMJ Labs"


def main() -> int:
    prepared = {
        name: compress_product_image((ASSET_DIR / filename).read_bytes(), "image/png")
        for name, filename in PRODUCT_ASSETS.items()
    }
    attached = 0
    with Session(get_engine()) as session:
        vendor = session.scalar(select(Vendor).where(Vendor.business_name == VENDOR_NAME))
        if vendor is None:
            raise RuntimeError("Target vendor was not found")
        products = session.scalars(select(Product).where(
            Product.vendor_id == vendor.id,
            Product.name.in_(PRODUCT_ASSETS),
        )).all()
        by_name = {product.name: product for product in products}
        if set(by_name) != set(PRODUCT_ASSETS):
            raise RuntimeError("Exact target product set was not found")
        for name, product in by_name.items():
            if product.image_media_id is not None:
                continue
            media = WhatsAppMedia(
                id=uuid4(),
                wa_media_id=f"product-image:{product.id}",
                mime_type="image/jpeg",
                message_type="image",
                content=prepared[name],
            )
            session.add(media)
            session.flush()
            product.image_media_id = media.id
            product.image_url = f"/api/products/{product.id}/image"
            attached += 1
        session.commit()
    print(f"Attached {attached} missing product images for {VENDOR_NAME}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
