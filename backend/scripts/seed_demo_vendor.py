"""Create or refresh the ShopPal demo vendor used for frontend login testing."""

from decimal import Decimal
from pathlib import Path
import sys

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.models import Account, Product, Vendor  # noqa: E402
from app.db.session import get_engine  # noqa: E402
from app.services.auth import hash_password  # noqa: E402


EMAIL = "devtimmyoyin@gmail.com"
DEMO_PASSWORD = "DemoShopPal123!"
PRODUCTS = (
    ("Citrus Rush 30ml", Decimal("9500.00"), 25),
    ("Discovery Set 5x5ml", Decimal("12000.00"), 20),
    ("Lagos Bloom 50ml", Decimal("14500.00"), 18),
    ("Midnight Musk 50ml", Decimal("16000.00"), 15),
    ("Oud Royale 50ml", Decimal("18500.00"), 12),
    ("Velvet Rose 50ml", Decimal("15500.00"), 16),
)


def main() -> int:
    with get_engine().begin() as connection:
        # Use an ORM session bound to the same transaction for portability.
        from sqlalchemy.orm import Session

        with Session(bind=connection) as session:
            account = session.scalar(select(Account).where(Account.email == EMAIL))
            if account:
                vendor = session.get(Vendor, account.vendor_id)
                account.password_hash = hash_password(DEMO_PASSWORD)
                account.is_active = True
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
            for name, price, stock in PRODUCTS:
                product = existing.get(name)
                if product:
                    product.price = price
                    product.stock = stock
                    product.status = "active"
                else:
                    session.add(Product(
                        vendor_id=vendor.id,
                        name=name,
                        price=price,
                        stock=stock,
                        image_url="https://images.unsplash.com/photo-1594035910387-fea47794261f",
                        description=f"{name} available from ShopPal Demo Store",
                        status="active",
                    ))
            session.commit()
            print(f"Demo vendor ready: {EMAIL}; vendor_id={vendor.id}; products={len(PRODUCTS)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
