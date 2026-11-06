import hashlib
import hmac
import json
import time

import pytest
from pydantic import ValidationError

from app.routers.blaaiz import CardCollectionRequest, verify_signature


def test_blaaiz_signature_checks_raw_body_and_timestamp():
    body = json.dumps({"event": "collection.completed"}, separators=(",", ":")).encode()
    timestamp = str(int(time.time()))
    signature = hmac.new(
        b"webhook-secret", timestamp.encode() + b"." + body, hashlib.sha256
    ).hexdigest()

    assert verify_signature(body, timestamp, signature, "webhook-secret") is True
    assert verify_signature(body + b" ", timestamp, signature, "webhook-secret") is False
    assert verify_signature(body, str(int(timestamp) - 301), signature, "webhook-secret") is False


def test_blaaiz_card_secrets_are_redacted():
    request = CardCollectionRequest(
        order_code="ORDER123",
        customer_id="customer-1",
        card_holder_name="Demo Customer",
        card_number="4242424242424242",
        expiry="12/30",
        cvc="123",
        phone="+2348012345678",
    )

    assert "4242424242424242" not in repr(request)
    assert "cvc='123'" not in repr(request)


@pytest.mark.parametrize(
    ("field", "value"),
    [("card_number", "4242"), ("cvc", "12"), ("expiry", "13/30")],
)
def test_blaaiz_rejects_malformed_card_fields(field, value):
    payload = {
        "order_code": "ORDER123",
        "customer_id": "customer-1",
        "card_holder_name": "Demo Customer",
        "card_number": "4242424242424242",
        "expiry": "12/30",
        "cvc": "123",
    }
    payload[field] = value
    with pytest.raises(ValidationError):
        CardCollectionRequest(**payload)
