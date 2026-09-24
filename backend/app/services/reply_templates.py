"""Reusable, keyed response text; dynamic customer data is never cached here."""

from sqlalchemy import select

from app.db.models import ReplyTemplate

DEFAULT_TEMPLATES = {
    "greeting": (
        "Hello! 👋 I'm ShopPal, your shopping assistant.\n\n"
        'To see what is available, send “What do you sell?” '
        "or tell me what you're looking for."
    ),
    "catalog_header": "*Here are some items available now:*",
    "catalog_footer": "Send the product name and quantity you'd like to order.",
    "catalog_empty": "There are no items available in this shop right now. Please check back soon.",
}


def load_templates(session):
    stored = dict(session.execute(
        select(ReplyTemplate.key, ReplyTemplate.body).where(
            ReplyTemplate.key.in_(DEFAULT_TEMPLATES)
        )
    ).all())
    return {
        key: stored[key] if isinstance(stored.get(key), str) and 0 < len(stored[key]) <= 1000 else default
        for key, default in DEFAULT_TEMPLATES.items()
    }
