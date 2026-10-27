"""Rebuild DATABASE_URL_2 and clone authoritative DATABASE_URL data into it."""

from __future__ import annotations

import os
import sys
import argparse
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, delete, inspect, select, text
from sqlalchemy.pool import NullPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.db.models import Base  # noqa: E402
from app.db.session import database_url  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--allow-destructive-rebuild", action="store_true",
        help="Required: drop and recreate the public schema on DATABASE_URL_2",
    )
    args = parser.parse_args()
    if not args.allow_destructive_rebuild:
        parser.error("refusing to drop a schema without --allow-destructive-rebuild")
    backend = Path(__file__).resolve().parents[1]
    settings = get_settings()
    if settings.database_url is None or settings.database_url_2 is None:
        raise RuntimeError("DATABASE_URL and DATABASE_URL_2 are required")
    primary_url = database_url(str(settings.database_url))
    secondary_url = database_url(str(settings.database_url_2))
    primary_identity = (primary_url.host, primary_url.port, primary_url.database)
    secondary_identity = (secondary_url.host, secondary_url.port, secondary_url.database)
    if primary_identity == secondary_identity:
        raise RuntimeError("Refusing to rebuild DATABASE_URL_2 because it targets DATABASE_URL")
    primary = create_engine(primary_url, poolclass=NullPool, hide_parameters=True)
    secondary = create_engine(secondary_url, poolclass=NullPool, hide_parameters=True)
    try:
        # DATABASE_URL_2 is explicitly the disposable failover replica. Its
        # existing partial copy has no PK/FK constraints, so rebuild it from
        # the authoritative primary rather than attempting unsafe ALTERs.
        with secondary.begin() as connection:
            connection.execute(text("DROP SCHEMA public CASCADE"))
            connection.execute(text("CREATE SCHEMA public"))

        os.environ["DATABASE_URL"] = str(settings.database_url_2)
        os.environ["DATABASE_SCHEMA"] = "public"
        get_settings.cache_clear()
        command.upgrade(Config(str(backend / "alembic.ini")), "head")

        with primary.connect() as source, secondary.begin() as target:
            target = target.execution_options(schema_translate_map={None: "public"})
            source_tables = set(inspect(source).get_table_names(schema="public"))
            # Migrations may seed demo rows. Clear them before copying exact IDs.
            for table in reversed(Base.metadata.sorted_tables):
                target.execute(delete(table))
            copied = 0
            for table in Base.metadata.sorted_tables:
                if table.name not in source_tables:
                    continue
                rows = [dict(row) for row in source.execute(select(table)).mappings()]
                for offset in range(0, len(rows), 500):
                    target.execute(table.insert(), rows[offset : offset + 500])
                copied += len(rows)
        print(
            f"database_2 rebuilt at Alembic head and cloned from database_1; "
            f"rows={copied} tables={len(Base.metadata.tables)}"
        )
        return 0
    finally:
        primary.dispose()
        secondary.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
