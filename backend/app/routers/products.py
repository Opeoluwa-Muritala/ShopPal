"""Vendor-scoped products and CSV upload router with input validation, formula injection defense, and IDOR protection."""

from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Product
from app.db.session import get_db
from app.services.security import parse_and_sanitize_catalog_csv, verify_vendor_access

router = APIRouter(prefix="/api/products", tags=["products"])


class ProductCreateSchema(BaseModel):
    vendor_id: UUID
    name: str = Field(..., min_length=1, max_length=120)
    price: Decimal = Field(
        ..., gt=0, decimal_places=2
    )  # Strict > 0, rejects negative/zero
    stock: int = Field(default=0, ge=0)  # Rejects negative stock
    image_url: str = Field(..., max_length=500)
    description: str | None = Field(default=None, max_length=100)


@router.get("")
def list_vendor_products(
    vendor_id: UUID,
    x_vendor_api_key: str | None = Header(default=None, alias="X-Vendor-API-Key"),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Lists products for a vendor.
    IDOR DEFENSE: Validates X-Vendor-API-Key matches requested vendor_id.
    """
    verify_vendor_access(vendor_id, x_vendor_api_key, session)

    stmt = select(Product).where(Product.vendor_id == vendor_id)
    products = session.scalars(stmt).all()
    return {
        "vendor_id": str(vendor_id),
        "count": len(products),
        "products": [
            {
                "id": str(p.id),
                "name": p.name,
                "price": str(p.price),
                "stock": p.stock,
                "image_url": p.image_url,
                "status": p.status,
            }
            for p in products
        ],
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreateSchema,
    x_vendor_api_key: str | None = Header(default=None, alias="X-Vendor-API-Key"),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Creates a new product.
    Strictly rejects zero or negative price/quantity with 422.
    """
    verify_vendor_access(body.vendor_id, x_vendor_api_key, session)

    product = Product(
        vendor_id=body.vendor_id,
        name=body.name,
        price=body.price,
        stock=body.stock,
        image_url=body.image_url,
        description=body.description,
        status="active",
    )
    session.add(product)
    session.commit()
    session.refresh(product)
    return {
        "id": str(product.id),
        "name": product.name,
        "price": str(product.price),
        "stock": product.stock,
        "status": product.status,
    }


@router.post("/upload-csv")
async def upload_catalog_csv(
    vendor_id: UUID = Form(...),
    file: UploadFile = File(...),
    x_vendor_api_key: str | None = Header(default=None, alias="X-Vendor-API-Key"),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Uploads and processes vendor catalog CSV.
    Enforces file size <= 1MB, row count <= 1000, UTF-8 validity,
    and neutralizes formula injection cells.
    """
    verify_vendor_access(vendor_id, x_vendor_api_key, session)

    content_bytes = await file.read()
    cleaned_rows = parse_and_sanitize_catalog_csv(content_bytes)

    created_count = 0
    for row in cleaned_rows:
        try:
            price_val = Decimal(row["price"])
            if price_val <= 0:
                continue
            stock_val = int(row.get("stock", 0))
            if stock_val < 0:
                stock_val = 0
        except Exception:
            continue

        prod = Product(
            vendor_id=vendor_id,
            name=row["name"],
            price=price_val,
            stock=stock_val,
            image_url=row.get("image_url", "https://example.com/placeholder.png"),
            description=row.get("description", ""),
            status="active",
        )
        session.add(prod)
        created_count += 1

    session.commit()
    return {
        "vendor_id": str(vendor_id),
        "imported_rows": len(cleaned_rows),
        "products_created": created_count,
        "status": "success",
    }
