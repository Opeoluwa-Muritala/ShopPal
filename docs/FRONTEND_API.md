# Frontend API map

The frontend uses the deployed backend base URL from `NEXT_PUBLIC_API_URL`.
Interactive request and response schemas are available at `/docs` and
`/openapi.json` on that backend.

## Public and provider routes

| Method | Endpoint | Frontend use |
| --- | --- | --- |
| GET | `/api/health` | Service health check |
| GET | `/privacy` | Meta and app privacy-policy link |
| GET | `/webhooks/whatsapp` | Meta verification; provider-only, not a frontend call |
| POST | `/webhooks/whatsapp` | Meta events; provider-only, not a frontend call |

## Vendor and commerce routes

Authenticated requests require the API key and account credentials described by
the OpenAPI security scheme.

| Method | Endpoint | Frontend use |
| --- | --- | --- |
| POST | `/api/vendors/signup` | Create a vendor and import its first catalog |
| GET/POST | `/api/products` | List or create catalog products |
| POST | `/api/products/with-image` | Create a product with a multipart image upload |
| GET | `/api/products/{product_id}/image` | Read stored image bytes; vendor authentication required |
| POST | `/api/products/upload-csv` | Import catalog CSV |
| GET | `/api/orders` | List a vendor's orders and pending carts |
| PATCH | `/api/orders/{order_id}` | Update an order status |
| GET | `/api/orders/payment-reviews` | List payments requiring vendor review |
| POST | `/api/orders/{order_id}/confirm-payment` | Confirm payment for an owned order |
| GET | `/api/vendors/me` | Read the authenticated vendor profile |

### Product image upload

Send `multipart/form-data` to `/api/products/with-image` with `name`, `price`,
`stock`, optional `description`, and the `image` file. Include the bearer token
and configured `X-API-Key`. Accepts JPEG/PNG/WebP up to 8 MiB and 25 million
pixels; validates decoded content and compresses to metadata-free JPEG with a
maximum dimension of 1600 pixels. Bytes are stored in Postgres.

Returns HTTP 201 with `id`, `name`, `price`, `stock`, `image_url`,
`has_uploaded_image`, and `status`. Invalid images return 422; unavailable
storage returns 503. The image URL is authenticated and must be fetched with
vendor credentials. It is not a public URL for WhatsApp: the bot sends stored
bytes using Meta's media upload API. Existing JSON creation remains supported.
See [product image guide](PRODUCT_IMAGES.md) for migration and sender usage.

## Accounts and authentication

| Method | Endpoint | Frontend use |
| --- | --- | --- |
| POST | `/api/auth/login` | Sign in and obtain tokens |
| POST | `/api/auth/refresh` | Rotate an access token |
| POST | `/api/auth/logout` | Revoke the current refresh token |
| POST | `/api/auth/logout-all` | Revoke all account sessions |
| POST | `/api/auth/forgot-password` | Start password recovery |
| POST | `/api/auth/reset-password` | Complete password recovery |
| POST | `/api/accounts/invite-staff` | Owner-only staff invitation |

The frontend must derive vendor and account scope from the authenticated session;
it must not trust a client-supplied vendor or account identifier for access
control.
