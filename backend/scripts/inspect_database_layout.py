"""Print non-secret schema facts for the configured ShopPal databases."""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import NullPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.db.session import database_url  # noqa: E402


def main() -> int:
    settings = get_settings()
    for index, value in enumerate((settings.database_url, settings.database_url_2), start=1):
        if value is None:
            continue
        engine = create_engine(database_url(str(value)), poolclass=NullPool, hide_parameters=True)
        try:
            with engine.connect() as connection:
                inspector = inspect(connection)
                print(f"database_{index}: schemas={inspector.get_schema_names()}")
                tables = sorted(inspector.get_table_names(schema="public"))
                print(f"database_{index}: tables={','.join(tables)}")
                counts = {
                    table: connection.scalar(text(f'SELECT count(*) FROM "{table}"'))
                    for table in tables
                    if table != "alembic_version"
                }
                print(f"database_{index}: row_counts={counts}")
                if "alembic_version" in tables:
                    columns = inspector.get_columns("alembic_version")
                    version_type = str(columns[0]["type"]) if columns else "unknown"
                    versions = list(connection.scalars(text("SELECT version_num FROM alembic_version")))
                    print(f"database_{index}: alembic_type={version_type} versions={versions}")
                if "vendors" in tables and "accounts" in tables:
                    candidates = connection.execute(text(
                        "SELECT v.id, v.business_name, a.email "
                        "FROM vendors v LEFT JOIN accounts a ON a.vendor_id = v.id "
                        "WHERE lower(coalesce(v.business_name, '')) LIKE '%aminat%' "
                        "OR lower(coalesce(a.email, '')) LIKE '%aminat%' LIMIT 5"
                    )).all()
                    print(f"database_{index}: aminat_candidates={candidates}")
        finally:
            engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
