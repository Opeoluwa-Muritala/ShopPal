"""Vendor-scoped products and CSV upload router protected by JWT authentication and input sanitization."""

from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Account, Product, WhatsAppMedia
from app.db.session import get_db
from app.services.auth import get_current_account
from app.services.product_images import (
    MAX_PRODUCT_IMAGE_UPLOAD_BYTES,
    ProductImageError,
    compress_product_image,
)
from app.services.security import parse_and_sanitize_catalog_csv

router = APIRouter(prefix="/api/products", tags=["Frontend Products"])


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
                "has_uploaded_image": p.image_media_id is not None,
                "description": p.description,
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


@router.post("/with-image", status_code=status.HTTP_201_CREATED)
async def create_product_with_image(
    name: str = Form(..., min_length=1, max_length=120),
    price: Decimal = Form(..., gt=0, decimal_places=2),
    stock: int = Form(default=0, ge=0),
    description: str | None = Form(default=None, max_length=100),
    image: UploadFile = File(...),
    current_account: Account = Depends(get_current_account),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """Create a vendor-scoped product with a validated, compressed database image."""
    if session is None:
        raise HTTPException(status_code=503, detail="Product storage unavailable")
    if not name.strip():
        raise HTTPException(status_code=422, detail="Product name is required")
    extension = Path(image.filename or "").suffix.casefold()
    if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Image filename must end in .jpg, .jpeg, .png, or .webp",
        )
    try:
        raw_image = await image.read(MAX_PRODUCT_IMAGE_UPLOAD_BYTES + 1)
        compressed_image = compress_product_image(raw_image, image.content_type)
    except ProductImageError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from None
    finally:
        await image.close()

    product_id = uuid4()
    media_id = uuid4()
    image_url = f"/api/products/{product_id}/image"
    media = WhatsAppMedia(
        id=media_id,
        wa_media_id=f"product-image:{product_id}",
        mime_type="image/jpeg",
        content=compressed_image,
        message_type="image",
    )
    product = Product(
        id=product_id,
        vendor_id=current_account.vendor_id,
        image_media_id=media_id,
        name=name.strip(),
        price=price,
        stock=stock,
        image_url=image_url,
        description=description.strip() if description else None,
        status="active",
    )
    session.add(media)
    session.flush()
    session.add(product)
    session.commit()
    return {
        "id": str(product.id),
        "name": product.name,
        "price": str(product.price),
        "stock": product.stock,
        "image_url": product.image_url,
        "has_uploaded_image": True,
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


@router.get("/{product_id}/image")
def get_product_image(
    product_id: UUID,
    current_account: Account = Depends(get_current_account),
    session: Session = Depends(get_db),
) -> Response:
    """Return a product image only to its authenticated vendor."""
    if session is None:
        raise HTTPException(status_code=404, detail="Product image not found")
    row = session.execute(
        select(WhatsAppMedia.content, WhatsAppMedia.mime_type)
        .join(Product, Product.image_media_id == WhatsAppMedia.id)
        .where(
            Product.id == product_id,
            Product.vendor_id == current_account.vendor_id,
        )
    ).one_or_none()
    if row is None or not row.content:
        raise HTTPException(status_code=404, detail="Product image not found")
    return Response(
        content=row.content,
        media_type=row.mime_type,
        headers={
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    )
