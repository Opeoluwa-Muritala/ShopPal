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
| PUT/DELETE | `/api/products/{product_id}` | Update or deactivate a product |
| GET | `/api/orders` | List a vendor's orders with optional status and limit |
| GET | `/api/orders/{order_id}` | Read one order |
| PATCH | `/api/orders/{order_id}` | Update an order status |

## Accounts and authentication

| Method | Endpoint | Frontend use |
| --- | --- | --- |
| POST | `/api/auth/login` | Sign in and obtain tokens |
| POST | `/api/auth/refresh` | Rotate an access token |
| POST | `/api/auth/logout` | Revoke the current refresh token |
| POST | `/api/auth/logout-all` | Revoke all account sessions |
| POST | `/api/auth/forgot-password` | Start password recovery |
| POST | `/api/auth/reset-password` | Complete password recovery |
| GET/PATCH | `/api/accounts/me` | Read or update the signed-in account |
| POST | `/api/accounts/invite-staff` | Owner-only staff invitation |

The frontend must derive vendor and account scope from the authenticated session;
it must not trust a client-supplied vendor or account identifier for access
control.
