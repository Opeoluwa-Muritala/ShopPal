from collections.abc import AsyncIterator, Iterator
from functools import lru_cache
import logging
from threading import Lock
from time import monotonic
from typing import cast

import psycopg
from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from app.config import get_settings


logger = logging.getLogger(__name__)


def database_url(raw_url: str) -> URL:
    url = make_url(raw_url)
    if url.drivername not in {"postgres", "postgresql", "postgresql+psycopg"}:
        raise ValueError("DATABASE_URL must use PostgreSQL")
    if url.host and url.host.endswith(".neon.tech"):
        if "pooler" not in url.host:
            raise ValueError("DATABASE_URL must use a Neon pooled host")
        if url.query.get("sslmode") not in {"require", "verify-ca", "verify-full"}:
            raise ValueError("DATABASE_URL must require SSL for Neon")
    return url.set(drivername="postgresql+psycopg")


class _DatabaseFailover:
    """Select a database endpoint without logging credentials or replaying writes."""

    def __init__(self, urls: tuple[URL, ...], cooldown_seconds: int) -> None:
        self.urls = urls
        self.cooldown_seconds = cooldown_seconds
        self._unavailable_until: dict[int, float] = {}
        self._lock = Lock()

    def candidates(self) -> list[tuple[int, URL]]:
        now = monotonic()
        with self._lock:
            available = [
                (index, url)
                for index, url in enumerate(self.urls)
                if self._unavailable_until.get(index, 0) <= now
            ]
        # If all endpoints are cooling down, probe each once instead of failing closed forever.
        return available or list(enumerate(self.urls))

    def mark_unavailable(self, index: int) -> None:
        with self._lock:
            self._unavailable_until[index] = monotonic() + self.cooldown_seconds
        logger.warning("Database endpoint unavailable", extra={"database_endpoint": index + 1})


def _configured_urls() -> tuple[URL, ...]:
    settings = get_settings()
    values = [settings.database_url, settings.database_url_2]
    return tuple(database_url(str(value)) for value in values if value is not None)


def _conninfo(url: URL) -> str:
    return url.set(drivername="postgresql").render_as_string(hide_password=False)


@lru_cache
def _failover() -> _DatabaseFailover:
    urls = _configured_urls()
    if not urls:
        raise RuntimeError("DATABASE_URL is not configured")
    return _DatabaseFailover(urls, get_settings().database_failover_cooldown_seconds)


def _connect_sync():
    last_error: Exception | None = None
    for index, url in _failover().candidates():
        try:
            return psycopg.connect(_conninfo(url), connect_timeout=10)
        except psycopg.OperationalError as exc:
            _failover().mark_unavailable(index)
            last_error = exc
    assert last_error is not None
    raise last_error


async def _connect_async():
    last_error: Exception | None = None
    for index, url in _failover().candidates():
        try:
            return await psycopg.AsyncConnection.connect(
                _conninfo(url), connect_timeout=10
            )
        except psycopg.OperationalError as exc:
            _failover().mark_unavailable(index)
            last_error = exc
    assert last_error is not None
    raise last_error


@lru_cache
def get_engine() -> Engine:
    urls = _configured_urls()
    if not urls:
        raise RuntimeError("DATABASE_URL is not configured")
    engine = create_engine(
        urls[0],
        creator=_connect_sync,
        poolclass=NullPool,
        hide_parameters=True,
    )
    return engine


def get_db() -> Iterator[Session]:
    settings = get_settings()
    if settings.database_url is None:
        # Allow routes and dependency injection to resolve in testing / mock environments
        yield cast(Session, None)
        return
    with Session(get_engine()) as session:
        yield session


@lru_cache
def get_async_engine() -> AsyncEngine:
    urls = _configured_urls()
    if not urls:
        raise RuntimeError("DATABASE_URL is not configured")
    engine = create_async_engine(
        urls[0], async_creator=_connect_async, poolclass=NullPool
    )
    return engine


@lru_cache
def get_async_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_async_engine(), expire_on_commit=False)


async def get_async_db() -> AsyncIterator[AsyncSession]:
    async with get_async_session_factory()() as session:
        yield session
