# System Architecture — Naija Marketplace (EcomBot)

This document details the architectural layout, data flow, and core component responsibilities for the Naija Marketplace platform.

---

## High-Level System Architecture Diagram

```
[ Customer (WhatsApp) ]
          │
          │ 1. Sends product inquiry / order intent (WhatsApp chat)
          ▼
[ Twilio / WhatsApp Business API Gateway ]
          │
          │ 2. HTTP POST webhook event (/api/webhook/whatsapp)
          ▼
[ FastAPI Backend Application ]
    │
    ├── 3. Retrieve or store multi-turn chat session & cart ──────────► [ Redis 7 Cache ]
    │
    ├── 4. Grounded product query & intent extraction (Pidgin/EN) ────► [ Anthropic Claude 3.5 API ]
    │
    ├── 5. Query / Update products, vendors, and orders ──────────────► [ PostgreSQL Database ]
    │
    └── 6. Generate checkout link & verify payment status ────────────► [ Paystack API / Webhooks ]
          ▲
          │ 7. REST API (JWT Auth, product CRUD, CSV upload, order stats)
          │
[ Next.js Vendor Dashboard (Web & Mobile Browser) ]
    ├── Merchant Signup & Login
    ├── Product Catalog Management (Manual & CSV Upload)
    ├── Orders Monitoring & Status Updates
    └── Analytics & Business Metrics
```

---

## Component Table

| Component | Responsibility | Tech Stack | Communication |
| --- | --- | --- | --- |
| **Customer Interface** | Conversational chat interface for Nigerian shoppers | WhatsApp Client | Mobile network / WhatsApp Protocol |
| **Messaging Gateway** | Inbound message webhook delivery and outbound message sending | Twilio WhatsApp Sandbox / API | HTTPS Webhooks & REST |
| **Backend API Engine** | Handles webhook ingestion, business logic, routing, auth | FastAPI (Python 3.11), Uvicorn | REST, Async I/O |
| **Conversational AI** | Intent recognition, catalog discovery, natural Nigerian dialogues | Anthropic Claude API (Claude 3.5 Sonnet) | HTTPS REST API |
| **Data Persistence** | Relational store for merchants, products, orders, and transaction records | PostgreSQL 15, SQLAlchemy / SQLModel | TCP / Connection Pool |
| **Session & State Cache** | Multi-turn chat context, cart state, rate limits | Redis 7 | In-memory key-value |
| **Payment Gateway** | Generation of checkout links, payment verification, webhook callbacks | Paystack Payments API | HTTPS REST & Signed Webhooks |
| **Vendor Dashboard** | Merchant signup, CSV inventory upload, orders management, analytics | Next.js 14, React 18, Tailwind CSS | HTTPS REST API |

---

## Key Data Flows

### A. WhatsApp Product Inquiry & Cart Flow
1. **Inbound Message**: Customer sends a message on WhatsApp (e.g., *"How far, you get Nike sneakers size 43?"*).
2. **Webhook Ingestion**: Twilio delivers the payload to `POST /api/webhook/whatsapp`.
3. **Context & State Retrieval**: Backend retrieves conversation history and cart state from Redis.
4. **LLM Grounding**: Backend formats the prompt with the vendor's catalog and queries Claude 3.5.
5. **Catalog Match & Response**: Claude returns a natural language response with matching product items and prices in NGN.
6. **Outbound Message**: Twilio sends the WhatsApp message back to the customer.

### B. Checkout & Payment Flow
1. **Checkout Trigger**: Customer confirms purchase intent (*"I wan buy"*).
2. **Order & Link Creation**: Backend registers order in PostgreSQL (`status: pending`) and requests a payment authorization URL from Paystack.
3. **Payment Execution**: Customer clicks the Paystack link in WhatsApp and completes payment.
4. **Webhook Confirmation**: Paystack triggers `POST /api/webhook/paystack`. Backend marks order as `paid`.
5. **Customer & Merchant Notification**: Backend sends WhatsApp receipt to customer and updates the vendor dashboard order status in real time.

---

## Authentication & Account Security Architecture (Stage 6)

### 1. Dual-Token JWT Architecture
- **Access Tokens (15-Minute Expiry)**: Cryptographically signed via HMAC-SHA256 (`alg: HS256`). Payloads carry `sub` (account UUID), `vendor_id` (vendor UUID), `role` (`owner` or `staff`), and `exp`. Short lifetime limits exposure if intercepted.
- **Refresh Tokens (7-Day Expiry)**: High-entropy opaque tokens (48-byte URL-safe string generated via `secrets.token_urlsafe(48)`). Only their SHA-256 hash is persisted in the `refresh_tokens` database table.
- **Token Rotation & Replay Detection**: Every invocation of `POST /api/auth/refresh` invalidates the submitted token and issues a new access/refresh pair. If an already-revoked or expired refresh token is presented (indicating a stolen token replay attack), the system automatically revokes **ALL** active refresh tokens for that account, terminating all active sessions.

### 2. Tenant Isolation & IDOR Elimination
- **Complete Elimination of Client-Supplied Vendor IDs**: Replaced the temporary `X-Vendor-API-Key` header with JWT Bearer authentication.
- **Strict Token Scoping**: All vendor-scoped endpoints (`/api/products`, `/api/orders`, `/api/products/upload-csv`) derive `vendor_id` strictly from `current_account.vendor_id` in the authenticated JWT token. Any `vendor_id` provided in query strings or JSON request bodies is completely ignored or overridden.
- **Cross-Tenant Mutation Defense**: Handlers verify ownership before modifying any resource (`PATCH /api/orders/{id}`). Cross-vendor modifications raise `403 Forbidden`.

### 3. Account Hierarchy & Role-Based Access Control (RBAC)
- **Owner (`role="owner"`)**: Automatically provisioned upon vendor registration (`POST /api/vendors/signup`). Granted full permissions: catalog management, order processing, staff invitation (`POST /api/accounts/invite-staff`), and store settings.
- **Staff (`role="staff"`)**: Provisioned via owner invite. Granted operational permissions: view catalog, manage and fulfill orders. Strictly forbidden from inviting staff, modifying vendor configuration, or accessing billing (enforced via `get_current_owner` dependency returning `403 Forbidden`).

### 4. Password Security & Rate Limiting
- **PBKDF2-HMAC-SHA256**: Passwords hashed with 100,000 iterations and 32-byte cryptographically secure random salts.
- **Password Strength Policy**: Minimum 8 characters, at least one numerical digit, and at least one special character; non-conforming passwords rejected with HTTP 422.
- **Anti-Brute-Force Rate Limiting**: 5 failed login attempts per 15-minute sliding window per IP/email. Exceeding triggers HTTP 429 Too Many Requests.
- **Enumeration Defense**: Unified generic error messages (`"Invalid email or password"`) and constant-time hash comparisons prevent timing side-channels and user enumeration.
- **Secure Password Reset**: 1-hour cryptographic single-use reset tokens (`POST /api/auth/forgot-password` and `POST /api/auth/reset-password`). Password changes instantly revoke all active refresh tokens across all devices. Email delivery is cleanly stubbed and logged for hackathon presentation without external SMTP dependencies.

