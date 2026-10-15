from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.routers.transfer_email_review import decide_transfer, review_transfer
from app.services.transfer_email_links import (
    create_review_token,
    review_links,
    transfer_alert_html,
    verify_review_token,
)


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_review_links_are_signed_and_expire():
    merchant_id = uuid4()
    confirm, reject = review_links(merchant_id, "SHP-4F2K", "https://shop.example/webhooks/whatsapp", "secret")
    confirm_token = confirm.rsplit("/", 1)[1]
    reject_token = reject.rsplit("/", 1)[1]
    assert confirm.startswith("https://shop.example/email/transfers/")
    assert verify_review_token(confirm_token, "secret") == (merchant_id, "SHP-4F2K", "confirm")
    assert verify_review_token(reject_token, "secret") == (merchant_id, "SHP-4F2K", "reject")
    with pytest.raises(ValueError):
        verify_review_token(confirm_token + "x", "secret")
    expired = create_review_token(merchant_id, "SHP-4F2K", "confirm", "secret", now=0)
    with pytest.raises(ValueError):
        verify_review_token(expired, "secret", now=86401)


def test_email_html_has_review_buttons_and_escapes_content():
    html = transfer_alert_html("SHP-4F2K", "NGN 1,000", "<script>", "https://shop.example/confirm", "https://shop.example/reject")
    assert "Confirm payment" in html and "Reject payment" in html
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


@pytest.mark.anyio
async def test_opening_email_link_does_not_decide_transfer():
    merchant_id = uuid4()
    token = create_review_token(merchant_id, "SHP-4F2K", "confirm", "secret")
    row = SimpleNamespace(status="proof_received", amount=Decimal("1000"))
    session = SimpleNamespace(scalar=AsyncMock(return_value=row))
    settings = SimpleNamespace(key_encryption_secret=SimpleNamespace(get_secret_value=lambda: "secret"))
    response = await review_transfer(token, settings, session)
    assert response.status_code == 200
    assert b"Confirm payment" in response.body
    assert b'<form method="post">' in response.body


@pytest.mark.anyio
async def test_email_decision_requires_valid_token_and_calls_resolver_once():
    merchant_id = uuid4()
    merchant = SimpleNamespace(id=merchant_id)
    session = SimpleNamespace(get=AsyncMock(return_value=merchant))
    service = SimpleNamespace(client_for=Mock(return_value=None), resolve=AsyncMock(return_value=True))
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(bumpa_transfer_service=service)))
    settings = SimpleNamespace(key_encryption_secret=SimpleNamespace(get_secret_value=lambda: "secret"))
    token = create_review_token(merchant_id, "SHP-4F2K", "reject", "secret")
    response = await decide_transfer(token, request, settings, session)
    assert b"was rejected" in response.body
    service.resolve.assert_awaited_once_with(merchant, "SHP-4F2K", "REJECT", None)
    with pytest.raises(HTTPException) as exc:
        await decide_transfer(token + "x", request, settings, session)
    assert exc.value.status_code == 400
