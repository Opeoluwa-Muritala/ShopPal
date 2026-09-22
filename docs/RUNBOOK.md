# Runbook & Risk Mitigation Matrix — Naija Marketplace (EcomBot)

This runbook outlines operational procedures and mitigations for critical path risks identified during the hackathon lifecycle.

---

## Critical Path Risks & Mitigations

| Risk | Impact | One-Line Mitigation |
| --- | --- | --- |
| **Twilio/Meta approval delay** | WhatsApp bot unavailable for testing or judging | Use Twilio WhatsApp Sandbox for instant pre-approved testing and demo. |
| **CSV parse failure** | Merchant upload crashes or creates dirty database state | Strict Pydantic CSV validation, clear row-by-row error toast alerts, sample CSV download. |
| **LLM bugs** | Hallucinations or out-of-scope answers during customer inquiries | Strict system prompt grounding LLM strictly to DB catalog data; fallback message for out-of-stock items. |
| **Sync latency** | Dashboard does not show new order after payment is made | Webhook-driven status update with optimistic UI / polling in vendor orders view. |
| **Mobile not responsive** | Judges or merchants experience broken layout on mobile | Mobile-first Tailwind design with mobile viewport verification in CI/review. |
| **Demo internet failure** | Network drop or third-party outage prevents live demo execution | Pre-recorded 60-second backup video demo of end-to-end purchase flow. |

---

## Triage & Escalation Protocol

1. **If Twilio Webhooks Stop Ingesting**:
   - Check ngrok process and verify whether the public forwarding URL has changed.
   - Update Twilio Sandbox Webhook configuration with current `https://<subdomain>.ngrok-free.app/api/webhook/whatsapp`.

2. **If LLM Fails or Returns Malformed Output**:
   - Verify `ANTHROPIC_API_KEY` quota and rate limits.
   - Fall back to standard keyword-matching catalog search routine.

3. **If Paystack Webhook Fails in Local Dev**:
   - Resend payment verification request manually using transaction reference via `GET /api/payments/verify/{reference}`.
