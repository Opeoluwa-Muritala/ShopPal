"""Read-only review: python -m app.services.reply_review. No customer text/secrets."""

import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import ReplyJob, WhatsAppMessage
from app.db.session import get_engine


def report(engine):
    with Session(engine) as session:
        states = dict(
            session.execute(
                select(ReplyJob.state, func.count()).group_by(ReplyJob.state)
            ).all()
        )
        historical = session.scalar(
            select(func.count())
            .select_from(WhatsAppMessage)
            .where(
                WhatsAppMessage.message_type == "text",
                ~WhatsAppMessage.message_id.in_(select(ReplyJob.message_id)),
            )
        )
        jobs = session.scalars(
            select(ReplyJob)
            .where(ReplyJob.state.in_(["needs_review", "delivery_unknown", "retry"]))
            .order_by(ReplyJob.created_at)
            .limit(100)
        ).all()
        return {
            "states": states,
            "historical_untracked": historical,
            "review": [
                {
                    "job_id": str(job.id),
                    "state": job.state,
                    "attempts": job.attempts,
                    "failure": job.failure_category,
                    "created_at": str(job.created_at),
                }
                for job in jobs
            ],
        }


if __name__ == "__main__":
    print(json.dumps(report(get_engine()), indent=2))
