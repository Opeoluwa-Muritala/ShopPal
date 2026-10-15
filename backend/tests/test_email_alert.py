from unittest.mock import AsyncMock

import httpx
import pytest

from app.services.email_alert import send_email


@pytest.mark.anyio
async def test_send_email_never_raises_on_http_failure():
    http_client = AsyncMock()
    http_client.post.side_effect = httpx.HTTPError("boom")
    await send_email(http_client, "https://emailope.vercel.app/", "owner@example.com", "subject", "text")


@pytest.mark.anyio
async def test_send_email_reports_rejected_response(caplog):
    transport = httpx.MockTransport(lambda _request: httpx.Response(503))
    async with httpx.AsyncClient(transport=transport) as http_client:
        await send_email(http_client, "https://emailope.vercel.app/", "owner@example.com", "subject", "text")
    assert "Failed to send email alert" in caplog.text


@pytest.mark.anyio
async def test_html_alert_uses_existing_email_service():
    http_client = AsyncMock()
    http_client.post.return_value = httpx.Response(202, request=httpx.Request("POST", "https://emailope.vercel.app/"))
    await send_email(
        http_client, "https://emailope.vercel.app/", "owner@example.com", "Review transfer", "Plain text",
        html="<a href='https://shop.example/review'>Confirm</a>",
    )
    args, kwargs = http_client.post.await_args
    assert args[0] == "https://emailope.vercel.app/"
    assert kwargs["json"]["html"].startswith("<a ")
    assert kwargs["json"]["text"] == "Plain text"
