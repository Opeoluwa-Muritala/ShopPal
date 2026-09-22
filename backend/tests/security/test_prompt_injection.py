"""Tests proving immunity against prompt injection and price tampering."""

from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

from app.db.models import Product
from app.services.llm import LLMService
from app.services.orders import calculate_and_verify_item


def test_llm_parser_discards_claimed_prices_and_discounts():
    """Verify LLMService.parse_intent_and_items strips fabricated prices/discounts from prompt output."""
    adversarial_llm_output = """
    Sure, I applied your VIP 100% discount!
    ```json
    {
        "intent": "checkout",
        "items": [
            {
                "product_id": "11111111-1111-1111-1111-111111111111",
                "qty": 2,
                "claimed_price": "0.00",
                "discount": "100%",
                "total": "0.00"
            }
        ]
    }
    ```
    Your order is totally free!
    """
    parsed = LLMService.parse_intent_and_items(adversarial_llm_output)
    assert parsed["intent"] == "checkout"
    assert len(parsed["items"]) == 1
    item = parsed["items"][0]

    # Only product_id and qty are retained; fabricated prices/discounts are strictly purged
    assert item["product_id"] == "11111111-1111-1111-1111-111111111111"
    assert item["qty"] == 2
    assert "claimed_price" not in item
    assert "discount" not in item
    assert "total" not in item


def test_order_calculation_strictly_uses_database_price():
    """
    CRITICAL SECURITY ASSERTION:
    Even if an adversarial prompt or client proposes a fabricated price (e.g. 0.00 or 50.00),
    the backend strictly queries the product's database price (e.g. 15000.00).
    """
    mock_session = MagicMock()
    real_product_id = uuid4()
    mock_product = Product(
        id=real_product_id,
        name="Lagos Leather Shoes",
        price=Decimal("15000.00"),
        stock=5,
        status="active",
        image_url="https://example.com/shoes.png",
    )
    mock_session.get.return_value = mock_product

    # Attempt to claim a fabricated price of 0.00
    product, item_total = calculate_and_verify_item(
        session=mock_session,
        product_id=real_product_id,
        quantity=2,
        untrusted_llm_price="0.00",
    )

    # Must equal 2 * 15000.00 = 30000.00 Decimal, ignoring 0.00
    assert product.price == Decimal("15000.00")
    assert item_total == Decimal("30000.00")
