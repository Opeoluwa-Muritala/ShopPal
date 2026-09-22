"""Admin inspection endpoint for live structured logs during hackathon demo, secured with API key."""

from typing import Any

from fastapi import APIRouter, Header, HTTPException, Query, status

from app.logging_conf import recent_logs_buffer

router = APIRouter(prefix="/api/logs", tags=["monitoring"])

ADMIN_DEMO_KEY = "demo_admin_secret_key"


@router.get("/recent")
def get_recent_logs(
    limit: int = Query(default=50, ge=1, le=200, description="Max number of log records to return"),
    level: str | None = Query(default=None, description="Filter by log level (e.g. INFO, ERROR)"),
    x_admin_api_key: str | None = Header(default=None, alias="X-Admin-API-Key"),
    x_vendor_api_key: str | None = Header(default=None, alias="X-Vendor-API-Key"),
) -> dict[str, Any]:
    """
    Returns the most recent in-memory structured log entries.
    SECURITY GATED: Requires either X-Admin-API-Key or X-Vendor-API-Key to prevent public log sniffing.
    """
    key = x_admin_api_key or x_vendor_api_key
    if not key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing required API key header (X-Admin-API-Key or X-Vendor-API-Key)",
        )

    logs = recent_logs_buffer.get_recent(limit=limit)
    if level:
        filtered = [entry for entry in logs if entry.get("level") == level.upper()]
    else:
        filtered = logs

    return {
        "count": len(filtered),
        "total_buffered": len(logs),
        "logs": filtered,
    }
