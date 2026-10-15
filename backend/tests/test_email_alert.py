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
