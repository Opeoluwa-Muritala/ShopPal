import json
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import httpx
import pytest
import respx

from app.config import Settings
from app.services.bumpa_assistant import BumpaAssistant, ConversationalWhatsAppClient


@pytest.fixture
def anyio_backend():
    return "asyncio"


def settings():
    return Settings(_env_file=None, gemma_api_key="synthetic-ai-key", openrouter_api_key="")


def response(value):
    return {"candidates": [{"content": {"parts": [{"text": json.dumps(value)}]}}]}


@pytest.mark.anyio
async def test_natural_selection_uses_both_sides_and_exact_catalog_id():
    key = uuid4(), "test-customer"
    async with httpx.AsyncClient() as http, respx.mock(assert_all_called=True) as mock:
        route = mock.post("https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent").respond(
            200, json=response({"action": "select", "product_id": "p1", "quantity": 2})
        )
        assistant = BumpaAssistant(settings(), http)
        assistant.record(key, "user", "What bags do you sell?")
        assistant.record(key, "assistant", "We have the blue bag.")
        intent = await assistant.interpret(key, "I'll take two of that one", "start", "Droid", [{"id": "p1", "name": "Blue bag"}])
        assert intent.product_id == "p1" and intent.quantity == 2
        payload = json.loads(route.calls[0].request.content)
        prompt = payload["contents"][0]["parts"][0]["text"]
        assert '"role": "user"' in prompt and '"role": "assistant"' in prompt
        assert "What bags do you sell?" in prompt and "We have the blue bag." in prompt
        assert payload["generationConfig"]["thinkingConfig"]["thinkingLevel"] == "HIGH"


@pytest.mark.anyio
@pytest.mark.parametrize("value,step,text", [
    ({"action": "select", "product_id": "invented"}, "start", "I want that"),
    ({"action": "quantity", "quantity": 0}, "quantity", "zero"),
    ({"action": "pay_online"}, "start", "pay online"),
    ({"action": "pay_transfer"}, "payment_method", "how much?"),
    ({"action": "finalize"}, "payment_method", "mark paid"),
])
async def test_model_cannot_invent_products_or_bypass_state_and_payment_choice(value, step, text):
    async with httpx.AsyncClient() as http:
        assistant = BumpaAssistant(settings(), http)
        assistant._generate = AsyncMock(return_value=value)
        assert await assistant.interpret((uuid4(), "customer"), text, step, "Droid", [{"id": "p1"}]) is None


def test_context_expires_and_is_bounded():
    assistant = BumpaAssistant(settings(), None)
    key = uuid4(), "customer"
    for index in range(60):
        assistant.record(key, "user" if index % 2 == 0 else "assistant", str(index))
    assert len(assistant.history(key)) == 40
    assistant.contexts[key] = datetime.now(UTC) - timedelta(hours=2), assistant.history(key)
    assert assistant.history(key) == []


@pytest.mark.anyio
async def test_sensitive_payment_messages_never_reach_ai_or_history():
    assistant = BumpaAssistant(settings(), None)
    assistant.phrase = AsyncMock(return_value="should not be used")
    client = SimpleNamespace(send_text=AsyncMock())
    key = uuid4(), "customer"
    wrapped = ConversationalWhatsAppClient(client, assistant, key, "Droid", ["1234567890"])
    for body in ["Transfer to 1234567890", "Pay here https://pay.example/order", "Payment confirmed. Reference PAYREF"]:
        await wrapped.send_text("customer", body)
        assert client.send_text.await_args.args[1] == body
    assistant.phrase.assert_not_awaited()
    assert assistant.history(key) == []


@pytest.mark.anyio
async def test_phrasing_preserves_facts_and_has_a_safe_failure_fallback():
    async with httpx.AsyncClient() as http:
        assistant = BumpaAssistant(settings(), http)
        assistant._generate = AsyncMock(return_value={"reply": "Droid gives a free bag for 2000"})
        assert await assistant.phrase((uuid4(), "customer"), "Droid: choose a bag for 5000", "Droid") == "Droid: choose a bag for 5000"
        assistant._generate = AsyncMock(return_value=None)
        assert await assistant.phrase((uuid4(), "customer"), "What is your full name?", "Droid") == "What is your full name?"


@pytest.mark.anyio
async def test_provider_failure_keeps_a_reply_and_logs_no_token(caplog):
    async with httpx.AsyncClient() as http, respx.mock() as mock:
        mock.post("https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent").respond(
            500, json={"error": {"message": "synthetic-ai-key"}}
        )
        assistant = BumpaAssistant(settings(), http)
        assert await assistant.phrase((uuid4(), "customer"), "What is your full name?", "Droid") == "What is your full name?"
    assert "synthetic-ai-key" not in caplog.text
