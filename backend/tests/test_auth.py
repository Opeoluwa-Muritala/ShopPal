"""Stage 6 Test Suite: Real Auth & Account Structure.

Verifies:
1. Vendor signup creates both vendor and owner account rows.
2. Login with valid credentials returns access + refresh tokens.
3. Login with wrong password fails (401) with generic message (no user-enumeration).
4. Login rate limiting triggers after 5 failed attempts (429).
5. Access token expires and is rejected.
6. Refresh token rotation works — old token invalidated, new token valid.
7. Replay attack detected — using an already-used refresh token revokes all tokens for that account.
8. IDOR impossible — staff/owner of vendor A cannot access vendor B's orders or products even if they try; vendor_id in URL/body is ignored or rejected.
9. Staff role cannot invite other staff (403).
10. Password reset flow: forgot-password -> reset-password -> old password rejected, all sessions invalidated.
"""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.config import get_settings
from app.db.models import (
    Account,
    Order,
    PasswordResetToken,
    Product,
    RefreshToken,
    Vendor,
)
from app.db.session import get_db
from app.main import app
from app.services.auth import (
    clear_all_login_rate_limits,
    create_access_token,
    decode_access_token,
    hash_password,
    hash_token,
    validate_password_strength,
    verify_password,
)


@pytest.fixture(autouse=True)
def reset_rate_limits():
    """Clear in-memory login rate limits before and after every test."""
    clear_all_login_rate_limits()
    yield
    clear_all_login_rate_limits()


# ============================================================================
# 1. Vendor Signup Creates Vendor & Owner Account Rows
# ============================================================================

def test_vendor_signup_creates_vendor_and_owner_account():
    """Verify signup registers vendor and automatically links an owner account with hashed password."""
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        # Mock non-existing email and phone
        mock_db.scalar.return_value = None

        signup_payload = {
            "name": "Ifeoma Stores",
            "phone": "08011223344",
            "whatsapp_number": "08011223344",
            "business_name": "Ifeoma Enterprises",
            "email": "ifeoma@market.ng",
            "password": "StrongPassword99!",
            "preferred_language": "pidgin",
        }

        response = client.post("/api/vendors/signup", json=signup_payload)
        assert response.status_code == 201
        data = response.json()

        assert data["role"] == "owner"
        assert data["email"] == "ifeoma@market.ng"
        assert data["status"] == "active"
        assert "password" not in data
        assert "password_hash" not in data

        # Verify DB calls
        assert mock_db.add.call_count >= 2
        added_instances = [call.args[0] for call in mock_db.add.call_args_list]
        vendor_created = next(i for i in added_instances if isinstance(i, Vendor))
        account_created = next(i for i in added_instances if isinstance(i, Account))

        assert vendor_created.name == "Ifeoma Stores"
        assert account_created.role == "owner"
        assert account_created.email == "ifeoma@market.ng"
        assert verify_password("StrongPassword99!", account_created.password_hash)
    finally:
        app.dependency_overrides.clear()


def test_password_strength_validation_rejects_weak_passwords():
    """Verify passwords <8 chars, missing numbers, or missing special chars raise 422."""
    weak_passwords = [
        "short1!",        # < 8 chars
        "onlyletters!",   # no digits
        "onlyletters123", # no special char
    ]
    for weak in weak_passwords:
        with pytest.raises(HTTPException) as exc_info:
            validate_password_strength(weak)
        assert exc_info.value.status_code == 422


# ============================================================================
# 2. Login with Valid Credentials Returns Access + Refresh Tokens
# ============================================================================

def test_login_valid_credentials_returns_tokens():
    """Verify valid email + password updates last_login_at and returns tokens."""
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        account_id = uuid4()
        vendor_id = uuid4()
        pw_hash = hash_password("CorrectPass123#")

        mock_account = Account(
            id=account_id,
            vendor_id=vendor_id,
            email="owner@test.ng",
            phone="08022334455",
            password_hash=pw_hash,
            role="owner",
            is_active=True,
        )
        mock_db.scalar.return_value = mock_account

        response = client.post(
            "/api/auth/login",
            json={"email": "owner@test.ng", "password": "CorrectPass123#"},
        )
        assert response.status_code == 200
        data = response.json()

        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

        # Verify access token payload
        settings = get_settings()
        secret = settings.jwt_secret.get_secret_value()
        claims = decode_access_token(data["access_token"], secret)
        assert claims["sub"] == str(account_id)
        assert claims["vendor_id"] == str(vendor_id)
        assert claims["role"] == "owner"

        # Verify last_login_at was updated
        assert mock_account.last_login_at is not None
    finally:
        app.dependency_overrides.clear()


# ============================================================================
# 3. Login with Wrong Password Fails (401) with Generic Error (No Enumeration)
# ============================================================================

def test_login_wrong_password_returns_generic_401():
    """Verify non-existent user and bad password return identical generic error messages."""
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        pw_hash = hash_password("RealPass123$")
        mock_account = Account(
            id=uuid4(),
            vendor_id=uuid4(),
            email="known@user.ng",
            phone="08012345678",
            password_hash=pw_hash,
            role="owner",
            is_active=True,
        )

        # 1. Non-existent account
        mock_db.scalar.return_value = None
        resp_unknown = client.post(
            "/api/auth/login",
            json={"email": "unknown@user.ng", "password": "AnyPassword123!"},
        )
        assert resp_unknown.status_code == 401
        assert resp_unknown.json()["detail"] == "Invalid email or password"

        # 2. Existent account with wrong password
        mock_db.scalar.return_value = mock_account
        resp_wrong_pw = client.post(
            "/api/auth/login",
            json={"email": "known@user.ng", "password": "WrongPassword123!"},
        )
        assert resp_wrong_pw.status_code == 401
        assert resp_wrong_pw.json()["detail"] == "Invalid email or password"
    finally:
        app.dependency_overrides.clear()


# ============================================================================
# 4. Login Rate Limiting (5 failed attempts -> 429)
# ============================================================================

def test_login_rate_limiting_triggers_after_5_failed_attempts():
    """Verify 6th failed attempt from same client is blocked with 429 Too Many Requests."""
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        mock_db.scalar.return_value = None  # Always invalid

        # Attempts 1 to 5: Return 401
        for _ in range(5):
            res = client.post(
                "/api/auth/login",
                json={"email": "bruteforce@target.com", "password": "WrongPass123!"},
            )
            assert res.status_code == 401

        # 6th attempt: Blocked by rate limiter with 429
        blocked_res = client.post(
            "/api/auth/login",
            json={"email": "bruteforce@target.com", "password": "WrongPass123!"},
        )
        assert blocked_res.status_code == 429
        assert "Too many login attempts" in blocked_res.json()["detail"]
    finally:
        app.dependency_overrides.clear()


# ============================================================================
# 5. Access Token Expiration
# ============================================================================

def test_access_token_expires_and_is_rejected():
    """Verify expired JWT tokens are rejected with 401 Unauthorized."""
    settings = get_settings()
    secret = settings.jwt_secret.get_secret_value()

    # Generate token expired 5 minutes ago
    expired_token = create_access_token(
        account_id=uuid4(),
        vendor_id=uuid4(),
        role="owner",
        secret_key=secret,
        expires_delta=timedelta(minutes=-5),
    )

    client = TestClient(app, raise_server_exceptions=False)
    res = client.get("/api/orders", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    assert "Access token has expired" in res.json()["detail"]


# ============================================================================
# 6. Refresh Token Rotation (Old invalidated, new issued)
# ============================================================================

def test_refresh_token_rotation():
    """Verify refresh token endpoint revokes presented token and issues a new pair."""
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        account_id = uuid4()
        vendor_id = uuid4()
        raw_refresh = "valid_initial_refresh_token_1234567890"
        hashed = hash_token(raw_refresh)

        refresh_row = RefreshToken(
            id=uuid4(),
            account_id=account_id,
            token_hash=hashed,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            revoked_at=None,
        )
        mock_account = Account(
            id=account_id,
            vendor_id=vendor_id,
            role="owner",
            is_active=True,
        )

        mock_db.scalar.return_value = refresh_row
        mock_db.get.return_value = mock_account

        res = client.post("/api/auth/refresh", json={"refresh_token": raw_refresh})
        assert res.status_code == 200
        data = res.json()

        assert "access_token" in data
        assert "refresh_token" in data
        assert data["refresh_token"] != raw_refresh

        # Verify old token row was marked revoked
        assert refresh_row.revoked_at is not None

        # Verify new token row was added
        added_items = [call.args[0] for call in mock_db.add.call_args_list]
        new_token_row = next(i for i in added_items if isinstance(i, RefreshToken))
        assert new_token_row.account_id == account_id
    finally:
        app.dependency_overrides.clear()


# ============================================================================
# 7. Replay Attack Detected -> Revokes All Sessions
# ============================================================================

def test_refresh_token_replay_revokes_all_account_sessions():
    """Verify presenting an already revoked refresh token triggers replay mitigation."""
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        account_id = uuid4()
        stolen_raw_token = "stolen_compromised_token_xyz"
        hashed = hash_token(stolen_raw_token)

        # Token was ALREADY revoked in past
        already_revoked_row = RefreshToken(
            id=uuid4(),
            account_id=account_id,
            token_hash=hashed,
            expires_at=datetime.now(timezone.utc) + timedelta(days=5),
            revoked_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        mock_db.scalar.return_value = already_revoked_row

        res = client.post("/api/auth/refresh", json={"refresh_token": stolen_raw_token})
        assert res.status_code == 401
        assert "All active sessions have been terminated" in res.json()["detail"]

        # Verify session revocation execution was issued against DB
        assert mock_db.execute.called
    finally:
        app.dependency_overrides.clear()


# ============================================================================
# 8. IDOR Impossible — Cross-Vendor Access Blocked
# ============================================================================

def test_idor_impossible_vendor_id_in_url_or_body_ignored():
    """
    Verify authenticated Account A cannot view or modify Vendor B data.
    vendor_id in query params and request bodies is overridden with authenticated token.
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

        token_a = create_access_token(account_a_id, vendor_a_id, "owner", secret)

        # 1. GET /api/products: Attacker requests Vendor B products via query param
        mock_db.scalars.return_value.all.return_value = []
        res_list = client.get(
            f"/api/products?vendor_id={vendor_b_id}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert res_list.status_code == 200
        # Confirms server responded scoped exclusively to Vendor A
        assert res_list.json()["vendor_id"] == str(vendor_a_id)

        # 2. POST /api/products: Attacker attempts to create product under Vendor B
        res_create = client.post(
            "/api/products",
            json={
                "vendor_id": str(vendor_b_id),  # Maliciously targeting Vendor B
                "name": "Luxury Silk",
                "price": 15000.00,
                "stock": 10,
                "image_url": "https://example.com/silk.jpg",
            },
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert res_create.status_code == 201

        # Inspect product added to DB: must belong to vendor_a_id
        added_products = [call.args[0] for call in mock_db.add.call_args_list if isinstance(call.args[0], Product)]
        created_prod = added_products[-1]
        assert created_prod.vendor_id == vendor_a_id
        assert created_prod.vendor_id != vendor_b_id

        # 3. PATCH /api/orders/{id}: Attacker attempts to update an order belonging to Vendor B
        order_b_id = uuid4()
        mock_order_b = Order(
            id=order_b_id,
            vendor_id=vendor_b_id,
            order_code="ORD-VEND-B",
            status="new",
        )
        mock_db.get.return_value = mock_order_b

        res_patch = client.patch(
            f"/api/orders/{order_b_id}",
            json={"status": "delivered"},
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert res_patch.status_code == 403
        assert "you cannot modify orders belonging to another vendor" in res_patch.json()["detail"]
    finally:
        app.dependency_overrides.clear()


# ============================================================================
# 9. Role-Based Access: Staff Role Cannot Invite Staff (403)
# ============================================================================

def test_staff_role_cannot_invite_staff():
    """Verify staff role receives 403 Forbidden on owner-only /api/accounts/invite-staff."""
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        settings = get_settings()
        secret = settings.jwt_secret.get_secret_value()

        # 1. Staff token attempt
        staff_token = create_access_token(uuid4(), uuid4(), "staff", secret)
        invite_payload = {
            "email": "newbie@staff.com",
            "phone": "08099887766",
            "temp_password": "TempStaffPassword1!",
        }

        res_forbidden = client.post(
            "/api/accounts/invite-staff",
            json=invite_payload,
            headers={"Authorization": f"Bearer {staff_token}"},
        )
        assert res_forbidden.status_code == 403
        assert "Owner role required" in res_forbidden.json()["detail"]

        # 2. Owner token attempt: succeeds (201 Created)
        mock_db.scalar.return_value = None  # Email not already taken
        owner_token = create_access_token(uuid4(), uuid4(), "owner", secret)

        res_allowed = client.post(
            "/api/accounts/invite-staff",
            json=invite_payload,
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert res_allowed.status_code == 201
        data = res_allowed.json()
        assert data["role"] == "staff"
        assert data["email"] == "newbie@staff.com"
    finally:
        app.dependency_overrides.clear()


# ============================================================================
# 10. Password Reset Flow
# ============================================================================

def test_password_reset_flow():
    """
    Verify complete forgot-password -> reset-password flow:
    - Generates 1-hour token and logs link.
    - Resets password, revokes all active sessions, and marks token used.
    - Reusing reset token fails.
    """
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    client = TestClient(app, raise_server_exceptions=False)

    try:
        account_id = uuid4()
        vendor_id = uuid4()
        initial_pw_hash = hash_password("OldPassword123!")

        mock_account = Account(
            id=account_id,
            vendor_id=vendor_id,
            email="resetuser@market.ng",
            phone="08055667788",
            password_hash=initial_pw_hash,
            role="owner",
            is_active=True,
        )
        mock_db.scalar.return_value = mock_account

        # 1. Forgot password request
        forgot_res = client.post(
            "/api/auth/forgot-password",
            json={"email": "resetuser@market.ng"},
        )
        assert forgot_res.status_code == 200

        # Extract generated reset token row from DB calls
        added_items = [call.args[0] for call in mock_db.add.call_args_list]
        reset_token_row = next(i for i in added_items if isinstance(i, PasswordResetToken))
        assert reset_token_row.account_id == account_id
        assert reset_token_row.used_at is None

        # 2. Reset password using token
        raw_reset_token = "mock_valid_reset_token_abc123"
        reset_token_row.token_hash = hash_token(raw_reset_token)
        mock_db.scalar.return_value = reset_token_row
        mock_db.get.return_value = mock_account

        reset_res = client.post(
            "/api/auth/reset-password",
            json={
                "token": raw_reset_token,
                "new_password": "NewBrandPassword456$",
            },
        )
        assert reset_res.status_code == 200
        assert "All active sessions have been revoked" in reset_res.json()["message"]

        # Verify password hash changed and verifies new password
        assert verify_password("NewBrandPassword456$", mock_account.password_hash)
        assert not verify_password("OldPassword123!", mock_account.password_hash)

        # Verify token is marked used
        assert reset_token_row.used_at is not None

        # 3. Attempting to reuse already-used token fails with 400
        reuse_res = client.post(
            "/api/auth/reset-password",
            json={
                "token": raw_reset_token,
                "new_password": "AnotherNewPassword789!",
            },
        )
        assert reuse_res.status_code == 400
        assert "Invalid or expired password reset token" in reuse_res.json()["detail"]
    finally:
        app.dependency_overrides.clear()
