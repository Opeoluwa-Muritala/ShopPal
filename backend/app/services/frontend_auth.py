"""Authenticate requests sent by the trusted frontend server layer."""

import hmac

from fastapi import Depends, Header, HTTPException, status

from app.config import Settings, get_settings


def require_frontend_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    settings: Settings = Depends(get_settings),
) -> None:
    expected = settings.frontend_api_key.get_secret_value()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service configuration is incomplete",
        )
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
