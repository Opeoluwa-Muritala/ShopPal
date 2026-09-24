"""Run reply tests in a disposable schema on the configured live database."""

import os
import sys
from pathlib import Path
from time import perf_counter
from uuid import uuid4

import pytest
from sqlalchemy import event, text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.db.models import Base  # noqa: E402
from app.db.session import get_engine  # noqa: E402


def main():
    engine = get_engine()
    schema = "reply_test_" + uuid4().hex
    created = False
    try:
        started = perf_counter()
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print(f"Live database connected in {perf_counter() - started:.2f}s", flush=True)
        with engine.begin() as connection:
            connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
        created = True

        @event.listens_for(engine, "begin")
        def isolate_transaction(connection):
            connection.exec_driver_sql(f'SET LOCAL search_path TO "{schema}"')

        Base.metadata.create_all(engine)
        os.environ["TEST_DATABASE_URL"] = str(get_settings().database_url)
        os.environ["TEST_DATABASE_SCHEMA"] = schema
        targets = sys.argv[1:] or [
            "tests/test_reply_recovery.py", "tests/test_whatsapp_webhook.py",
            "tests/test_reply_scheduling.py", "tests/test_gemma_service.py",
        ]
        result = pytest.main([
            *targets,
            "-o", "addopts=", "-p", "no:cacheprovider", "-q", "--tb=short",
            "--durations=5",
        ])
        event.remove(engine, "begin", isolate_transaction)
        return result
    except Exception as exc:
        print(f"Live database test failed: {type(exc).__name__} (connection details suppressed)")
        return 1
    finally:
        if created:
            with engine.begin() as connection:
                connection.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
            print("Isolated test schema removed; application records untouched.", flush=True)
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
