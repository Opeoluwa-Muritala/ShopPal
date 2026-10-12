import io
from datetime import UTC, datetime
from decimal import Decimal

from PIL import Image

from app.services.receipt_images import render_payment_receipt


def test_render_payment_receipt_is_valid_bounded_png():
    content = render_payment_receipt(
        business_name="Demo Store",
        order_reference="ord-123",
        amount=Decimal("12500.00"),
        items=[{"name": "Perfume", "qty": 2}],
        paid_at=datetime(2026, 10, 2, 12, 0, tzinfo=UTC),
    )
    assert len(content) < 1_000_000
    with Image.open(io.BytesIO(content)) as image:
        assert image.format == "PNG"
        assert image.size == (1080, 720)
