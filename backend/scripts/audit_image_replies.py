"""Print recent image-related reply decisions without customer identifiers."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import get_engine  # noqa: E402


def main() -> int:
    engine = get_engine()
    try:
        with engine.connect() as connection:
            rows = connection.execute(
                text(
                    """
                    SELECT m.body AS customer_message,
                           j.reply_text AS assistant_reply,
                           j.transcript,
                           j.state,
                           j.failure_category,
                           j.created_at
                    FROM whatsapp_reply_jobs j
                    JOIN whatsapp_messages m ON m.message_id = j.message_id
                    WHERE lower(coalesce(m.body, '')) SIMILAR TO
                          '%(image|images|photo|photos|picture|pictures|pic|pics)%'
                    ORDER BY j.created_at DESC
                    LIMIT 50
                    """
                )
            ).mappings().all()
        print(json.dumps([dict(row) for row in rows], default=str, ensure_ascii=True))
        return 0
    except Exception as exc:
        print(f"Image reply audit failed: {type(exc).__name__}; details suppressed")
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
