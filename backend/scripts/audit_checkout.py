"""Print recent checkout/payment state without credentials or customer identifiers."""

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
            replies = connection.execute(text("""
                SELECT m.body, j.reply_text, j.state, j.failure_category,
                       j.transcript, j.created_at
                FROM whatsapp_reply_jobs j
                JOIN whatsapp_messages m ON m.message_id = j.message_id
                WHERE lower(coalesce(m.body, '')) LIKE '%checkout%'
                   OR lower(coalesce(m.body, '')) LIKE '%pay%'
                ORDER BY j.created_at DESC LIMIT 10
            """)).mappings().all()
            orders = connection.execute(text("""
                SELECT order_code, status, total, tx_ref, account_number,
                       bank_name, expires_at, created_at
                FROM orders ORDER BY created_at DESC LIMIT 10
            """)).mappings().all()
        print(json.dumps(
            {"replies": [dict(row) for row in replies], "orders": [dict(row) for row in orders]},
            default=str,
            ensure_ascii=True,
        ))
        return 0
    except Exception as exc:
        print(f"Checkout audit failed: {type(exc).__name__}; details suppressed")
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
