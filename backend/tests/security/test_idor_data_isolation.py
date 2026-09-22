"""Tests verifying vendor data isolation and IDOR defenses via JWT Bearer authentication."""

from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient

from app.config import get_settings
from app.db.models import Order
from app.db.session import get_db
from app.main import app
from app.services.auth import create_access_token


def test_missing_auth_token_returns_401():
    """Verify vendor-scoped routes reject requests missing Authorization: Bearer token."""
    client = TestClient(app, raise_server_exceptions=False)
    vendor_id = uuid4()
    response = client.get(f"/api/orders?vendor_id={vendor_id}")
    assert response.status_code == 401
    assert "Missing Authorization: Bearer token" in response.json()["detail"]


def test_cross_vendor_idor_attack_cannot_read_other_vendor_data():
    """
    IDOR ATTACK TEST:
    Vendor A attempts to view Vendor B's orders.
    Even if Vendor A sends ?vendor_id=<vendor_b_id>, the route strictly derives
    vendor_id from Vendor A's authenticated JWT token.
    Vendor B's data is never exposed.
    """
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        settings = get_settings()
        secret = settings.jwt_secret.get_secret_value()

        account_a_id = uuid4()
        vendor_a_id = uuid4()
        vendor_b_id = uuid4()

        # Token belongs to Vendor A
        token_a = create_access_token(account_a_id, vendor_a_id, "owner", secret)

        # Mock database returning orders strictly filtered by vendor_a_id
        mock_order_a = Order(
            id=uuid4(),
            order_code="ORD-A1",
            vendor_id=vendor_a_id,
            customer_phone="08011111111",
            total=5000,
            status="new",
            payment_status="paid",
            items=[],
        )
        mock_db.scalars.return_value.all.return_value = [mock_order_a]

        # Vendor A sends request maliciously asking for vendor_b_id in query
        response = client.get(
            f"/api/orders?vendor_id={vendor_b_id}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert response.status_code == 200
        data = response.json()
        # Scope is strictly Vendor A's ID
        assert data["vendor_id"] == str(vendor_a_id)
        assert data["vendor_id"] != str(vendor_b_id)
    finally:
        app.dependency_overrides.clear()


def test_cross_vendor_idor_attack_returns_403_on_modification():
    """
    IDOR MUTATION TEST:
    Vendor A attempts to modify an order belonging to Vendor B.
    Must return 403 Forbidden.
    """
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        settings = get_settings()
        secret = settings.jwt_secret.get_secret_value()

        account_a_id = uuid4()
        vendor_a_id = uuid4()
        vendor_b_id = uuid4()
        order_b_id = uuid4()

        # Order belongs to Vendor B
        order_b = Order(
            id=order_b_id,
            order_code="ORD-B1",
            vendor_id=vendor_b_id,
            status="new",
            total=10000,
        )
        mock_db.get.return_value = order_b

        # Attacker A attempts to modify Order B
        token_a = create_access_token(account_a_id, vendor_a_id, "owner", secret)
        response = client.patch(
            f"/api/orders/{order_b_id}",
            json={"status": "delivered"},
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert response.status_code == 403
        assert "you cannot modify orders belonging to another vendor" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_authorized_vendor_can_access_own_resource():
    """Verify authenticated vendor token permits access to own resources."""
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        settings = get_settings()
        secret = settings.jwt_secret.get_secret_value()

        account_id = uuid4()
        vendor_id = uuid4()
        token = create_access_token(account_id, vendor_id, "owner", secret)

        mock_db.scalars.return_value.all.return_value = []

        response = client.get(
            "/api/orders",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["vendor_id"] == str(vendor_id)
    finally:
        app.dependency_overrides.clear()
