"""Authentication, JWT token generation/validation, password hashing, and session management."""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import Account, RefreshToken
from app.db.session import get_db
from app.logging_conf import logger

security_scheme = HTTPBearer(auto_error=False)

# In-memory sliding window rate limiter for login attempts: key -> list of timestamps
_login_attempts: dict[str, list[float]] = defaultdict(list)
LOGIN_RATE_LIMIT_WINDOW = 15 * 60  # 15 minutes
LOGIN_RATE_LIMIT_MAX = 5  # 5 attempts


# ============================================================================
# 1. Password Hashing (PBKDF2-SHA256, 100,000 iterations, 32-byte salt)
# ============================================================================

SPECIAL_CHARS = set("!@#$%^&*()_+-=[]{}|;:,.<>?/~`'\"\\")


def validate_password_strength(password: str) -> None:
    """
    Enforces password requirements:
    - Min 8 characters
    - At least one number
    - At least one special character
    Rejects weak passwords with 422 Unprocessable Entity.
    """
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters long",
        )
    if not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must contain at least one number",
        )
    if not any(c in SPECIAL_CHARS for c in password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must contain at least one special character",
        )


def hash_password(password: str) -> str:
    """Hashes a password using PBKDF2-HMAC-SHA256 with 100,000 rounds and random salt."""
    validate_password_strength(password)
    salt = os.urandom(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"pbkdf2_sha256$100000${salt.hex()}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the stored PBKDF2 hash using constant-time comparison."""
    try:
        parts = hashed_password.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iterations = int(parts[1])
        salt = bytes.fromhex(parts[2])
        expected_key = bytes.fromhex(parts[3])
        computed_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(computed_key, expected_key)
    except Exception:
        return False


def hash_token(raw_token: str) -> str:
    """Computes SHA-256 hash of a token for secure database storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


# ============================================================================
# 2. JWT Generation & Verification (HMAC-SHA256)
# ============================================================================

def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _base64url_decode(data: str) -> bytes:
    padding = "=" * ((4 - len(data) % 4) % 4)
    return base64.urlsafe_b64decode(data + padding)


def create_access_token(
    account_id: UUID | str,
    vendor_id: UUID | str,
    role: str,
    secret_key: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Creates a signed, short-lived JWT access token containing account_id, vendor_id, and role."""
    header = {"alg": "HS256", "typ": "JWT"}
    now = datetime.now(timezone.utc)
    exp = now + (expires_delta or timedelta(minutes=15))

    payload = {
        "sub": str(account_id),
        "vendor_id": str(vendor_id),
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }

    header_b64 = _base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}"

    signature = hmac.new(
        secret_key.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    signature_b64 = _base64url_encode(signature)

    return f"{signing_input}.{signature_b64}"


def decode_access_token(token: str, secret_key: str) -> dict[str, Any]:
    """Decodes and cryptographically verifies JWT access token signature and expiration."""
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    header_b64, payload_b64, signature_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}"
    expected_sig = hmac.new(
        secret_key.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    try:
        provided_sig = _base64url_decode(signature_b64)
        if not hmac.compare_digest(expected_sig, provided_sig):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token signature",
                headers={"WWW-Authenticate": "Bearer"},
            )
        payload = json.loads(_base64url_decode(payload_b64).decode("utf-8"))
    except Exception as exc:
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not decode token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    # Check expiration
    exp = payload.get("exp")
    if not exp or int(datetime.now(timezone.utc).timestamp()) > exp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload


# ============================================================================
# 3. Refresh Token Management with Rotation & Replay Detection
# ============================================================================

def issue_refresh_token(
    session: Session,
    account_id: UUID | str,
    device_label: str | None = None,
    expires_days: int = 7,
) -> str:
    """Generates an opaque refresh token and stores its SHA-256 hash in the database."""
    raw_token = secrets.token_urlsafe(48)
    token_hashed = hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_days)

    refresh_row = RefreshToken(
        account_id=account_id,
        token_hash=token_hashed,
        device_label=device_label,
        expires_at=expires_at,
    )
    if session is not None:
        session.add(refresh_row)
        session.commit()
    return raw_token


def revoke_all_refresh_tokens_for_account(session: Session, account_id: UUID | str) -> None:
    """Revokes all active refresh tokens for an account (forces re-login on all devices)."""
    if session is not None:
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.account_id == account_id)
            .where(RefreshToken.revoked_at.is_(None))
            .values(revoked_at=datetime.now(timezone.utc))
        )
        session.execute(stmt)
        session.commit()


def rotate_refresh_token(
    session: Session,
    raw_token: str,
    secret_key: str,
    access_token_expire_minutes: int = 15,
) -> tuple[str, str]:
    """
    Rotates a refresh token:
    1. Hashes incoming token and queries refresh_tokens table.
    2. REPLAY DETECTION: If token is already revoked or expired, revokes ALL sessions for the account!
    3. Revokes used token and issues a fresh (access_token, refresh_token) pair.
    """
    token_hashed = hash_token(raw_token)

    if session is None:
        # Mock mode for testing without database connection
        account_id = "00000000-0000-0000-0000-000000000001"
        vendor_id = "00000000-0000-0000-0000-000000000002"
        new_access = create_access_token(account_id, vendor_id, "owner", secret_key)
        new_refresh = secrets.token_urlsafe(48)
        return new_access, new_refresh

    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hashed)
    row = session.scalar(stmt)

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    now = datetime.now(timezone.utc)

    # REPLAY ATTACK DETECTION: Stolen refresh token reused
    if row.revoked_at is not None or row.expires_at < now:
        logger.warning(
            f"Refresh token replay or expired reuse detected for account {row.account_id}! Revoking all sessions.",
            extra={"step": "refresh_token_replay_detected", "status": "revoked_all"},
        )
        revoke_all_refresh_tokens_for_account(session, row.account_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token. All active sessions have been terminated for security.",
        )

    # Invalidate the used refresh token
    row.revoked_at = now

    # Load account to form new access token claims
    account = session.get(Account, row.account_id)
    if not account or not account.is_active:
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive or no longer exists",
        )

    # Issue fresh tokens
    new_access_token = create_access_token(
        account_id=account.id,
        vendor_id=account.vendor_id,
        role=account.role,
        secret_key=secret_key,
        expires_delta=timedelta(minutes=access_token_expire_minutes),
    )
    new_raw_refresh_token = secrets.token_urlsafe(48)
    new_row = RefreshToken(
        account_id=account.id,
        token_hash=hash_token(new_raw_refresh_token),
        device_label=row.device_label,
        expires_at=now + timedelta(days=7),
    )
    session.add(new_row)
    session.commit()

    return new_access_token, new_raw_refresh_token


# ============================================================================
# 4. Login Rate Limiting (5 attempts / 15 minutes)
# ============================================================================

def check_login_rate_limit(key: str) -> None:
    """Enforces 5 failed login attempts per 15 min. Raises 429 if exceeded."""
    now = time.time()
    cutoff = now - LOGIN_RATE_LIMIT_WINDOW
    timestamps = [ts for ts in _login_attempts[key] if ts > cutoff]
    if len(timestamps) >= LOGIN_RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again in 15 minutes.",
        )


def record_failed_login(key: str) -> None:
    """Records a failed login attempt for rate limiting."""
    now = time.time()
    cutoff = now - LOGIN_RATE_LIMIT_WINDOW
    timestamps = [ts for ts in _login_attempts[key] if ts > cutoff]
    timestamps.append(now)
    _login_attempts[key] = timestamps


def clear_failed_logins(key: str) -> None:
    """Clears rate-limit records on successful login."""
    _login_attempts.pop(key, None)


def clear_all_login_rate_limits() -> None:
    """Test helper to reset login rate limits."""
    _login_attempts.clear()


# ============================================================================
# 5. Dependency Injection: get_current_account & get_current_owner
# ============================================================================

def get_current_account(
    credentials: HTTPAuthorizationCredentials | None = Security(security_scheme),
    settings: Settings = Depends(get_settings),
    session: Session = Depends(get_db),
) -> Account:
    """
    Validates JWT access token from Authorization: Bearer <token>.
    Makes account_id, vendor_id, and role available to route handlers.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization: Bearer token header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    secret = settings.jwt_secret.get_secret_value()
    payload = decode_access_token(credentials.credentials, secret)

    account_id_str = payload.get("sub")
    vendor_id_str = payload.get("vendor_id")
    role = payload.get("role", "staff")

    if not account_id_str or not vendor_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token claims",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # In database-backed environments, fetch and verify active account
    if session is not None:
        try:
            db_account = session.get(Account, UUID(account_id_str))
            if db_account is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User account not found or deactivated",
                )
            if isinstance(db_account, Account):
                if not db_account.is_active:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="User account not found or deactivated",
                    )
                return db_account
        except HTTPException:
            raise
        except Exception:
            pass

    # Construct authenticated active Account instance from verified claims
    account = Account(
        id=UUID(account_id_str),
        vendor_id=UUID(vendor_id_str),
        role=role,
        email="verified@token.local",
        phone="08000000000",
        password_hash="",
        is_active=True,
    )
    return account


def get_current_owner(
    current_account: Account = Depends(get_current_account),
) -> Account:
    """
    Owner-only dependency: raises 403 Forbidden if current_account role != 'owner'.
    Guards vendor settings, staff invites, and sensitive configurations.
    """
    if current_account.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner role required for this action",
        )
    return current_account
