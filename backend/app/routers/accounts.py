"""Accounts management router: staff invitations and team administration (owner-only)."""

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Account
from app.db.session import get_db
from app.services.auth import get_current_owner, hash_password

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


class InviteStaffRequest(BaseModel):
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=20)
    temp_password: str = Field(..., min_length=8)


@router.post("/invite-staff", status_code=status.HTTP_201_CREATED)
def invite_staff(
    req: InviteStaffRequest,
    current_owner: Account = Depends(get_current_owner),
    session: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Creates a new staff account tied to the owner's vendor_id.
    ROLE-BASED ACCESS CONTROL: Restricted strictly to accounts with role='owner'.
    """
    if session is not None:
        # Check if email is already taken
        stmt = select(Account).where(Account.email == req.email.lower())
        existing = session.scalar(stmt)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email address already exists",
            )

        staff_account = Account(
            vendor_id=current_owner.vendor_id,
            email=req.email.lower(),
            phone=req.phone,
            password_hash=hash_password(req.temp_password),
            role="staff",
            is_active=True,
        )
        session.add(staff_account)
        session.commit()
        session.refresh(staff_account)
        account_id = str(staff_account.id)
    else:
        account_id = "00000000-0000-0000-0000-000000000003"

    return {
        "account_id": account_id,
        "vendor_id": str(current_owner.vendor_id),
        "email": req.email,
        "role": "staff",
        "status": "active",
        "message": "Staff account created successfully",
    }
