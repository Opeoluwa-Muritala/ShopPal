"""Create or refresh the ShopPal demo vendor used for frontend login testing."""

import sys
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import httpx
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.models import Account, Product, Vendor, WhatsAppMedia  # noqa: E402
from app.db.session import get_engine  # noqa: E402
from app.services.auth import hash_password  # noqa: E402
from app.services.product_images import (  # noqa: E402
    MAX_PRODUCT_IMAGE_UPLOAD_BYTES,
    compress_product_image,
)

EMAIL = "demo.perfumes@shoppal.ng"
DEMO_PASSWORD = "DemoShopPal123!"
# Product has no category column in the current schema, so the seed keeps the
# perfume families explicit here and includes the family in each description.
# These fixed Unsplash assets come from perfume/fragrance product photography.
PRODUCT_GROUPS = {
    "Fresh and citrus perfumes": (
        ("Citrus Rush 30ml", "9500.00", 25, "photo-1541643600914-78b084683601"),
        ("Lagos Bloom 50ml", "14500.00", 18, "photo-1594035910387-fea47794261f"),
        ("Ocean Drive 50ml", "11000.00", 22, "photo-1523293182086-7651a899d37f"),
        ("Green Tea Breeze 30ml", "9000.00", 20, "photo-1595535373192-fc8935bacd89"),
        ("Neroli Coast 50ml", "15000.00", 14, "photo-1590736969955-71cc94901144"),
    ),
    "Floral perfumes": (
        ("Velvet Rose 50ml", "15500.00", 16, "photo-1592945403244-b3fbafd7f539"),
        ("Jasmine Veil 50ml", "14800.00", 17, "photo-1588405748880-12d1d2a59f75"),
        ("Peony Blush 30ml", "12500.00", 19, "photo-1615634260167-c8cdede054de"),
        ("White Orchid 50ml", "17000.00", 13, "photo-1619994403073-2cec844b8e63"),
        ("Hibiscus Silk 50ml", "15200.00", 15, "photo-1547887538-e3a2f32cb1cc"),
    ),
    "Woody and oud perfumes": (
        ("Midnight Musk 50ml", "16000.00", 15, "photo-1588405748880-12d1d2a59f75"),
        ("Oud Royale 50ml", "18500.00", 12, "photo-1615634260167-c8cdede054de"),
        ("Sandalwood Mist 30ml", "10500.00", 19, "photo-1595535373192-fc8935bacd89"),
        ("Amber Night 50ml", "17500.00", 11, "photo-1619994403073-2cec844b8e63"),
        ("Cedar Noir 50ml", "16800.00", 12, "photo-1541643600914-78b084683601"),
    ),
    "Gourmand and discovery perfumes": (
        ("Vanilla Dusk 50ml", "13500.00", 14, "photo-1590736969955-71cc94901144"),
        ("Cocoa Vanilla 50ml", "14200.00", 16, "photo-1594035910387-fea47794261f"),
        ("Caramel Cloud 30ml", "10800.00", 18, "photo-1523293182086-7651a899d37f"),
        ("Spiced Tonka 50ml", "16500.00", 10, "photo-1592945403244-b3fbafd7f539"),
        ("Discovery Set 5x5ml", "12000.00", 20, "photo-1547887538-e3a2f32cb1cc"),
    ),
}

LEGACY_NON_PERFUME_NAMES = {
    "Shea Glow Body Butter",
    "Cocoa Silk Lotion",
    "African Black Soap",
    "Coconut Sugar Scrub",
    "Aloe Calm Shower Gel",
    "His and Hers Gift Box",
    "Travel Atomizer Duo",
    "Scented Candle Trio",
    "Premium Self-Care Hamper",
}


def download_product_images(product_rows) -> dict[str, bytes]:
    """Download fixed seed assets, then validate and compress every image."""
    images: dict[str, bytes] = {}
    with httpx.Client(
        timeout=httpx.Timeout(30, connect=10),
        follow_redirects=True,
        headers={"User-Agent": "ShopPalDemoSeeder/1.0"},
    ) as client:
        for _group, name, _price, _stock, image_id in product_rows:
            source_url = (
                f"https://images.unsplash.com/{image_id}"
                "?auto=format&fit=crop&w=1200&q=88&fm=jpg"
            )
            response = client.get(source_url)
            if response.status_code == 404:
                # Fixed, verified perfume photograph for retired source assets.
                response = client.get("https://images.unsplash.com/photo-1594035910387-fea47794261f?fm=jpg&w=1200&q=88")
            response.raise_for_status()
            if len(response.content) > MAX_PRODUCT_IMAGE_UPLOAD_BYTES:
                raise RuntimeError(f"Seed image for {name} exceeds the upload limit")
            images[name] = compress_product_image(response.content, "image/jpeg")
    return images


def main() -> int:
    product_rows = [
        (group, name, Decimal(price), stock, image_id)
        for group, products in PRODUCT_GROUPS.items()
        for name, price, stock, image_id in products
    ]
    downloaded_images = download_product_images(product_rows)
    with get_engine().begin() as connection:
        # Use an ORM session bound to the same transaction for portability.
        from sqlalchemy.orm import Session

        with Session(bind=connection) as session:
            account = session.scalar(select(Account).where(Account.email == EMAIL))
            if account:
                vendor = session.get(Vendor, account.vendor_id)
            else:
                vendor = Vendor(
                    name="Demo ShopPal Vendor",
                    phone="2348000000000",
                    whatsapp_number="2348000000000",
                    business_name="ShopPal Demo Store",
                    bank_account="0123456789",
                    preferred_language="en",
                    is_active=True,
                )
                session.add(vendor)
                session.flush()
                account = Account(
                    vendor_id=vendor.id,
                    email=EMAIL,
                    phone=vendor.phone,
                    password_hash=hash_password(DEMO_PASSWORD),
                    role="owner",
                    is_active=True,
                )
                session.add(account)
                session.flush()

            if vendor is None:
                raise RuntimeError("Demo account is linked to a missing vendor")

            existing = {
                product.name: product
                for product in session.scalars(
                    select(Product).where(Product.vendor_id == vendor.id)
                ).all()
            }
            for legacy_name in LEGACY_NON_PERFUME_NAMES:
                legacy_product = existing.get(legacy_name)
                if legacy_product is not None:
                    session.delete(legacy_product)

            for group, name, price, stock, image_id in product_rows:
                product = existing.get(name)
                if product is None:
                    product = Product(
                        vendor_id=vendor.id,
                        name=name,
                        price=price,
                        stock=stock,
                        image_url="pending",
                    )
                    session.add(product)
                    session.flush()
                product.price = price
                product.stock = stock
                product.image_url = f"/api/products/{product.id}/image"
                product.description = f"{group}: {name} from ShopPal Demo Store"
                product.status = "active"

                media = (
                    session.get(WhatsAppMedia, product.image_media_id)
                    if product.image_media_id
                    else None
                )
                if media is None:
                    media = WhatsAppMedia(
                        id=uuid4(),
                        wa_media_id=f"product-image:{product.id}",
                        mime_type="image/jpeg",
                        message_type="image",
                    )
                    session.add(media)
                    session.flush()
                    product.image_media_id = media.id
                media.content = downloaded_images[name]
                media.mime_type = "image/jpeg"
            session.commit()
            print(
                f"Demo vendor ready: {EMAIL}; vendor_id={vendor.id}; "
                f"products={len(product_rows)}; groups={len(PRODUCT_GROUPS)}"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
