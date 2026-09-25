import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from app.config import get_settings
from app.logging_conf import logger, setup_logging
from app.routers import (
    accounts,
    dashboard,
    auth,
    health,
    logs,
    orders,
    privacy,
    products,
    vendors,
    webhook,
    whatsapp_webhook,
)
from app.services.frontend_auth import require_frontend_api_key
from app.services.reply_recovery import recovery_loop


@asynccontextmanager
async def lifespan(application):
    stop = asyncio.Event()
    application.state.reply_wakeup = asyncio.Event()
    logger.info("Reply worker startup", extra={
        "step": "reply_worker_startup",
        "status": "enabled" if get_settings().meta_reply_worker_enabled else "disabled",
    })
    task = asyncio.create_task(recovery_loop(stop, application.state.reply_wakeup)) if get_settings().meta_reply_worker_enabled else None
    try:
        yield
    finally:
        stop.set()
        if task is not None:
            await task


def create_app() -> FastAPI:
    setup_logging()
    application = FastAPI(
        title="ShopPal API",
        description=(
            "ShopPal backend for vendor commerce and customer conversations over "
            "Twilio WhatsApp and Meta WhatsApp Cloud API. Vendor API routes require "
            "the configured frontend API key and applicable account credentials; "
            "provider webhooks use provider-specific signature verification. "
            "Frontend endpoint mapping is documented in docs/FRONTEND_API.md."
        ),
        version="0.6.0",
        lifespan=lifespan,
        openapi_tags=[
            {"name": "Frontend Auth", "description": "Login, token lifecycle, and password recovery used by the vendor dashboard."},
            {"name": "Frontend Accounts", "description": "Current account and staff administration for the dashboard."},
            {"name": "Vendor Onboarding", "description": "Vendor signup and initial catalog import."},
            {"name": "Frontend Products", "description": "Vendor product catalog operations used by the dashboard."},
            {"name": "Frontend Orders", "description": "Vendor order listing and status management."},
            {"name": "Frontend Diagnostics", "description": "Authenticated recent application logs for dashboard diagnostics."},
            {"name": "System", "description": "Service health checks."},
            {"name": "Provider Webhooks", "description": "Inbound provider callbacks; these are not frontend dashboard calls."},
            {"name": "Twilio WhatsApp", "description": "Signed Twilio WhatsApp customer messages."},
            {"name": "Paystack", "description": "Signed Paystack payment callbacks."},
            {
                "name": "Meta WhatsApp",
                "description": (
                    "Public Meta Cloud API verification and signed event callbacks."
                ),
            },
            {
                "name": "Legal",
                "description": "Public legal pages required by connected platforms.",
            },
        ],
    )

    configured_origins = [
        origin.strip().rstrip("/")
        for origin in get_settings().cors_origins.split(",")
        if origin.strip()
    ]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=configured_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-API-Key"],
    )

    # Global timing and structured request logging middleware
    @application.middleware("http")
    async def log_requests_middleware(request: Request, call_next):
        start_time = time.perf_counter()
        route = request.url.path
        method = request.method

        logger.info(
            f"Incoming {method} {route}",
            extra={"route": route, "step": "request_entry", "method": method},
        )

        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.info(
                f"Completed {method} {route} with status {response.status_code} in {duration_ms}ms",
                extra={
                    "route": route,
                    "step": "request_exit",
                    "status_code": response.status_code,
                    "latency_ms": duration_ms,
                },
            )
            return response
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.error(
                f"Unhandled exception on {method} {route} after {duration_ms}ms: {exc}",
                exc_info=exc,
                extra={
                    "route": route,
                    "step": "unhandled_exception",
                    "latency_ms": duration_ms,
                    "error_type": type(exc).__name__,
                },
            )

            # Webhook graceful handling: never return 500 to Twilio to prevent retry-storms
            if route.startswith("/webhook/"):
                return Response(
                    content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
                    media_type="application/xml",
                    status_code=200,
                )

            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal server error",
                    "detail": "An unexpected error occurred and has been logged.",
                },
            )

    application.include_router(health.router)
    application.include_router(logs.router)
    application.include_router(webhook.router)
    application.include_router(whatsapp_webhook.router)
    application.include_router(privacy.router)
    frontend_dependencies = [Depends(require_frontend_api_key)]
    application.include_router(vendors.router, dependencies=frontend_dependencies)
    application.include_router(auth.router, dependencies=frontend_dependencies)
    application.include_router(accounts.router, dependencies=frontend_dependencies)
    application.include_router(dashboard.router, dependencies=frontend_dependencies)
    application.include_router(orders.router, dependencies=frontend_dependencies)
    application.include_router(products.router, dependencies=frontend_dependencies)
    return application


app = create_app()
