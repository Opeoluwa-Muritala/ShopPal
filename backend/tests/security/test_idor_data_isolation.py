"""Tests verifying vendor data isolation and IDOR defenses via X-Vendor-API-Key."""

from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient

from app.db.models import Vendor
from app.db.session import get_db
from app.main import app


def test_missing_api_key_returns_403():
    """Verify vendor-scoped routes reject requests missing X-Vendor-API-Key."""
    client = TestClient(app, raise_server_exceptions=False)
    vendor_id = uuid4()
    response = client.get(f"/api/orders?vendor_id={vendor_id}")
    assert response.status_code == 403
    assert "Missing required X-Vendor-API-Key" in response.json()["detail"]


def test_cross_vendor_idor_attack_returns_403():
    """
    IDOR ATTACK TEST:
    Vendor A attempts to view or modify Vendor B's orders using Vendor A's API key.
    Must return 403 Forbidden.
    """
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        vendor_a_id = uuid4()
        vendor_b_id = uuid4()

        vendor_b = Vendor(
            id=vendor_b_id,
            name="Vendor B",
            phone="08022223333",
            whatsapp_number="08022223333",
        )
        setattr(vendor_b, "api_key", "vendor_b_secret_key_999")

        # Mock database returning Vendor B
        mock_db.scalar.return_value = vendor_b
        mock_db.scalars.return_value.all.return_value = []

        # Attacker sends Vendor A's key against Vendor B's ID
        response = client.get(
            f"/api/orders?vendor_id={vendor_b_id}",
            headers={"X-Vendor-API-Key": "vendor_a_stolen_key_111"},
        )
        assert response.status_code == 403
        assert "Invalid API key for requested vendor" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


def test_authorized_vendor_can_access_own_resource():
    """Verify matching vendor key permits access."""
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        vendor_id = uuid4()
        vendor = Vendor(
            id=vendor_id,
            name="Vendor Authorized",
            phone="08033334444",
            whatsapp_number="08033334444",
        )
        setattr(vendor, "api_key", "valid_vendor_key_abc")

        mock_db.scalar.return_value = vendor
        mock_db.scalars.return_value.all.return_value = []

        response = client.get(
            f"/api/orders?vendor_id={vendor_id}",
            headers={"X-Vendor-API-Key": "valid_vendor_key_abc"},
        )
        assert response.status_code == 200
        assert response.json()["vendor_id"] == str(vendor_id)
    finally:
        app.dependency_overrides.clear()
