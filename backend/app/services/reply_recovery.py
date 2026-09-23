"""Durable replies with short data transactions and a separate coordination lock."""

import asyncio
import hashlib
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import httpx
from fastapi import HTTPException
from sqlalchemy import exists, func, or_, select, text
from sqlalchemy.orm import Session, aliased

from app.config import get_settings
from app.db.models import (
    Conversation,
    ReplyJob,
    ReplyToolResult,
    Vendor,
    WhatsAppMessage,
)
from app.db.session import get_engine
from app.logging_conf import logger
from app.services.customer_tools import CustomerToolDispatcher
from app.services.llm import GemmaError, LLMService

DELAYS = (10, 30, 120, 300, 900)
ACTIVE = ("pending", "retry", "processing", "sending")


class LeaseLost(RuntimeError):
    pass


def now():
    return datetime.now(UTC)


def normalize_number(value):
    return "".join(char for char in value if char.isdigit())


def validate_action(action):
    if set(action) == {"reply"}:
        reply = action["reply"]
        if isinstance(reply, str) and reply.strip() and len(reply) <= 4096:
            return {"reply": reply.strip()}
        raise GemmaError("Invalid reply")
    if set(action) != {"tool", "arguments"} or not isinstance(
        action["arguments"], dict
    ):
        raise GemmaError("Invalid tool action")
    name, args = action["tool"], action["arguments"]
    fields = {
        "searchProducts": {"query"},
        "viewCart": set(),
        "addToCart": {"productId", "quantity"},
        "updateCartItem": {"productId", "quantity"},
        "removeCartItem": {"productId"},
        "checkoutCart": {"deliveryAddress"},
    }
    if not isinstance(name, str) or name not in fields or set(args) != fields[name]:
        raise GemmaError("Unavailable tool action")
    if "productId" in args:
        try:
            UUID(args["productId"])
        except (ValueError, TypeError, AttributeError):
            raise GemmaError("Invalid product") from None
    if "quantity" in args and (
        type(args["quantity"]) is not int or not 1 <= args["quantity"] <= 1000
    ):
        raise GemmaError("Invalid quantity")
    for key, limit in (("query", 120), ("deliveryAddress", 1000)):
        if key in args and (not isinstance(args[key], str) or len(args[key]) > limit):
            raise GemmaError("Invalid tool input")
    return action


def checkpoint(session, job, owner):
    guard = session.info.get("reply_guard")
    if guard:
        guard()
        with session.no_autoflush:
            stored_owner = session.scalar(
                select(ReplyJob.lease_owner)
                .where(ReplyJob.id == job.id)
                .with_for_update()
            )
        if stored_owner != owner:
            session.rollback()
            raise LeaseLost("Lease ownership lost")
    if job.lease_owner != owner:
        raise LeaseLost("Lease ownership lost")
    job.lease_until = now() + timedelta(minutes=5)
    job.updated_at = now()
    session.commit()


def fail(session, job, category, *, permanent=False):
    job.failure_category = category
    job.lease_owner = None
    job.lease_until = None
    if permanent or job.attempts > len(DELAYS):
        job.state = "needs_review"
    else:
        job.state = "retry"
        job.next_attempt_at = now() + timedelta(
            seconds=DELAYS[max(job.attempts - 1, 0)]
        )
    session.commit()
    logger.warning(
        "Reply job requires recovery",
        extra={
            "step": "reply_recovery",
            "job_id": str(job.id),
            "status": job.state,
            "failure_category": category,
        },
    )


def generate_reply(session, job, owner, settings):
    vendor = session.get(Vendor, job.vendor_id) if job.vendor_id else None
    if vendor is None:
        matches = (
            session.scalars(
                select(Vendor).where(
                    func.regexp_replace(Vendor.bot_number, "[^0-9]", "", "g")
                    == normalize_number(job.display_number),
                    Vendor.is_active.is_(True),
                )
            ).all()
            if normalize_number(job.display_number)
            else []
        )
        if len(matches) != 1:
            fail(session, job, "vendor_mapping", permanent=True)
            return
        vendor = matches[0]
        job.vendor_id = vendor.id
    if not vendor.is_active:
        fail(session, job, "vendor_inactive", permanent=True)
        return
    conversation = session.scalar(
        select(Conversation).where(
            Conversation.vendor_id == vendor.id,
            Conversation.customer_phone == job.customer_phone,
        )
    )
    if conversation is None:
        conversation = Conversation(
            vendor_id=vendor.id,
            customer_phone=job.customer_phone,
            message_history=[],
            messages_this_session=0,
        )
        session.add(conversation)
        session.flush()
    history = list(conversation.message_history or [])[-12:]
    message = session.scalar(
        select(WhatsAppMessage).where(WhatsAppMessage.message_id == job.message_id)
    )
    customer_text = message.body
    checkpoint(session, job, owner)
    service = LLMService(settings)
    for _ in range(9):
        if not job.pending_action:
            if len(job.transcript) >= 8:
                fail(session, job, "tool_limit", permanent=True)
                return
            # End the read transaction before the external call.
            transcript = list(job.transcript)
            session.commit()
            action = validate_action(
                service.next_action(customer_text, history, transcript)
            )
            session.refresh(job)
            job.pending_action = action
            checkpoint(session, job, owner)
        action = validate_action(job.pending_action)
        if "reply" in action:
            job.reply_text = action["reply"]
            job.pending_action = None
            conversation.message_history = (
                list(conversation.message_history or [])
                + [
                    {
                        "role": "user",
                        "content": customer_text,
                        "message_id": job.message_id,
                    },
                    {
                        "role": "assistant",
                        "content": job.reply_text,
                        "reply_job_id": str(job.id),
                    },
                ]
            )[-40:]
            conversation.messages_this_session = (
                int(conversation.messages_this_session or 0) + 2
            )
            conversation.last_touched = now()
            checkpoint(session, job, owner)
            return
        index = len(job.transcript)
        cached = session.scalar(
            select(ReplyToolResult).where(
                ReplyToolResult.job_id == job.id, ReplyToolResult.call_index == index
            )
        )
        if cached is None:
            try:
                with session.begin_nested():
                    result = CustomerToolDispatcher(
                        session, vendor.id, job.customer_phone, commit=False
                    )(action["tool"], action["arguments"])
            except HTTPException:
                result = {
                    "error": "That shopping action is unavailable. Please check your cart and try again."
                }
            cached = ReplyToolResult(
                job_id=job.id,
                call_index=index,
                name=action["tool"],
                arguments=action["arguments"],
                result=result,
            )
            session.add(cached)
        job.transcript = list(job.transcript) + [
            {"action": action, "result": cached.result}
        ]
        job.pending_action = None
        # Tool writes, receipt, and agent checkpoint commit atomically.
        checkpoint(session, job, owner)


def send_reply(session, job, owner, settings):
    if (
        not settings.whatsapp_access_token.get_secret_value()
        or not settings.whatsapp_phone_number_id
    ):
        fail(session, job, "meta_credentials", permanent=True)
        return
    if job.phone_number_id != settings.whatsapp_phone_number_id:
        fail(session, job, "sender_mismatch", permanent=True)
        return
    last_inbound = session.scalar(
        select(func.max(WhatsAppMessage.wa_timestamp)).where(
            WhatsAppMessage.message_id == ReplyJob.message_id,
            ReplyJob.customer_phone == job.customer_phone,
            ReplyJob.phone_number_id == job.phone_number_id,
        )
    )
    outside_window = last_inbound is None or now() - last_inbound >= timedelta(hours=24)
    use_template = outside_window and job.attempts > 1
    if outside_window and not use_template:
        fail(session, job, "messaging_window", permanent=True)
        return
    template_name = settings.whatsapp_reengagement_template_name.strip()
    if use_template and not template_name:
        fail(session, job, "messaging_window_template_missing", permanent=True)
        return
    job.state = "sending"
    recipient, identifier = job.customer_phone, str(job.id)
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient,
    }
    if use_template:
        payload.update({
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": settings.whatsapp_reengagement_template_language},
            },
        })
    else:
        payload.update({
            "type": "text",
            "text": {"preview_url": False, "body": job.reply_text},
            "biz_opaque_callback_data": identifier,
        })
    checkpoint(session, job, owner)
    try:
        response = httpx.post(
            f"https://graph.facebook.com/v23.0/{settings.whatsapp_phone_number_id}/messages",
            headers={
                "Authorization": "Bearer "
                + settings.whatsapp_access_token.get_secret_value()
            },
            json=payload,
            timeout=20,
        )
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.PoolTimeout):
        session.refresh(job)
        if job.state != "sending":
            return
        fail(session, job, "meta_connect")
        return
    except httpx.HTTPError:
        session.refresh(job)
        if job.state != "sending":
            return
        job.state = "delivery_unknown"
        job.failure_category = "meta_ambiguous_send"
        checkpoint(session, job, owner)
        return
    session.refresh(job)
    if job.state != "sending":
        return  # Callback already confirmed the send.
    if response.status_code == 429:
        fail(session, job, "meta_rate_limit")
        return
    if response.status_code >= 500:
        job.state = "delivery_unknown"
        job.failure_category = "meta_ambiguous_send"
        checkpoint(session, job, owner)
        return
    if response.status_code >= 400:
        fail(session, job, "meta_rejected", permanent=True)
        return
    try:
        message_id = response.json()["messages"][0]["id"]
        if not isinstance(message_id, str) or not message_id:
            raise ValueError()
    except (KeyError, IndexError, TypeError, ValueError):
        job.state = "delivery_unknown"
        job.failure_category = "meta_missing_receipt"
        checkpoint(session, job, owner)
        return
    job.outbound_message_id = message_id
    job.accepted_at = now()
    job.state = "accepted"
    job.lease_owner = None
    job.lease_until = None
    session.commit()
    logger.info(
        "Meta reply accepted",
        extra={
            "step": "meta_message_send",
            "job_id": identifier,
            "delivery_mode": "template" if use_template else "text",
        },
    )


def earlier_pending(job):
    earlier = aliased(ReplyJob)
    return exists(
        select(earlier.id).where(
            earlier.customer_phone == job.customer_phone,
            earlier.phone_number_id == job.phone_number_id,
            earlier.state.in_(ACTIVE),
            or_(
                earlier.created_at < job.created_at,
                (earlier.created_at == job.created_at) & (earlier.id < job.id),
            ),
        )
    )


def process_claim(engine, job_id, settings):
    # A separate transaction-scoped advisory lock also works through PgBouncer.
    # Worker data commits use another connection; the lock spans those commits.
    with engine.begin() as lock_connection:
        with Session(engine, expire_on_commit=False) as session:
            job = session.get(ReplyJob, job_id)
            if job is None:
                return False
            key = int.from_bytes(
                hashlib.sha256(
                    (job.phone_number_id + ":" + job.customer_phone).encode()
                ).digest()[:8],
                "big",
                signed=True,
            )
            locked = lock_connection.scalar(
                text("select pg_try_advisory_xact_lock(:key)"), {"key": key}
            )
            session.commit()
            if not locked:
                return False
            try:
                session.refresh(job)
                if job.state not in ACTIVE or job.next_attempt_at > now():
                    return False
                if job.lease_until and job.lease_until > now():
                    return False
                if session.scalar(select(earlier_pending(job))):
                    return False
                if job.state == "sending":
                    job.state = "delivery_unknown"
                    job.failure_category = "send_interrupted"
                    session.commit()
                    return True
                owner = str(uuid4())
                job.lease_owner = owner
                job.attempts += 1
                job.state = "processing"
                checkpoint(session, job, owner)

                def guard():
                    try:
                        lock_connection.execute(text("select 1"))
                    except Exception:
                        raise LeaseLost("Coordination connection lost") from None

                session.info["reply_guard"] = guard
                try:
                    inbound = session.scalar(
                        select(WhatsAppMessage).where(
                            WhatsAppMessage.message_id == job.message_id
                        )
                    )
                    if (
                        inbound.wa_timestamp is None
                        or now() - inbound.wa_timestamp >= timedelta(hours=24)
                    ):
                        fail(session, job, "messaging_window", permanent=True)
                        return True
                    if not job.reply_text:
                        generate_reply(session, job, owner, settings)
                    if job.state == "processing" and job.reply_text:
                        send_reply(session, job, owner, settings)
                except LeaseLost:
                    session.rollback()
                except GemmaError as exc:
                    session.rollback()
                    session.refresh(job)
                    guard()
                    if job.lease_owner != owner:
                        return False
                    code = getattr(exc, "status_code", None)
                    fail(
                        session,
                        job,
                        "gemma_http_" + str(code) if code else "gemma_unavailable",
                        permanent=code in (400, 401, 403, 404),
                    )
                except Exception:
                    session.rollback()
                    session.refresh(job)
                    guard()
                    if job.lease_owner != owner:
                        return False
                    if job.state == "sending":
                        job.state = "delivery_unknown"
                        job.failure_category = "send_interrupted"
                        session.commit()
                    else:
                        fail(session, job, "processing_failed")
                return True
            finally:
                session.rollback()
                # The outer transaction releases the advisory lock automatically.


def recover_once(engine, settings):
    with Session(engine) as session:
        ids = session.scalars(
            select(ReplyJob.id)
            .where(
                ReplyJob.state.in_(ACTIVE),
                ReplyJob.next_attempt_at <= now(),
                or_(ReplyJob.lease_until.is_(None), ReplyJob.lease_until <= now()),
                ~earlier_pending(ReplyJob),
            )
            .order_by(ReplyJob.created_at, ReplyJob.id)
            .limit(20)
        ).all()
    if not ids:
        return
    # Different customers can be processed in parallel. process_claim still holds
    # a per-phone PostgreSQL advisory lock, so messages for one customer remain
    # ordered while one slow Gemma call cannot block every other customer.
    workers = min(len(ids), int(settings.meta_reply_worker_concurrency))
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="reply") as pool:
        futures = [pool.submit(process_claim, engine, identifier, settings) for identifier in ids]
        for future in futures:
            try:
                future.result()
            except Exception:
                logger.error(
                    "Reply job thread failed",
                    extra={"step": "reply_recovery", "status": "worker_error"},
                )


async def recovery_loop(stop):
    while not stop.is_set():
        try:
            await asyncio.to_thread(recover_once, get_engine(), get_settings())
        except Exception as exc:
            # Keep diagnostics useful without logging provider responses, tokens,
            # customer text, or database URLs.
            logger.error(
                "Reply recovery poll failed",
                extra={
                    "step": "reply_recovery",
                    "status": "poll_error",
                    "error_type": type(exc).__name__,
                },
            )
        try:
            await asyncio.wait_for(
                stop.wait(), timeout=get_settings().meta_reply_worker_poll_seconds
            )
        except TimeoutError:
            pass
