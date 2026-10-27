"""Apply the normal Alembic migration chain to DATABASE_URL_2."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402


def main() -> int:
    backend = Path(__file__).resolve().parents[1]
    settings = get_settings()
    if settings.database_url_2 is None:
        raise RuntimeError("DATABASE_URL_2 is not configured")

    # env.py deliberately reads DATABASE_URL. Override it only inside this
    # process so the standard, reviewed migration chain targets the standby.
    os.environ["DATABASE_URL"] = str(settings.database_url_2)
    get_settings.cache_clear()
    config = Config(str(backend / "alembic.ini"))
    command.upgrade(config, "head")
    print("database_2 schema upgraded to Alembic head")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
