"""The Bumpa path must persist catalog data and thin transaction references only."""

from app.db.models import Base, Vendor


def test_bumpa_tables_and_legacy_default():
    assert Vendor.__table__.c.catalog_provider.server_default.arg.text == "'legacy'"
    assert {
        "bumpa_connections", "products_cache", "sync_state", "checkout_refs",
        "pending_transfers", "conversation_state", "processed_messages",
        "whatsapp_opt_outs",
    } <= set(Base.metadata.tables)


def test_checkout_reference_has_no_customer_profile_or_basket():
    columns = set(Base.metadata.tables["checkout_refs"].columns.keys())
    assert {"merchant_id", "bumpa_checkout_id", "bumpa_order_id", "payment_reference"} <= columns
    assert not columns.intersection({"customer_name", "email", "address", "items", "line_items"})


def test_product_cache_retains_raw_response_for_remapping():
    columns = set(Base.metadata.tables["products_cache"].columns.keys())
    assert {"merchant_id", "bumpa_product_id", "raw", "synced_at"} <= columns
