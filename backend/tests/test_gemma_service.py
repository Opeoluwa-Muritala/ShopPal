from unittest.mock import Mock, patch

from app.config import Settings
from app.services.llm import MASTER_PROMPT, TOOL_DECLARATIONS, LLMService
from app.services.transcription import transcribe_audio


def _settings():
    return Settings(
        _env_file=None,
        gemma_api_key="gemma-test-key",
        groq_api_key="groq-test-key",
    )


def test_gemma_executes_allowlisted_customer_tool_then_returns_reply():
    service = LLMService(_settings())
    service._post = Mock(
        side_effect=[
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {
                                    "functionCall": {
                                        "name": "searchProducts",
                                        "args": {"query": "shoe"},
                                    }
                                }
                            ]
                        }
                    }
                ]
            },
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [
                                {"text": "<answer>I found one black shoe for you.</answer>"}
                            ]
                        }
                    }
                ]
            },
        ]
    )
    dispatcher = Mock(return_value={"products": [{"name": "Black shoe"}]})

    reply, calls = service.ask("You get black shoe?", dispatcher)

    assert reply == "I found one black shoe for you."
    assert calls == [{"name": "searchProducts", "arguments": {"query": "shoe"}}]
    dispatcher.assert_called_once_with("searchProducts", {"query": "shoe"})


def test_gemma_tools_exclude_admin_and_dashboard_actions():
    names = {tool["name"] for tool in TOOL_DECLARATIONS}
    assert names == {
        "searchProducts",
        "viewCart",
        "addToCart",
        "updateCartItem",
        "removeCartItem",
        "checkoutCart",
    }
    assert "dashboard" in MASTER_PROMPT
    assert "customer" in MASTER_PROMPT.lower()


def test_natural_stock_question_selects_catalog_tool_without_exact_words():
    service = LLMService(_settings())
    action = service.next_action("abeg wetin dey available for perfume?", [], [])
    assert action == {"tool": "searchProducts", "arguments": {"query": ""}}


def test_bare_cart_and_checkout_commands_are_safe_tools():
    service = LLMService(_settings())
    assert service.next_action("my cart", [], []) == {
        "tool": "viewCart",
        "arguments": {},
    }
    assert service.next_action("checkout", [], []) == {
        "tool": "viewCart",
        "arguments": {},
    }


def test_natural_product_selection_uses_latest_catalog_result():
    service = LLMService(_settings())
    transcript = [
        {
            "action": {"tool": "searchProducts", "arguments": {"query": ""}},
            "result": {
                "products": [
                    {"product_id": "00000000-0000-0000-0000-000000000001", "name": "Oud perfume", "price": "12000"}
                ]
            },
        }
    ]
    action = service.next_action("I want two bottles of the Oud perfume", [], transcript)
    assert action == {
        "tool": "addToCart",
        "arguments": {"productId": "00000000-0000-0000-0000-000000000001", "quantity": 2},
    }


def test_image_match_uses_inline_image_and_catalog():
    service = LLMService(_settings())
    service._post = Mock(
        return_value={
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "text": (
                                    "<answer>Is this what you're looking for? "
                                    "Looks like our Bag (₦5000). Reply '1' if yes "
                                    "or tell me what you're actually looking for!</answer>"
                                )
                            }
                        ]
                    }
                }
            ]
        }
    )

    reply = service.match_product_image(
        b"image-bytes",
        "image/jpeg",
        [{"name": "Bag", "price": "5000.00"}],
    )

    payload = service._post.call_args.args[0]
    inline = payload["contents"][0]["parts"][1]["inlineData"]
    assert inline["mimeType"] == "image/jpeg"
    assert inline["data"]
    assert "Looks like our Bag (₦5000)" in reply


@patch("app.services.transcription.httpx.post")
def test_voice_uses_groq_whisper(mock_post):
    response = Mock()
    response.json.return_value = {"text": "I want two bags"}
    response.raise_for_status.return_value = None
    mock_post.return_value = response

    text = transcribe_audio(b"voice", "audio/ogg", _settings())

    assert text == "I want two bags"
    assert "audio/transcriptions" in mock_post.call_args.args[0]
    assert mock_post.call_args.kwargs["data"]["model"] == "whisper-large-v3-turbo"
