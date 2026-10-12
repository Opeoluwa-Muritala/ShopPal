# WhatsApp basket

Select a product by picker or exact name. Shoppal checks the product live,
shows its photo once, and adds quantity 1 to the temporary basket. Answer
YES to browse again or NO to choose payment. Selecting the same product
again increases its quantity, subject to available stock.

Send CART to view or edit items. Choose an item and enter its new quantity;
0 removes it. Quantity edits do not resend the photo. Online shipping and
checkout include every basket item in one Bumpa cart. Bank transfers retain
the existing single-product reference schema; a multi-product basket must
use online checkout.

Sending a payment link clears collected personal details but retains the
basket. It becomes read-only while payment is pending. Confirmed online
payment or an owner's verified transfer confirmation clears the matching
basket. An older payment cannot clear a newer basket. CANCEL or START OVER
explicitly discards a basket. Unpaid temporary baskets expire after 24 hours.

During an unfinished checkout, MENU and adding items preserve the customer's
name and email in the existing one-hour memory window. Online checkout asks
only for missing details; retries reuse the supplied email. CANCEL, START
OVER, successful checkout creation and expiry remove these details. Bumpa
requires a real email for payment intent; Shoppal does not invent one or
store it in a customer profile.

Send MY ORDERS for live status of up to five recent Bumpa checkouts tied to
the same merchant and WhatsApp number. These are thin checkout references,
not a local order-management ledger. Transfer sales are recorded by the
owner in Bumpa and cannot be linked until Bumpa supplies an order reference.

Basket item IDs and quantities are bounded process memory, never database
line-item history. The database retains the current selection, basket count,
step and payment/transfer reference only. TODO(BUMPA_SHARED_BASKETS): a
restart discards temporary baskets; multiple workers require an encrypted,
expiring shared transient store. No persistent basket/order table is added.

For Droid's exact demo merchant and the 40 titles from the approved import
pack, the original public demo image URLs replace the inaccessible imported
Bumpa image URLs. This affects photos only, not inventory or prices. WebP
images from the allowlisted public CDN or raw GitHub host are size-limited,
validated and converted to JPEG in memory before upload to Meta. Shoppal
stores neither downloaded image bytes nor Meta media IDs. Other merchants
continue using their Bumpa photos. TODO(DROID_BUMPA_IMAGES): remove the demo
fallback once Bumpa's original images are publicly fetchable.
