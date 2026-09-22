from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.orm import Session

from app.config import get_settings


def database_url(raw_url: str) -> URL:
    url = make_url(raw_url)
    if url.drivername not in {"postgres", "postgresql", "postgresql+psycopg"}:
        raise ValueError("DATABASE_URL must use PostgreSQL")
    return url.set(drivername="postgresql+psycopg")


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    if settings.database_url is None:
        raise RuntimeError("DATABASE_URL is not configured")
    return create_engine(
        database_url(str(settings.database_url)),
        pool_size=10,
        max_overflow=20,
        pool_timeout=30,
        pool_recycle=1800,
        pool_pre_ping=True,
        hide_parameters=True,
        connect_args={"connect_timeout": 10},
    )


def get_db() -> Iterator[Session]:
    settings = get_settings()
    if settings.database_url is None:
        # Allow routes and dependency injection to resolve in testing / mock environments
        yield None
        return
    with Session(get_engine()) as session:
        yield session
