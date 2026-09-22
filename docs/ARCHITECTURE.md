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
