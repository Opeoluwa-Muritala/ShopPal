"""Flutterwave webhook ingress; signature check and acknowledgement stay fast."""

import hmac
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, status

from app.config import Settings, get_settings
from app.services.payments import process_flutterwave_webhook

router = APIRouter(prefix="/webhooks", tags=["Flutterwave"])


def _signature_is_valid(signature: str | None, secret: str) -> bool:
    return bool(signature and secret and hmac.compare_digest(signature, secret))


@router.post("/flutterwave", status_code=200)
async def receive_flutterwave_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    verif_hash: str | None = Header(default=None, alias="verif-hash"),
) -> dict[str, str]:
    settings: Settings = get_settings()
    expected = settings.flw_webhook_secret_hash.get_secret_value()
    if not _signature_is_valid(verif_hash, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    try:
        payload: Any = await request.json()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Malformed webhook payload") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Malformed webhook payload")
    event = str(payload.get("event", ""))
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    if event and event != "charge.completed" and data.get("status") not in {"successful", "succeeded"}:
        return {"status": "ignored"}
    background_tasks.add_task(process_flutterwave_webhook, payload, settings)
    return {"status": "accepted"}
