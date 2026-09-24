"""Display recent WhatsApp test conversations and timings without credentials."""

import json
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import get_engine  # noqa: E402


def main():
    engine = get_engine()
    try:
        with engine.connect() as connection:
            rows = connection.execute(text("""
                SELECT j.id AS job_id, m.body AS customer_message,
                       j.reply_text AS assistant_reply, j.state, j.failure_category,
                       j.created_at, j.accepted_at, j.delivered_at,
                       round(extract(epoch FROM (j.accepted_at-j.created_at))::numeric, 2)
                           AS response_seconds,
                       round(extract(epoch FROM (now()-j.created_at))::numeric, 2)
                           AS age_seconds
                FROM whatsapp_reply_jobs j
                JOIN whatsapp_messages m ON m.message_id=j.message_id
                ORDER BY j.created_at DESC LIMIT 5
            """)).mappings().all()
            print(json.dumps([dict(row) for row in rows], default=str, ensure_ascii=True))
        return 0
    except Exception as exc:
        print(f"Reply inspection failed: {type(exc).__name__}; connection details suppressed")
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
