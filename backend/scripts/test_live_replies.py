"""Run backend tests in a disposable schema on the configured database."""

import os
import subprocess
import sys
from pathlib import Path
from time import perf_counter
from uuid import uuid4

from sqlalchemy import Connection, event, text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.db.models import Base  # noqa: E402
from app.db.session import get_engine  # noqa: E402


def main() -> int:
    engine = get_engine()
    schema = "reply_test_" + uuid4().hex
    created = False
    listener_registered = False

    def isolate_transaction(connection: Connection) -> None:
        connection.exec_driver_sql(f'SET LOCAL search_path TO "{schema}"')

    try:
        started = perf_counter()
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print(
            f"Configured database connected in {perf_counter() - started:.2f}s",
            flush=True,
        )
        with engine.begin() as connection:
            connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
        created = True

        event.listen(engine, "begin", isolate_transaction)
        listener_registered = True
        Base.metadata.create_all(engine)
        environment = {
            **os.environ,
            "TEST_DATABASE_URL": str(get_settings().database_url),
            "TEST_DATABASE_SCHEMA": schema,
        }
        targets = sys.argv[1:] or ["tests"]
        # A fresh process lets coverage see application imports and prevents
        # pytest fixtures from resetting this runner's engine/settings caches.
        return subprocess.call(
            [
                sys.executable,
                "-m",
                "pytest",
                *targets,
                "-o",
                "addopts=",
                "-p",
                "no:cacheprovider",
                "-q",
                "--tb=short",
                "--durations=5",
                "-rs",
            ],
            cwd=Path(__file__).resolve().parents[1],
            env=environment,
        )
    except Exception as exc:
        print(
            f"Live database test failed: {type(exc).__name__} (connection details suppressed)"
        )
        return 1
    finally:
        if listener_registered:
            event.remove(engine, "begin", isolate_transaction)
        if created:
            with engine.begin() as connection:
                connection.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
            print(
                "Isolated test schema removed; application records untouched.",
                flush=True,
            )
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
