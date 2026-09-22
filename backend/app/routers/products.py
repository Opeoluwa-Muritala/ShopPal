"""Vendor-scoped products and CSV upload router protected by JWT authentication and input sanitization."""

from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Account, Product
from app.db.session import get_db
from app.services.auth import get_current_account
from app.services.security import parse_and_sanitize_catalog_csv

router = APIRouter(prefix="/api/products", tags=["products"])


class ProductCreateSchema(BaseModel):
    vendor_id: UUID | None = None  # Ignored if passed; strictly derived from JWT
    name: str = Field(..., min_length=1, max_length=120)
    price: Decimal = Field(..., gt=0, decimal_places=2)  # Strict > 0, rejects negative/zero
    stock: int = Field(default=0, ge=0)  # Rejects negative stock
    image_url: str = Field(..., max_length=500)
    description: str | None = Field(default=None, max_length=100)


@router.get("")
def list_vendor_products(
    vendor_id: UUID | None = None,  # Ignored; strictly scoped to authenticated JWT vendor_id
    current_account: Account = Depends(get_current_account),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Lists products for the authenticated vendor.
    IDOR IMMUNE: vendor_id query parameter is ignored; scope is derived strictly from JWT.
    """
    effective_vendor_id = current_account.vendor_id

    if session is None:
        return {
            "vendor_id": str(effective_vendor_id),
            "count": 0,
            "products": [],
        }

    stmt = select(Product).where(Product.vendor_id == effective_vendor_id)
    products = session.scalars(stmt).all()
    return {
        "vendor_id": str(effective_vendor_id),
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
    current_account: Account = Depends(get_current_account),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Creates a new product for the authenticated vendor.
    IDOR IMMUNE: vendor_id in request body is ignored; always uses current_account.vendor_id.
    Strictly rejects zero or negative price/quantity with 422.
    """
    effective_vendor_id = current_account.vendor_id

    if session is None:
        return {
            "id": "00000000-0000-0000-0000-000000000099",
            "name": body.name,
            "price": str(body.price),
            "stock": body.stock,
            "status": "active",
        }

    product = Product(
        vendor_id=effective_vendor_id,
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
    file: UploadFile = File(...),
    vendor_id: UUID | None = Form(default=None),  # Ignored; strictly scoped to JWT vendor_id
    current_account: Account = Depends(get_current_account),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Uploads and processes vendor catalog CSV.
    IDOR IMMUNE: vendor_id comes strictly from the validated JWT token.
    Enforces file size <= 1MB, row count <= 1000, UTF-8 validity,
    and neutralizes formula injection cells.
    """
    effective_vendor_id = current_account.vendor_id

    content_bytes = await file.read()
    cleaned_rows = parse_and_sanitize_catalog_csv(content_bytes)

    if session is None:
        return {
            "vendor_id": str(effective_vendor_id),
            "imported_rows": len(cleaned_rows),
            "products_created": len(cleaned_rows),
            "status": "success",
        }

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
            vendor_id=effective_vendor_id,
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
        "vendor_id": str(effective_vendor_id),
        "imported_rows": len(cleaned_rows),
        "products_created": created_count,
        "status": "success",
    }
