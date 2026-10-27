"""Non-destructively complete DATABASE_URL_2 and verify it against primary."""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import NullPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.db.models import Base  # noqa: E402
from app.db.session import database_url  # noqa: E402


def layout(engine) -> dict[str, set[str]]:
    inspector = inspect(engine)
    return {
        table: {column["name"] for column in inspector.get_columns(table)}
        for table in inspector.get_table_names(schema="public")
        if table != "alembic_version"
    }


def main() -> int:
    settings = get_settings()
    if settings.database_url is None or settings.database_url_2 is None:
        raise RuntimeError("DATABASE_URL and DATABASE_URL_2 are required")
    primary = create_engine(database_url(str(settings.database_url)), poolclass=NullPool, hide_parameters=True)
    secondary = create_engine(database_url(str(settings.database_url_2)), poolclass=NullPool, hide_parameters=True)
    try:
        with secondary.begin() as connection:
            connection.execute(text(
                "ALTER TABLE alembic_version ALTER COLUMN version_num "
                "TYPE VARCHAR(32) USING lpad(version_num::text, 4, '0')"
            ))
        Base.metadata.create_all(secondary, checkfirst=True)

        primary_layout = layout(primary)
        secondary_layout = layout(secondary)
        missing_tables = sorted(set(primary_layout) - set(secondary_layout))
        extra_tables = sorted(set(secondary_layout) - set(primary_layout))
        column_mismatches = {
            table: {
                "missing": sorted(primary_layout[table] - secondary_layout.get(table, set())),
                "extra": sorted(secondary_layout.get(table, set()) - primary_layout[table]),
            }
            for table in primary_layout.keys() & secondary_layout.keys()
            if primary_layout[table] != secondary_layout[table]
        }
        if missing_tables or extra_tables or column_mismatches:
            raise RuntimeError(
                f"Schema mismatch remains: missing={missing_tables}, extra={extra_tables}, "
                f"columns={column_mismatches}"
            )
        with secondary.connect() as connection:
            version = connection.scalar(text("SELECT version_num FROM alembic_version"))
        if version != "0015":
            raise RuntimeError(f"Unexpected secondary Alembic revision: {version!r}")
        print(f"database_2 schema matches database_1: tables={len(primary_layout)} revision={version}")
        return 0
    finally:
        primary.dispose()
        secondary.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
