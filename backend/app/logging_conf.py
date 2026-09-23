"""Structured logging configuration with PII and secret masking for Naija Marketplace backend."""

import json
import logging
import re
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any

from app.services.security import mask_phone, mask_secret, sanitize_log_context


class RecentLogsBuffer:
    """Thread-safe circular in-memory buffer for recent log entries."""

    def __init__(self, capacity: int = 100):
        self.capacity = capacity
        self._buffer: deque[dict[str, Any]] = deque(maxlen=capacity)

    def append(self, entry: dict[str, Any]) -> None:
        self._buffer.append(entry)

    def get_recent(self, limit: int = 50) -> list[dict[str, Any]]:
        entries = list(self._buffer)
        return entries[-limit:]

    def clear(self) -> None:
        self._buffer.clear()


recent_logs_buffer = RecentLogsBuffer(capacity=200)


class StructuredJsonFormatter(logging.Formatter):
    """JSON log formatter with contextual fields and automatic PII/secret masking."""

    # Regex patterns for sensitive values in free-form messages
    PHONE_REGEX = re.compile(r"(\+?234\d{10}|\b0[789][01]\d{8}\b)")
    SECRET_REGEX = re.compile(r"(paystack_secret_[a-zA-Z0-9_]+|sk_[a-zA-Z0-9_]{10,}|pk_[a-zA-Z0-9_]{10,}|[a-f0-9]{32})", re.IGNORECASE)

    def _sanitize_message(self, message: str) -> str:
        # Mask phone numbers in text
        msg = self.PHONE_REGEX.sub(lambda m: mask_phone(m.group(0)), message)
        # Mask API keys and secrets in text
        msg = self.SECRET_REGEX.sub(lambda m: mask_secret(m.group(0)), msg)
        return msg

    def format(self, record: logging.LogRecord) -> str:
        clean_msg = self._sanitize_message(record.getMessage())
        log_entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": clean_msg,
        }

        # Include custom structured attributes attached via extra
        context_keys = [
            "vendor_id",
            "customer_phone",
            "step",
            "service",
            "latency_ms",
            "status",
            "error_type",
            "order_code",
            "route",
            "status_code",
            "paystack_key",
            "api_key",
            "job_id",
            "failure_category",
        ]
        raw_extra: dict[str, Any] = {}
        for key in context_keys:
            if hasattr(record, key):
                raw_extra[key] = getattr(record, key)

        # Sanitize all extra context keys (masks phone, keys, etc.)
        sanitized_extra = sanitize_log_context(raw_extra)
        log_entry.update(sanitized_extra)

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        # Store in circular buffer for GET /api/logs/recent
        recent_logs_buffer.append(log_entry)

        return json.dumps(log_entry)


def setup_logging(level: int = logging.INFO) -> logging.Logger:
    """Configures structured JSON logging with automatic PII masking on the root logger."""
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Avoid duplicate handlers if setup is called multiple times
    if not any(isinstance(h, logging.StreamHandler) and hasattr(h, "_is_structured") for h in root_logger.handlers):
        handler = logging.StreamHandler()
        handler.setFormatter(StructuredJsonFormatter())
        setattr(handler, "_is_structured", True)
        root_logger.addHandler(handler)

    return logging.getLogger("naija_marketplace")


logger = setup_logging()


def log_external_call(
    service: str,
    operation: str,
    start_time: float,
    success: bool,
    vendor_id: str | None = None,
    customer_phone: str | None = None,
    error: Exception | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """Helper to log external API calls (Twilio, Gemma, Groq Whisper, Paystack) with latency and status."""
    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
    context: dict[str, Any] = {
        "service": service,
        "step": operation,
        "latency_ms": latency_ms,
        "status": "success" if success else "failure",
    }
    if vendor_id:
        context["vendor_id"] = str(vendor_id)
    if customer_phone:
        context["customer_phone"] = mask_phone(str(customer_phone))
    if extra:
        context.update(sanitize_log_context(extra))

    if success:
        logger.info(
            f"External call {service}.{operation} succeeded in {latency_ms}ms",
            extra=context,
        )
    else:
        if error:
            context["error_type"] = type(error).__name__
        logger.error(
            f"External call {service}.{operation} failed in {latency_ms}ms: {error}",
            exc_info=error,
            extra=context,
        )


def log_db_write(
    operation: str,
    table: str,
    start_time: float,
    success: bool,
    vendor_id: str | None = None,
    customer_phone: str | None = None,
    error: Exception | None = None,
) -> None:
    """Helper to log DB write operations with latency and status."""
    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
    context: dict[str, Any] = {
        "service": "database",
        "step": f"db_write_{operation}",
        "table": table,
        "latency_ms": latency_ms,
        "status": "success" if success else "failure",
    }
    if vendor_id:
        context["vendor_id"] = str(vendor_id)
    if customer_phone:
        context["customer_phone"] = mask_phone(str(customer_phone))

    if success:
        logger.info(
            f"Database write on {table} ({operation}) succeeded in {latency_ms}ms",
            extra=context,
        )
    else:
        if error:
            context["error_type"] = type(error).__name__
        logger.error(
            f"Database write on {table} ({operation}) failed in {latency_ms}ms: {error}",
            exc_info=error,
            extra=context,
        )
