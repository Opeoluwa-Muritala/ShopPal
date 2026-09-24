from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Event
from unittest.mock import Mock
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.models import (
    Cart,
    Conversation,
    Order,
    Product,
    ReplyJob,
    ReplyToolResult,
    Vendor,
    WhatsAppMessage,
)
from app.main import app
from app.routers.whatsapp_webhook import _persist_messages, _update_reply_status
from app.services import reply_recovery as recovery
from app.services.llm import GemmaError, LLMService


@pytest.fixture
def setup_job(test_engine):
    with Session(test_engine) as session:
        vendor = Vendor(
            name="Reply test",
            phone=uuid4().hex[:20],
            whatsapp_number="2340000000000",
            bot_number="+234 911 050 1393",
            business_name="Perfumes",
            is_active=True,
        )
        session.add(vendor)
        session.flush()
        product = Product(
            vendor_id=vendor.id,
            name="Oud",
            price=100,
            stock=5,
            image_url="https://example.com/perfume.jpg",
            status="active",
        )
        session.add(product)
        message_id = "wamid." + uuid4().hex
        phone = uuid4().hex[:20]
        _persist_messages(
            session,
            {
                "metadata": {
                    "display_phone_number": "2349110501393",
                    "phone_number_id": "123",
                },
                "messages": [
                    {
                        "id": message_id,
                        "from": phone,
                        "type": "text",
                        "timestamp": str(int(recovery.now().timestamp())),
                        "text": {"body": "Show perfumes"},
                    }
                ],
            },
        )
        session.flush()
        job = session.scalar(select(ReplyJob).where(ReplyJob.message_id == message_id))
        job.vendor_id = vendor.id
        session.commit()
        data = (job.id, product.id, vendor.id, message_id, phone)
    yield data
    with Session(test_engine) as session:
        session.execute(
            delete(WhatsAppMessage).where(WhatsAppMessage.message_id == message_id)
        )
        session.execute(delete(Vendor).where(Vendor.id == data[2]))
        session.commit()


@pytest.fixture
def settings():
    return Settings(
        _env_file=None,
        WHATSAPP_ACCESS_TOKEN="test",
        WHATSAPP_PHONE_NUMBER_ID="123",
        GEMMA_API_KEY="test",
    )


def row(engine, identifier):
    with Session(engine) as session:
        return session.get(ReplyJob, identifier)


def due(engine, identifier):
    with Session(engine) as session:
        job = session.get(ReplyJob, identifier)
        job.next_attempt_at = recovery.now() - timedelta(seconds=1)
        job.lease_until = None
        session.commit()


def accepted():
    return httpx.Response(200, json={"messages": [{"id": "out." + uuid4().hex}]})


def test_tool_commit_survives_gemma_failure_and_send_retry(
    test_engine, setup_job, settings, monkeypatch
):
    identifier, product_id, vendor_id, _, phone = setup_job
    agent = Mock(
        side_effect=[
            {
                "tool": "addToCart",
                "arguments": {"productId": str(product_id), "quantity": 2},
            },
            GemmaError("timeout"),
            {"reply": "Two bottles added."},
        ]
    )
    send = Mock(side_effect=[httpx.ConnectError("offline"), accepted()])
    monkeypatch.setattr(LLMService, "next_action", agent)
    monkeypatch.setattr(recovery.httpx, "post", send)
    recovery.process_claim(test_engine, identifier, settings)
    assert row(test_engine, identifier).state == "retry"
    due(test_engine, identifier)
    recovery.process_claim(test_engine, identifier, settings)
    assert row(test_engine, identifier).reply_text == "Two bottles added."
    due(test_engine, identifier)
    recovery.process_claim(test_engine, identifier, settings)
    assert row(test_engine, identifier).state == "accepted"
    assert agent.call_count == 3
    assert send.call_count == 2
    with Session(test_engine) as session:
        cart = session.scalar(
            select(Cart).where(
                Cart.vendor_id == vendor_id, Cart.customer_phone == phone
            )
        )
        assert cart.items[0]["qty"] == 2
        assert cart.items[0]["price"] == "100.00"
        assert (
            session.scalar(
                select(func.count())
                .select_from(ReplyToolResult)
                .where(ReplyToolResult.job_id == identifier)
            )
            == 1
        )
        conv = session.scalar(
            select(Conversation).where(Conversation.vendor_id == vendor_id)
        )
        assert conv.messages_this_session == 2


def test_two_workers_cannot_process_same_conversation(
    test_engine, setup_job, settings, monkeypatch
):
    entered, release = Event(), Event()

    def answer(*args):
        entered.set()
        assert release.wait(10)
        return {"reply": "Hello"}

    monkeypatch.setattr(LLMService, "next_action", answer)
    send = Mock(return_value=accepted())
    monkeypatch.setattr(recovery.httpx, "post", send)
    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(
            recovery.process_claim, test_engine, setup_job[0], settings
        )
        assert entered.wait(10)
        try:
            assert recovery.process_claim(test_engine, setup_job[0], settings) is False
        finally:
            release.set()
        assert first.result(timeout=10)
    assert send.call_count == 1


def test_ambiguous_send_waits_for_correlated_receipt(
    test_engine, setup_job, settings, monkeypatch
):
    monkeypatch.setattr(
        LLMService, "next_action", Mock(return_value={"reply": "Hello"})
    )
    send = Mock(side_effect=httpx.ReadTimeout("uncertain"))
    monkeypatch.setattr(recovery.httpx, "post", send)
    recovery.process_claim(test_engine, setup_job[0], settings)
    assert row(test_engine, setup_job[0]).state == "delivery_unknown"
    assert recovery.process_claim(test_engine, setup_job[0], settings) is False
    with Session(test_engine) as session:
        receipt = {
            "id": "out." + uuid4().hex,
            "recipient_id": setup_job[4],
            "status": "read",
            "timestamp": str(int(recovery.now().timestamp())),
            "biz_opaque_callback_data": str(setup_job[0]),
        }
        _update_reply_status(session, receipt)
        session.commit()
        _update_reply_status(session, dict(receipt, status="sent"))
        session.commit()
    assert row(test_engine, setup_job[0]).state == "read"
    assert row(test_engine, setup_job[0]).read_at is not None
    assert send.call_count == 1


@pytest.mark.parametrize(
    "state,expected", [("processing", "accepted"), ("sending", "delivery_unknown")]
)
def test_restart_reclaims_expired_lease(
    test_engine, setup_job, settings, monkeypatch, state, expected
):
    with Session(test_engine) as session:
        job = session.get(ReplyJob, setup_job[0])
        job.state = state
        job.lease_owner = str(uuid4())
        job.lease_until = recovery.now() - timedelta(minutes=10)
        session.commit()
    monkeypatch.setattr(
        LLMService, "next_action", Mock(return_value={"reply": "Recovered"})
    )
    monkeypatch.setattr(recovery.httpx, "post", Mock(return_value=accepted()))
    recovery.process_claim(test_engine, setup_job[0], settings)
    assert row(test_engine, setup_job[0]).state == expected


def test_expired_window_and_missing_vendor_require_review(
    test_engine, setup_job, settings, monkeypatch
):
    with Session(test_engine) as session:
        msg = session.scalar(
            select(WhatsAppMessage).where(WhatsAppMessage.message_id == setup_job[3])
        )
        msg.wa_timestamp = recovery.now() - timedelta(days=2)
        session.commit()
    send = Mock()
    monkeypatch.setattr(recovery.httpx, "post", send)
    monkeypatch.setattr(
        LLMService, "next_action", Mock(return_value={"reply": "Hello"})
    )
    recovery.process_claim(test_engine, setup_job[0], settings)
    assert row(test_engine, setup_job[0]).failure_category == "messaging_window"
    send.assert_not_called()


def test_expired_retry_uses_reengagement_template(
    test_engine, setup_job, settings, monkeypatch
):
    settings.whatsapp_reengagement_template_name = "3p_direct_integration_test_template"
    with Session(test_engine) as session:
        msg = session.scalar(
            select(WhatsAppMessage).where(WhatsAppMessage.message_id == setup_job[3])
        )
        msg.wa_timestamp = recovery.now() - timedelta(days=2)
        job = session.get(ReplyJob, setup_job[0])
        job.attempts = 2
        job.reply_text = "A previous reply was interrupted."
        session.commit()
    send = Mock(return_value=accepted())
    monkeypatch.setattr(recovery.httpx, "post", send)
    recovery.process_claim(test_engine, setup_job[0], settings)
    assert row(test_engine, setup_job[0]).state == "accepted"
    payload = send.call_args.kwargs["json"]
    assert payload["type"] == "template"
    assert payload["template"] == {
        "name": "3p_direct_integration_test_template",
        "language": {"code": "en_US"},
    }


def test_intake_failure_returns_retryable_503(monkeypatch):
    from app.config import get_settings
    from tests.test_whatsapp_webhook import (
        SAMPLE_MESSAGE_PAYLOAD,
        _settings,
        _signed_body,
    )

    app.dependency_overrides[get_settings] = _settings
    monkeypatch.setattr(
        "app.routers.whatsapp_webhook.process_whatsapp_payload",
        Mock(side_effect=RuntimeError("db down")),
    )
    body, signature = _signed_body(SAMPLE_MESSAGE_PAYLOAD)
    try:
        response = TestClient(app).post(
            "/webhooks/whatsapp",
            content=body,
            headers={"X-Hub-Signature-256": signature},
        )
    finally:
        app.dependency_overrides.pop(get_settings, None)
    assert response.status_code == 503
    assert "db down" not in response.text


@pytest.mark.parametrize(
    "action",
    [
        {"tool": "deleteProduct", "arguments": {}},
        {
            "tool": "addToCart",
            "arguments": {"productId": str(uuid4()), "quantity": True},
        },
        {
            "tool": "addToCart",
            "arguments": {"productId": str(uuid4()), "quantity": 1, "price": 1},
        },
        {"reply": "", "tool": "viewCart"},
    ],
)
def test_invalid_agent_actions_rejected(action):
    with pytest.raises(GemmaError):
        recovery.validate_action(action)


def test_checkout_does_not_repeat_after_provider_failure(
    test_engine, setup_job, settings, monkeypatch
):
    identifier, product_id, vendor_id, _, phone = setup_job
    actions = Mock(
        side_effect=[
            {
                "tool": "addToCart",
                "arguments": {"productId": str(product_id), "quantity": 1},
            },
            {"tool": "checkoutCart", "arguments": {"deliveryAddress": "Demo address"}},
            GemmaError("timeout"),
            {"reply": "Your order is ready"},
        ]
    )
    monkeypatch.setattr(LLMService, "next_action", actions)
    monkeypatch.setattr(recovery.httpx, "post", Mock(return_value=accepted()))
    recovery.process_claim(test_engine, identifier, settings)
    due(test_engine, identifier)
    recovery.process_claim(test_engine, identifier, settings)
    with Session(test_engine) as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(Order)
                .where(Order.vendor_id == vendor_id)
            )
            == 1
        )
        assert session.get(Product, product_id).stock == 4
    assert row(test_engine, identifier).state == "accepted"


def test_duplicate_intake_creates_one_job(test_engine, setup_job):
    with Session(test_engine) as session:
        _persist_messages(
            session,
            {
                "messages": [
                    {
                        "id": setup_job[3],
                        "from": setup_job[4],
                        "type": "text",
                        "text": {"body": "duplicate"},
                    }
                ]
            },
        )
        session.commit()
        assert (
            session.scalar(
                select(func.count())
                .select_from(ReplyJob)
                .where(ReplyJob.message_id == setup_job[3])
            )
            == 1
        )


def test_tool_and_receipt_rollback_together(
    test_engine, setup_job, settings, monkeypatch
):
    identifier, product_id, vendor_id, _, _ = setup_job
    checkpoint = recovery.checkpoint
    crashed = False

    def injected_crash(session, job, owner):
        nonlocal crashed
        if job.transcript and not crashed:
            crashed = True
            raise RuntimeError("crash before tool transaction commits")
        return checkpoint(session, job, owner)

    monkeypatch.setattr(recovery, "checkpoint", injected_crash)
    agent = Mock(
        side_effect=[
            {
                "tool": "addToCart",
                "arguments": {"productId": str(product_id), "quantity": 2},
            },
            {"reply": "Added two"},
        ]
    )
    monkeypatch.setattr(LLMService, "next_action", agent)
    monkeypatch.setattr(recovery.httpx, "post", Mock(return_value=accepted()))
    recovery.process_claim(test_engine, identifier, settings)
    with Session(test_engine) as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(ReplyToolResult)
                .where(ReplyToolResult.job_id == identifier)
            )
            == 0
        )
        assert (
            session.scalar(
                select(func.count())
                .select_from(Cart)
                .where(Cart.vendor_id == vendor_id)
            )
            == 0
        )
    due(test_engine, identifier)
    recovery.process_claim(test_engine, identifier, settings)
    with Session(test_engine) as session:
        assert (
            session.scalar(select(Cart).where(Cart.vendor_id == vendor_id)).items[0][
                "qty"
            ]
            == 2
        )
    assert row(test_engine, identifier).state == "accepted"


def test_poll_processes_due_job(test_engine, setup_job, settings, monkeypatch):
    monkeypatch.setattr(
        LLMService, "next_action", Mock(return_value={"reply": "Hello"})
    )
    monkeypatch.setattr(recovery.httpx, "post", Mock(return_value=accepted()))
    recovery.recover_once(test_engine, settings)
    assert row(test_engine, setup_job[0]).state == "accepted"


@pytest.mark.parametrize("body,expected", [("hello", "ShopPal"), ("hello what do you sell", "Oud")])
def test_quick_reply_sends_and_persists_history_without_ai(
    test_engine, setup_job, settings, monkeypatch, body, expected
):
    with Session(test_engine) as session:
        message = session.scalar(select(WhatsAppMessage).where(WhatsAppMessage.message_id == setup_job[3]))
        message.body = body
        session.commit()
    agent = Mock(side_effect=AssertionError("Quick replies must not call AI"))
    monkeypatch.setattr(LLMService, "next_action", agent)
    send = Mock(return_value=accepted())
    monkeypatch.setattr(recovery.httpx, "post", send)
    recovery.process_claim(test_engine, setup_job[0], settings)
    job = row(test_engine, setup_job[0])
    assert job.state == "accepted"
    assert expected in job.reply_text
    agent.assert_not_called()
    send.assert_called_once()
    with Session(test_engine) as session:
        history = session.scalar(select(Conversation).where(Conversation.vendor_id == setup_job[2])).message_history
        assert history[-2]["content"] == body
        assert history[-1]["content"] == job.reply_text


def test_missing_mapping_is_visible(test_engine, setup_job, settings):
    with Session(test_engine) as session:
        job = session.get(ReplyJob, setup_job[0])
        job.vendor_id = None
        job.display_number = "0000000000"
        session.commit()
    recovery.process_claim(test_engine, setup_job[0], settings)
    assert row(test_engine, setup_job[0]).failure_category == "vendor_mapping"
    assert row(test_engine, setup_job[0]).state == "needs_review"


def test_ai_failure_requires_review_without_repeating_ai(
    test_engine, setup_job, settings, monkeypatch
):
    monkeypatch.setattr(
        LLMService, "next_action", Mock(side_effect=GemmaError("timeout"))
    )
    recovery.process_claim(test_engine, setup_job[0], settings)
    assert row(test_engine, setup_job[0]).attempts == 1


def test_ai_cooldown_creates_saved_message_without_ai_call(
    test_engine, setup_job, settings, monkeypatch
):
    monkeypatch.setattr(recovery, "ai_cooldown_active", lambda: True)
    agent = Mock(side_effect=AssertionError("AI must not be called during cooldown"))
    monkeypatch.setattr(LLMService, "next_action", agent)
    monkeypatch.setattr(recovery.httpx, "post", Mock(return_value=accepted()))
    recovery.process_claim(test_engine, setup_job[0], settings)
    job = row(test_engine, setup_job[0])
    assert job.state == "accepted"
    assert "See available products" in job.reply_text
    assert "break" not in job.reply_text.lower()
    agent.assert_not_called()
    assert row(test_engine, setup_job[0]).state == "needs_review"
    due(test_engine, setup_job[0])
    recovery.process_claim(test_engine, setup_job[0], settings)
    assert row(test_engine, setup_job[0]).attempts == 1


@pytest.mark.parametrize(
    "code,expected", [(429, "retry"), (401, "needs_review"), (503, "delivery_unknown")]
)
def test_meta_http_failure_policy(
    test_engine, setup_job, settings, monkeypatch, code, expected
):
    monkeypatch.setattr(
        LLMService, "next_action", Mock(return_value={"reply": "Hello"})
    )
    monkeypatch.setattr(recovery.httpx, "post", Mock(return_value=httpx.Response(code)))
    recovery.process_claim(test_engine, setup_job[0], settings)
    assert row(test_engine, setup_job[0]).state == expected


def test_gemma_text_protocol_selects_and_validates_tool(settings):
    service = LLMService(settings)
    service._post = Mock(
        return_value={
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": '{"tool":"searchProducts","arguments":{"query":"perfume"}}'
                            }
                        ]
                    }
                }
            ]
        }
    )
    action = recovery.validate_action(service.next_action("Show perfumes", [], []))
    assert action["tool"] == "searchProducts"
    payload = service._post.call_args.args[0]
    assert "tools" not in payload
    assert "systemInstruction" not in payload


def test_gemma_credentials_do_not_enter_request_url(settings, monkeypatch):
    service = LLMService(settings)
    post = Mock(
        return_value=httpx.Response(
            200, json={}, request=httpx.Request("POST", service.url)
        )
    )
    monkeypatch.setattr("app.services.llm.httpx.post", post)
    service._post({"contents": []})
    assert "params" not in post.call_args.kwargs
    assert post.call_args.kwargs["headers"]["x-goog-api-key"] == "test"


def test_google_thought_parts_are_never_customer_output():
    response = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {"text": "Private reasoning", "thought": True},
                        {"text": '{"reply":"Hello!"}'},
                    ]
                }
            }
        ]
    }
    assert LLMService._parts(response) == [{"text": '{"reply":"Hello!"}'}]


def test_gemma4_uses_minimal_thinking_by_default(monkeypatch):
    service = LLMService(
        Settings(_env_file=None, GEMMA_API_KEY="test", GEMMA_MODEL="gemma-4-31b-it")
    )
    post = Mock(
        return_value=httpx.Response(
            200, json={}, request=httpx.Request("POST", service.url)
        )
    )
    monkeypatch.setattr("app.services.llm.httpx.post", post)
    service._post({"contents": []})
    assert post.call_args.kwargs["json"]["generationConfig"]["thinkingConfig"] == {
        "thinkingLevel": "MINIMAL"
    }
    assert post.call_args.kwargs["timeout"].read == 20


def test_review_is_read_only_and_does_not_expose_customer_content(
    test_engine, setup_job
):
    from app.services.reply_review import report

    result = report(test_engine)
    assert result["states"]["pending"] >= 1
    assert setup_job[4] not in str(result)
    assert "Show perfumes" not in str(result)
    assert row(test_engine, setup_job[0]).state == "pending"


def test_lost_lease_cannot_commit_tool_effects(
    test_engine, setup_job, settings, monkeypatch
):
    def stolen(*args):
        with Session(test_engine) as session:
            job = session.get(ReplyJob, setup_job[0])
            job.lease_owner = str(uuid4())
            session.commit()
        return {
            "tool": "addToCart",
            "arguments": {"productId": str(setup_job[1]), "quantity": 1},
        }

    monkeypatch.setattr(LLMService, "next_action", stolen)
    send = Mock()
    monkeypatch.setattr(recovery.httpx, "post", send)
    recovery.process_claim(test_engine, setup_job[0], settings)
    send.assert_not_called()
    with Session(test_engine) as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(Cart)
                .where(Cart.vendor_id == setup_job[2])
            )
            == 0
        )


def test_lifespan_starts_and_stops_enabled_worker(monkeypatch):
    import importlib

    main = importlib.import_module("app.main")
    seen = []

    async def worker(stop, wakeup):
        seen.append("started")
        await stop.wait()
        seen.append("stopped")

    monkeypatch.setattr(
        main,
        "get_settings",
        lambda: Settings(_env_file=None, META_REPLY_WORKER_ENABLED=True),
    )
    monkeypatch.setattr(main, "recovery_loop", worker)
    with TestClient(main.create_app()) as client:
        assert client.get("/api/health").status_code == 200
    assert seen == ["started", "stopped"]
