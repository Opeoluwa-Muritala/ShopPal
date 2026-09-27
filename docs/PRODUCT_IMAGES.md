# Product images

Create a product using authenticated `POST /api/products/with-image` with multipart
fields `name`, `price`, `stock`, optional `description`, and `image` (file).
Use the same bearer token and frontend API key as other vendor endpoints.
The JSON `POST /api/products` remains available for existing clients.

JPEG, PNG and WebP are accepted up to 8 MiB and 25 million pixels. The backend
checks the declared type against the decoded format, rejects corrupt files,
removes metadata, resizes to at most 1600 pixels on either axis, and stores JPEG
bytes in `whatsapp_media.content`. `products.image_media_id` links the image.
The returned image URL requires vendor authentication; it is not a public Meta URL.

Run `alembic upgrade head` before starting the updated backend. Install backend
requirements including Pillow. No frontend changes are included.

The Meta reply worker exposes `showProductImage` to the shopping assistant.
When a customer requests a product photo, the tool resolves a product within the
conversation's vendor. The worker rechecks ownership, uploads its stored bytes
to Meta and sends an image message. The regular catalog remains text.
Each outbound send performs a fresh upload; inbound media IDs are never reused.

For direct backend use, after authorizing the selected product for the vendor:

```python
from app.services.whatsapp import send_whatsapp_product_image

result = await send_whatsapp_product_image(
    session, str(product.id), recipient_number, caption=product.name
)
if result.get("ok") is False:
    # Record a failed notification; a send timeout can mean delivery is unknown.
    # Do not blindly retry, as that could send duplicates.
    pass
```

`send_whatsapp_image_from_db(session, media_row_id, recipient_number, caption)`
is also available. Missing rows raise `LookupError`. Meta errors return an error
dictionary and log the response body with credentials and recipient redacted.
An API acceptance response does not prove delivery; delivery is confirmed by
Meta status webhooks.

`scripts/seed_demo_vendor.py` targets `demo.perfumes@shoppal.ng`, preserves the
existing password, and seeds 20 demo perfumes in four families stored in product
descriptions. Photos are illustrative Unsplash perfume photographs, with some
reused across fictional fragrances. Sources: https://unsplash.com/s/photos/perfume-bottle
and the fixed `images.unsplash.com` identifiers in the seed script. All images
are downloaded, validated, compressed, and stored in Postgres before use.
