import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

from app.logging_conf import logger, setup_logging
from app.routers import (
    accounts,
    auth,
    health,
    logs,
    orders,
    products,
    vendors,
    webhook,
    whatsapp_webhook,
)


def create_app() -> FastAPI:
    setup_logging()
    application = FastAPI(
        title="Naija Marketplace API",
        description="WhatsApp e-commerce bot backend",
        version="0.6.0",
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
            if "webhook" in route.lower():
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
    application.include_router(vendors.router)
    application.include_router(auth.router)
    application.include_router(accounts.router)
    application.include_router(orders.router)
    application.include_router(products.router)
    return application


app = create_app()
