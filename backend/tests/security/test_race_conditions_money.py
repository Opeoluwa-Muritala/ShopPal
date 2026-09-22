"""Tests verifying atomic stock decrement, double-checkout prevention, and money precision."""

from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.config import get_settings
from app.db.models import Cart, Product
from app.db.session import get_db
from app.main import app
from app.services.auth import create_access_token
from app.services.orders import (
    calculate_and_verify_item,
    create_order_from_cart,
    decrement_stock_atomic,
)


def test_atomic_stock_decrement_rejects_insufficient_stock():
    """Verify decrement_stock_atomic raises 409 when rowcount is 0 (stock < qty)."""
    mock_session = MagicMock()
    mock_result = MagicMock()
    mock_result.rowcount = 0  # Atomic conditional update affected 0 rows
    mock_session.execute.return_value = mock_result

    with pytest.raises(HTTPException) as exc:
        decrement_stock_atomic(mock_session, uuid4(), quantity=1)
    assert exc.value.status_code == 409
    assert "Insufficient stock" in exc.value.detail


def test_double_checkout_on_same_cart_raises_409():
    """Verify customer sending checkout twice cannot generate multiple orders from the same cart."""
    mock_session = MagicMock()
    vendor_id = uuid4()
    phone = "08012345678"

    # Mock an existing cart that has already been checked out
    checked_out_cart = Cart(
        vendor_id=vendor_id,
        customer_phone=phone,
        state="checked_out",
    )
    mock_session.scalar.return_value = checked_out_cart

    with pytest.raises(HTTPException) as exc:
        create_order_from_cart(
            session=mock_session,
            vendor_id=vendor_id,
            customer_phone=phone,
            delivery_address="Lagos, Nigeria",
            item_requests=[{"product_id": str(uuid4()), "qty": 1}],
        )
    assert exc.value.status_code == 409
    assert "Cart has already been checked out" in exc.value.detail


def test_negative_or_zero_quantity_rejected_with_422():
    """Verify zero or negative quantity is strictly rejected with 422."""
    mock_session = MagicMock()
    product_id = uuid4()

    for invalid_qty in (0, -1, -10):
        with pytest.raises(HTTPException) as exc:
            calculate_and_verify_item(mock_session, product_id, quantity=invalid_qty)
        assert exc.value.status_code == 422


def test_negative_or_zero_product_price_rejected_with_422():
    """Verify creating a product with negative or zero price is rejected by schema with 422."""
    client = TestClient(app, raise_server_exceptions=False)
    vendor_id = uuid4()
    settings = get_settings()
    secret = settings.jwt_secret.get_secret_value()
    token = create_access_token(uuid4(), vendor_id, "owner", secret)

    for bad_price in ("0.00", "-50.00", "-0.01"):
        response = client.post(
            "/api/products",
            json={
                "name": "Invalid Price Item",
                "price": bad_price,
                "stock": 10,
                "image_url": "https://example.com/item.png",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422


def test_currency_calculations_use_strict_decimal_without_float_drift():
    """Verify financial calculations avoid IEEE-754 binary floating-point drift (e.g. 0.1 + 0.2 != 0.3)."""
    mock_session = MagicMock()
    prod_id = uuid4()

    # Product priced at 19999.99
    product = Product(
        id=prod_id,
        name="Lekki Lace",
        price=Decimal("19999.99"),
        stock=100,
        status="active",
        image_url="https://example.com/lace.png",
    )
    mock_session.get.return_value = product

    # Buy 3 units: 19999.99 * 3 = 59999.97 exactly
    _, item_total = calculate_and_verify_item(mock_session, prod_id, quantity=3)
    assert item_total == Decimal("59999.97")
    assert isinstance(item_total, Decimal)
