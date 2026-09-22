# Product Requirements Document (PRD)
## Project: Naija Marketplace (EcomBot) — WhatsApp E-Commerce Bot

---

## 1. Executive Summary & Vision

**Naija Marketplace (EcomBot)** is an AI-powered conversational commerce platform built specifically for the Nigerian commerce ecosystem. Small and medium merchants in Nigeria rely predominantly on WhatsApp and Instagram for everyday business transactions, manually managing inventory, back-and-forth customer inquiries, manual bank transfer confirmations, and fragmented receipts.

EcomBot transforms WhatsApp into an automated, interactive digital storefront. Shoppers can search inventory, ask questions in Nigerian Pidgin or standard English, receive contextual recommendations, add items to cart, and checkout instantly via Paystack. Concurrently, merchants access a clean, modern web-based Vendor Dashboard to manage product catalogs via CSV upload or web forms, monitor live inventory, track incoming orders, and view transaction analytics.

---

## 2. Target Personas

### Persona A: Vendor (Ibrahim / Chidinma - Lagos Merchant)
- **Profile**: Sells fashion items, electronics, or provisions in Lagos / Abuja.
- **Pain Points**: Spends 6+ hours daily replying "How much?", "Is this available?", chasing bank transfer screenshots, and manually writing out customer addresses.
- **Needs**: Simple web dashboard to bulk-upload inventory via CSV or quick entry, manage orders in real-time, and let an automated agent close sales 24/7 on WhatsApp.

### Persona B: Shopper (Tunde / Amina - Everyday WhatsApp User)
- **Profile**: Tech-savvy mobile shopper who values speed and convenience.
- **Pain Points**: Hates waiting hours for sellers to respond with prices or account numbers, dealing with fake transfer disputes, or navigating cumbersome e-commerce apps with high data consumption.
- **Needs**: Conversational interaction on WhatsApp that understands natural Nigerian phrasing ("How much last?", "You get size 42?"), quick product cards, and instant payment links.

---

## 3. High-Level Architecture & Workflow

```
[ Customer (WhatsApp) ]
          │
          ▼  (Inbound message / Webhook)
[ Twilio / WhatsApp Business API ]
          │
          ▼  (HTTP POST /api/webhook/whatsapp)
[ FastAPI Backend Application ]
    ├── LLM Engine (Anthropic Claude 3.5 - Pidgin/English + System Prompt)
    ├── Inventory & Session Cache (Redis)
    ├── Relational Database (PostgreSQL)
    └── Payment Gateway (Paystack API & Webhooks)
          ▲
          │  (REST API / JWT Auth)
[ Next.js Vendor Dashboard (Web & Mobile) ]
    ├── Merchant Onboarding & Auth
    ├── Product Catalog Management (CSV / Form)
    └── Orders & Sales Real-time Monitoring
```

### Component Overview Table

| Component | Responsibility | Tech Stack |
| --- | --- | --- |
| **Customer Interface** | User conversational messaging interface | WhatsApp via Twilio Messaging API |
| **Messaging Gateway** | Inbound/outbound WhatsApp message delivery & webhooks | Twilio Sandbox for WhatsApp |
| **Backend Engine** | Webhook intake, session state, business rules, DB transactions | Python 3.11, FastAPI, SQLAlchemy / SQLModel |
| **Conversational AI** | Intent recognition, catalog discovery, natural Nigerian dialogues | Anthropic Claude API (Claude 3.5 Sonnet) |
| **Data Persistence** | Relational store for merchants, products, orders, and logs | PostgreSQL 15 |
| **Session & State Cache** | Multi-turn chat context, cart state, rate limits | Redis 7 |
| **Payment Gateway** | Generation of checkout links, payment verification, webhook callbacks | Paystack Payments API |
| **Vendor Dashboard** | Merchant signup, CSV inventory upload, orders management, analytics | Next.js 14, React 18, Tailwind CSS |

---

## 4. Key Functional Features

### 4.1 Vendor Management & Web Portal
1. **Vendor Signup & Authentication**: Fast email/password registration with business profile creation.
2. **Product Catalog Management**:
   - Web entry form for single products (Title, Description, Price in NGN, Stock Quantity, Image URL).
   - Bulk CSV product upload with schema validation and error feedback.
3. **Orders Dashboard**:
   - Real-time table displaying order ID, customer phone, items, total amount, payment status (`pending`, `paid`, `cancelled`), and fulfillment status.
4. **Settings & Payment Keys**:
   - Masked Paystack public key configuration and WhatsApp bot connection status.

### 4.2 WhatsApp Conversational Bot Flow
1. **Greetings & Shop Discovery**: Bot welcomes user, explains capabilities in friendly tone (English + Pidgin).
2. **Product Inquiries & Catalog Browsing**: Claude LLM queries product database, answering queries such as *"You get black Chelsea boots size 43?"*.
3. **Cart Management**: Add, update quantity, and remove items with dynamic total calculation.
4. **Paystack Checkout Generation**: Generates a secure Paystack payment link and sends it directly in the chat.
5. **Post-Payment Confirmation**: Paystack webhook triggers automatic WhatsApp confirmation message with order details and receipt summary.

---

## 5. Non-Functional Requirements & Security
- **Response Latency**: WhatsApp bot responses should average < 3 seconds.
- **Data Security**: Secrets and API keys must never be exposed or committed; Paystack keys masked in UI.
- **Reliability**: Graceful fallback if LLM encounters timeout or unparseable input.

---

## 6. Critical Path Risks & Mitigations

| Risk | Description | Mitigation Strategy |
| --- | --- | --- |
| **Twilio/Meta approval delay** | Official WhatsApp Business verification takes too long for a hackathon. | Use Twilio WhatsApp Sandbox for instant pre-approved testing and demo. |
| **CSV parse failure** | Merchant uploads malformed CSV causing backend unhandled 500 error. | Strict Pydantic CSV validation, clear row-by-row error toast alerts, sample CSV download. |
| **LLM bugs** | Hallucinations or out-of-scope answers during customer inquiries. | Strict system prompt grounding LLM strictly to DB catalog data; fallback message for out-of-stock items. |
| **Sync latency** | Delay between WhatsApp payment confirmation and dashboard refresh. | Webhook-driven status update with optimistic UI / polling in vendor orders view. |
| **Mobile not responsive** | Vendor dashboard UI broken on mobile browser during presentation. | Mobile-first Tailwind design with mobile viewport verification in CI/review. |
| **Demo internet failure** | Network drop or API rate limiting during live hackathon judging. | Pre-recorded 60-second backup video demo of end-to-end purchase flow. |

---

## 7. Day 4 Final Checklist

### Frontend (FE)
- [ ] Vendor signup and login flows work smoothly
- [ ] Product catalog table displays all products with stock and price
- [ ] Bulk CSV upload works with sample CSV and surfaces clear validation feedback
- [ ] Orders dashboard displays live order status badges (Pending, Paid, Delivered)
- [ ] Mobile responsive layout passes on phone viewports

### Backend
- [ ] FastAPI `/api/health` returns status 200
- [ ] Twilio webhook receiver successfully ingests incoming WhatsApp messages
- [ ] Claude LLM integration parses intent and returns catalog answers with system prompt
- [ ] Paystack payment link generation and webhook verification functional
- [ ] PostgreSQL database relationships and Redis session state working

### Demo
- [ ] Test WhatsApp device joined to Twilio Sandbox
- [ ] Sample vendor seeded with 5 realistic Nigerian retail products
- [ ] Full end-to-end flow verified: Inquire -> Add to Cart -> Pay via Paystack -> Order appears on Dashboard
- [ ] Backup screen recording video prepared and accessible offline

### Presentation
- [ ] 5-minute pitch slide deck completed
- [ ] Clear problem statement, target market size, and demo narrative rehearsed
- [ ] Tech stack and architecture diagram prepared for Q&A

---

## 8. Section 8 Execution Plan

### Day 1 — Foundation & Setup
- [Backend] DB schema design and PostgreSQL connection setup
- [Backend] Twilio account setup + sandbox active with webhook endpoint
- [Backend] Basic FastAPI health check and routing scaffolding
- [Frontend] Next.js project setup with Tailwind CSS and layout structure
- [Frontend] Vendor Signup Page and authentication views
- [DevOps] CI/CD pipelines (backend-ci, frontend-ci, deploy) setup

### Day 2 — Core Commerce
- [Frontend] Products Dashboard with single item creation form
- [Frontend] CSV catalog upload parser and error reporting modal
- [Frontend] Orders Dashboard with live status badges
- [Backend] LLM integration (Claude + system prompt) for catalog query and Pidgin English
- [Backend] WhatsApp messaging flow (greeting, catalog search, cart state in Redis)
- [Backend] Paystack payment link creation and transaction verification endpoints

### Day 3 — Polish & Optimization
- [Backend] Paystack webhook receiver for real-time payment confirmation notifications
- [Backend] Error handling, retries, and rate limiting on LLM and WhatsApp calls
- [Frontend] Polish Vendor Dashboard UI, stats cards (total revenue, order count)
- [Frontend] Mobile responsiveness optimization across all dashboard screens
- [Testing] Backend unit/integration tests and frontend component tests

### Day 4 — Demo Readiness
- [Demo] End-to-end user testing (Vendor creates store -> Buyer completes purchase on WhatsApp)
- [Demo] Seed realistic product catalog (fashion, electronics, local groceries)
- [Demo] Record 60-second backup demo video in case of network drops
- [Presentation] Finalize slide deck and rehearse 5-minute pitch
