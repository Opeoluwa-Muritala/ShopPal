"""Owner-only Bumpa connection and merchant commerce settings."""

from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.bumpa_repository import claim_sync, get_connection
from app.db.models import Account, BumpaConnection, PendingTransfer, SyncState, Vendor
from app.db.session import get_async_db
from app.integrations.bumpa.client import BumpaAuthError, BumpaClient, BumpaError
from app.integrations.bumpa.credentials import encrypt_credential
from app.services.auth import get_current_account

router = APIRouter(prefix="/merchants", tags=["Bumpa Merchants"])


def get_bumpa_http_client(request: Request) -> httpx.AsyncClient:
    client = getattr(request.app.state, "bumpa_http_client", None)
    if client is None:
        raise HTTPException(status_code=503, detail="Bumpa client is unavailable")
    return client


def _require_owner(merchant_id: UUID, account: Account) -> None:
    if account.vendor_id != merchant_id:
        raise HTTPException(status_code=404, detail="Merchant not found")
    if account.role != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")


async def _require_vendor(session: AsyncSession, merchant_id: UUID) -> Vendor:
    vendor = await session.get(Vendor, merchant_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return vendor


class ConnectRequest(BaseModel):
    public_key: SecretStr
    secret_key: SecretStr | None = None
    location_id: str = Field(min_length=1, max_length=120)


class WhatsAppRequest(BaseModel):
    phone_number_id: str = Field(min_length=1, max_length=80)
    owner_whatsapp_number: str = Field(pattern=r"^\+[1-9]\d{6,14}$")
    access_token: SecretStr


class PayoutRequest(BaseModel):
    bank_name: str = Field(min_length=1, max_length=120)
    account_name: str = Field(min_length=1, max_length=120)
    account_number: str = Field(pattern=r"^\d{10}$")


class FulfilmentRequest(BaseModel):
    pickup_location_id: str | None = Field(default=None, max_length=120)
    delivery_enabled: bool = True


@router.post("/{merchant_id}/bumpa/connect")
async def connect_bumpa(
    merchant_id: UUID,
    body: ConnectRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    account: Account = Depends(get_current_account),
    session: AsyncSession = Depends(get_async_db),
    settings: Settings = Depends(get_settings),
    http_client: httpx.AsyncClient = Depends(get_bumpa_http_client),
) -> dict[str, str]:
    _require_owner(merchant_id, account)
    vendor = await _require_vendor(session, merchant_id)
    public_key = body.public_key.get_secret_value()
    secret_key = body.secret_key.get_secret_value() if body.secret_key else None
    if not public_key or (body.secret_key is not None and not secret_key):
        raise HTTPException(status_code=422, detail="Bumpa keys cannot be empty")
    client = BumpaClient(settings.bumpa_base_url, public_key, secret_key, body.location_id, http_client)
    try:
        await client.list_products(limit=1)
    except BumpaAuthError as exc:
        raise HTTPException(status_code=400, detail="Bumpa public key was rejected") from exc
    except BumpaError as exc:
        raise HTTPException(status_code=503, detail="Could not verify the Bumpa public key right now") from exc
    if secret_key:
        try:
            await client.list_orders(limit=1)
        except BumpaAuthError as exc:
            raise HTTPException(status_code=400, detail="Bumpa secret key was rejected") from exc
        except BumpaError as exc:
            raise HTTPException(status_code=503, detail="Could not verify the Bumpa secret key right now") from exc

    connection = await get_connection(session, merchant_id)
    if connection is None:
        connection = BumpaConnection(merchant_id=merchant_id, public_key_enc="", location_id=body.location_id)
        session.add(connection)
    connection.public_key_enc = encrypt_credential(public_key, settings)
    connection.secret_key_enc = encrypt_credential(secret_key, settings) if secret_key else None
    connection.location_id = body.location_id
    connection.status = "active"
    connection.last_verified_at = datetime.now(UTC)
    vendor.catalog_provider = "bumpa"
    if await session.get(SyncState, merchant_id) is None:
        session.add(SyncState(merchant_id=merchant_id, running=False))
    await session.commit()
    sync_callback = getattr(request.app.state, "bumpa_initial_sync", None)
    if sync_callback is not None:
        background_tasks.add_task(sync_callback, merchant_id)
    return {"status": "active", "location_id": body.location_id}


@router.post("/{merchant_id}/bumpa/sync")
async def refresh_bumpa_catalog(
    merchant_id: UUID,
    request: Request,
    background_tasks: BackgroundTasks,
    account: Account = Depends(get_current_account),
    session: AsyncSession = Depends(get_async_db),
) -> dict[str, str]:
    _require_owner(merchant_id, account)
    vendor = await _require_vendor(session, merchant_id)
    if vendor.catalog_provider != "bumpa":
        raise HTTPException(status_code=404, detail="Bumpa catalog not connected")
    sync_callback = getattr(request.app.state, "bumpa_initial_sync", None)
    if sync_callback is None:
        raise HTTPException(status_code=503, detail="Catalog sync is unavailable")
    state = await session.get(SyncState, merchant_id)
    if state and state.last_started_at and state.last_started_at > datetime.now(UTC) - timedelta(minutes=1):
        raise HTTPException(status_code=429, detail="Catalog was refreshed recently")
    if not await claim_sync(session, merchant_id):
        await session.rollback()
        raise HTTPException(status_code=409, detail="Catalog refresh already running")
    await session.commit()
    background_tasks.add_task(sync_callback, merchant_id, preclaimed=True)
    return {"status": "queued"}


@router.delete("/{merchant_id}/bumpa/connect")
async def disconnect_bumpa(
    merchant_id: UUID,
    account: Account = Depends(get_current_account),
    session: AsyncSession = Depends(get_async_db),
) -> dict[str, str]:
    _require_owner(merchant_id, account)
    vendor = await _require_vendor(session, merchant_id)
    connection = await get_connection(session, merchant_id)
    if connection is not None:
        await session.delete(connection)
    vendor.catalog_provider = "legacy"
    await session.commit()
    return {"status": "disconnected"}


@router.put("/{merchant_id}/whatsapp")
async def configure_whatsapp(
    merchant_id: UUID,
    body: WhatsAppRequest,
    account: Account = Depends(get_current_account),
    session: AsyncSession = Depends(get_async_db),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    _require_owner(merchant_id, account)
    vendor = await _require_vendor(session, merchant_id)
    vendor.whatsapp_phone_number_id = body.phone_number_id
    vendor.owner_whatsapp_number = body.owner_whatsapp_number
    vendor.whatsapp_token_enc = encrypt_credential(body.access_token.get_secret_value(), settings)
    await session.commit()
    return {"status": "configured"}


@router.put("/{merchant_id}/payout-details")
async def configure_payout(
    merchant_id: UUID,
    body: PayoutRequest,
    account: Account = Depends(get_current_account),
    session: AsyncSession = Depends(get_async_db),
) -> dict[str, str]:
    _require_owner(merchant_id, account)
    vendor = await _require_vendor(session, merchant_id)
    vendor.payout_bank_name = body.bank_name
    vendor.payout_account_name = body.account_name
    vendor.payout_account_number = body.account_number
    await session.commit()
    return {"status": "configured"}


@router.put("/{merchant_id}/fulfilment")
async def configure_fulfilment(
    merchant_id: UUID,
    body: FulfilmentRequest,
    account: Account = Depends(get_current_account),
    session: AsyncSession = Depends(get_async_db),
) -> dict[str, str]:
    _require_owner(merchant_id, account)
    if not body.delivery_enabled and not body.pickup_location_id:
        raise HTTPException(status_code=422, detail="Enable delivery or set a pickup location")
    vendor = await _require_vendor(session, merchant_id)
    vendor.pickup_location_id = body.pickup_location_id
    vendor.delivery_enabled = body.delivery_enabled
    await session.commit()
    return {"status": "configured"}


@router.get("/{merchant_id}/transfers")
async def list_transfers(
    merchant_id: UUID,
    status: Literal["awaiting_proof", "proof_received", "confirmed", "rejected", "expired"] | None = None,
    account: Account = Depends(get_current_account),
    session: AsyncSession = Depends(get_async_db),
) -> dict[str, Any]:
    _require_owner(merchant_id, account)
    await _require_vendor(session, merchant_id)
    statement = select(PendingTransfer).where(PendingTransfer.merchant_id == merchant_id)
    if status:
        statement = statement.where(PendingTransfer.status == status)
    rows = (await session.scalars(statement.order_by(PendingTransfer.created_at.desc()).limit(100))).all()
    return {
        "transfers": [
            {
                "reference": row.reference,
                "product_id": row.bumpa_product_id,
                "quantity": row.quantity,
                "amount": str(row.amount),
                "customer_wa_id": row.customer_wa_id,
                "status": row.status,
                "created_at": row.created_at.isoformat(),
            }
            for row in rows
        ]
    }
