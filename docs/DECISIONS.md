# Architecture Decision Records (ADRs) — Naija Marketplace (EcomBot)

This document tracks significant architectural and technical decisions made for the project.

---

## ADR 001: Twilio Sandbox Chosen Over Meta Cloud API for MVP Speed

- **Status**: Accepted
- **Date**: 2026-09-22
- **Context, Decision & Consequences**: 
  While Meta's Cloud API provides native WhatsApp Business account integration without third-party transit costs, the formal business verification, phone number provisioning, and display name review process often take several business days to weeks—which is incompatible with the tight 4-day hackathon timeline. We chose the Twilio WhatsApp Sandbox because it offers instantaneous, zero-delay activation, pre-configured inbound/outbound webhooks, and predictable API abstractions for both messaging and media. The consequence is that demo testers must send a one-time join code (e.g. `join <sandbox-keyword>`) to interact with the bot during testing, which is fully acceptable for MVP demonstration while allowing seamless migration to production Meta Cloud API or Twilio WhatsApp Business profiles post-hackathon.

---

## ADR 002: FastAPI Chosen for Backend Engine

- **Status**: Accepted
- **Date**: 2026-09-22
- **Context, Decision & Consequences**:
  The backend requires high-throughput asynchronous handling of concurrent webhook events from Twilio and Paystack, rapid integration with Anthropic's Python SDK, and strict request/response data validation for product catalogs and CSV parsing. We chose FastAPI on Python 3.11 because its native `async`/`await` architecture delivers top-tier performance for I/O-bound LLM and webhook calls, while Pydantic provides automatic schema validation and interactive OpenAPI/Swagger documentation out of the box. The consequence is that the team must structure asynchronous database queries (via SQLAlchemy `async_session` or SQLModel) and handle event loops cleanly, which is outweighed by the rapid development pace, automated schema docs, and Python ecosystem synergy for conversational AI.
