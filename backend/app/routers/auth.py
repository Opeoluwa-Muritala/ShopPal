"""Authentication router: login, token refresh, logout, password reset, and forgot password."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import Account, PasswordResetToken, RefreshToken
from app.db.session import get_db
from app.logging_conf import logger
from app.services.auth import (
    check_login_rate_limit,
    clear_failed_logins,
    create_access_token,
    get_current_account,
    hash_password,
    hash_token,
    issue_refresh_token,
    record_failed_login,
    revoke_all_refresh_tokens_for_account,
    rotate_refresh_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["Frontend Auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


@router.post("/login")
def login(
    req: LoginRequest,
    request: Request,
    settings: Settings = Depends(get_settings),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Authenticates account with email and password.
    Enforces rate-limiting (5 attempts / 15 min) and constant-time password verification.
    Returns short-lived access_token (15 min) and revocable refresh_token (7 days).
    """
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"{req.email.lower()}:{client_ip}"

    # Rate limiting: 6th attempt in window returns 429 before touching DB/passwords
    check_login_rate_limit(rate_limit_key)

    if session is None:
        # Mock mode when running without real DB
        if req.password == "correct_password_123":
            clear_failed_logins(rate_limit_key)
            secret = settings.jwt_secret.get_secret_value()
            access = create_access_token("00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002", "owner", secret)
            refresh = secrets.token_urlsafe(48)
            return {
                "access_token": access,
                "refresh_token": refresh,
                "token_type": "bearer",
                "account_id": "00000000-0000-0000-0000-000000000001",
                "vendor_id": "00000000-0000-0000-0000-000000000002",
                "role": "owner",
            }
        else:
            record_failed_login(rate_limit_key)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

    stmt = select(Account).where(Account.email == req.email.lower())
    account = session.scalar(stmt)

    # Constant-time comparison & generic error to prevent account enumeration
    if not account or not account.is_active or not verify_password(req.password, account.password_hash):
        record_failed_login(rate_limit_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Login succeeded
    clear_failed_logins(rate_limit_key)
    account.last_login_at = datetime.now(timezone.utc)
    session.commit()

    secret = settings.jwt_secret.get_secret_value()
    access_token = create_access_token(
        account_id=account.id,
        vendor_id=account.vendor_id,
        role=account.role,
        secret_key=secret,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    device = request.headers.get("user-agent", "unknown")[:120]
    refresh_token = issue_refresh_token(
        session=session,
        account_id=account.id,
        device_label=device,
        expires_days=settings.refresh_token_expire_days,
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "account_id": str(account.id),
        "vendor_id": str(account.vendor_id),
        "role": account.role,
    }


@router.post("/refresh")
def refresh_tokens(
    req: RefreshRequest,
    settings: Settings = Depends(get_settings),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Refreshes access token and rotates refresh token.
    Detects token replay: reusing an invalidated refresh token immediately revokes all sessions!
    """
    secret = settings.jwt_secret.get_secret_value()
    new_access, new_refresh = rotate_refresh_token(
        session=session,
        raw_token=req.refresh_token,
        secret_key=secret,
        access_token_expire_minutes=settings.access_token_expire_minutes,
    )
    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


@router.post("/logout")
def logout(
    req: RefreshRequest,
    session: Session = Depends(get_db),
) -> dict[str, str]:
    """Revokes a specific active refresh token session."""
    if session is not None:
        token_hashed = hash_token(req.refresh_token)
        stmt = (
            update(RefreshToken)
            .where(RefreshToken.token_hash == token_hashed)
            .values(revoked_at=datetime.now(timezone.utc))
        )
        session.execute(stmt)
        session.commit()
    return {"message": "Successfully logged out from session"}


@router.post("/logout-all")
def logout_all(
    current_account: Account = Depends(get_current_account),
    session: Session = Depends(get_db),
) -> dict[str, str]:
    """Revokes all refresh tokens for the authenticated account (log out everywhere)."""
    revoke_all_refresh_tokens_for_account(session, current_account.id)
    return {"message": "Successfully logged out of all active devices"}


@router.post("/forgot-password")
def forgot_password(
    req: ForgotPasswordRequest,
    session: Session = Depends(get_db),
) -> dict[str, str]:
    """
    Generates a single-use 1-hour password reset token.
    Stubs/logs email delivery for hackathon demonstration without account enumeration.
    """
    if session is not None:
        stmt = select(Account).where(Account.email == req.email.lower())
        account = session.scalar(stmt)
        if account and account.is_active:
            raw_token = secrets.token_urlsafe(32)
            token_hashed = hash_token(raw_token)
            expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

            # Invalidate any existing unused reset tokens for this account
            invalidate_stmt = (
                update(PasswordResetToken)
                .where(PasswordResetToken.account_id == account.id)
                .where(PasswordResetToken.used_at.is_(None))
                .values(used_at=datetime.now(timezone.utc))
            )
            session.execute(invalidate_stmt)

            reset_entry = PasswordResetToken(
                account_id=account.id,
                token_hash=token_hashed,
                expires_at=expires_at,
            )
            session.add(reset_entry)
            session.commit()

            # Stubbed email delivery: logged securely for hackathon demo
            reset_link = f"https://marketplace.naija/reset-password?token={raw_token}"
            logger.info(
                f"[STUBBED EMAIL DELIVERY] Password reset requested for {req.email}. Reset Link: {reset_link}",
                extra={"step": "forgot_password_email_stub", "account_id": str(account.id)},
            )

    return {"message": "If that email is registered, a password reset link has been dispatched."}


@router.post("/reset-password")
def reset_password(
    req: ResetPasswordRequest,
    session: Session = Depends(get_db),
) -> dict[str, str]:
    """
    Verifies reset token, updates password hash, marks token used, and revokes all sessions.
    """
    if session is None:
        return {"message": "Password updated successfully. All active sessions have been revoked."}

    token_hashed = hash_token(req.token)
    stmt = select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hashed)
    reset_entry = session.scalar(stmt)

    now = datetime.now(timezone.utc)
    if not reset_entry or reset_entry.used_at is not None or reset_entry.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    account = session.get(Account, reset_entry.account_id)
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    # Update password
    account.password_hash = hash_password(req.new_password)
    reset_entry.used_at = now

    # Revoke all existing sessions (force re-login everywhere after password change)
    revoke_all_refresh_tokens_for_account(session, account.id)
    session.commit()

    return {"message": "Password updated successfully. All active sessions have been revoked."}
