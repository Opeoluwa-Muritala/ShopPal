"""Signed email links for human review of a bank transfer."""

from html import escape

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.models import PendingTransfer, Vendor
from app.db.session import get_async_db
from app.logging_conf import logger
from app.services.transfer_email_links import verify_review_token

router = APIRouter(prefix="/email/transfers", tags=["Transfer email review"])
RESPONSE_HEADERS = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
    "X-Content-Type-Options": "nosniff",
}


def _page(title: str, body: str) -> HTMLResponse:
    content = (
        '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        f'<title>{escape(title)} · ShopPal</title></head>'
        '<body style="font-family:Arial,sans-serif;background:#f5f8f6;color:#17212b;margin:0">'
        '<main style="max-width:520px;margin:8vh auto;padding:28px;background:white;border:1px solid #d9e4dc;border-radius:12px">'
        f'<p style="font-weight:bold;color:#136b46">ShopPal</p><h1>{escape(title)}</h1>{body}'
        '</main></body></html>'
    )
    return HTMLResponse(content, headers=RESPONSE_HEADERS)


def _claims(token: str, settings: Settings):
    try:
        return verify_review_token(token, settings.key_encryption_secret.get_secret_value())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid or expired review link") from exc


@router.get("/{token}", include_in_schema=False)
async def review_transfer(
    token: str,
    settings: Settings = Depends(get_settings),
    session: AsyncSession = Depends(get_async_db),
) -> HTMLResponse:
    merchant_id, reference, action = _claims(token, settings)
    row = await session.scalar(select(PendingTransfer).where(
        PendingTransfer.merchant_id == merchant_id,
        PendingTransfer.reference == reference,
    ))
    if row is None:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if row.status not in {"awaiting_proof", "proof_received"}:
        return _page("Already reviewed", f"<p>Transfer {escape(reference)} is {escape(row.status)}.</p>")
    label = "Confirm payment" if action == "confirm" else "Reject payment"
    color = "#136b46" if action == "confirm" else "#a83232"
    return _page(
        label,
        f"<p>Transfer <strong>{escape(reference)}</strong> for <strong>NGN {row.amount:,.2f}</strong>.</p>"
        "<p>Check your bank app for the full amount. A screenshot or customer message is not proof of payment.</p>"
        f'<form method="post"><button type="submit" style="background:{color};color:white;border:0;'
        f'padding:12px 18px;border-radius:6px;font-size:16px;cursor:pointer">{label}</button></form>',
    )


@router.post("/{token}", include_in_schema=False)
async def decide_transfer(
    token: str,
    request: Request,
    settings: Settings = Depends(get_settings),
    session: AsyncSession = Depends(get_async_db),
) -> HTMLResponse:
    merchant_id, reference, action = _claims(token, settings)
    merchant = await session.get(Vendor, merchant_id)
    if merchant is None:
        raise HTTPException(status_code=404, detail="Transfer not found")
    service = getattr(request.app.state, "bumpa_transfer_service", None)
    if service is None:
        raise HTTPException(status_code=503, detail="Transfer review unavailable")
    try:
        client = service.client_for(merchant)
    except Exception:
        logger.exception("Owner transfer client unavailable", extra={"step": "transfer_email_review"})
        client = None
    if not await service.resolve(merchant, reference, action.upper(), client):
        return _page("Already reviewed", f"<p>Transfer {escape(reference)} is no longer open.</p>")
    outcome = "confirmed" if action == "confirm" else "rejected"
    return _page("Decision saved", f"<p>Transfer {escape(reference)} was {outcome}."
                 + (" Record the confirmed sale in Bumpa." if action == "confirm" else "") + "</p>")
