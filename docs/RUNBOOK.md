# Runbook & Risk Mitigation Matrix — Naija Marketplace (EcomBot)

This runbook outlines operational procedures and mitigations for critical path risks identified during the hackathon lifecycle.

---

## Backend deployment on Render (native Python)

Use Render's Python 3 runtime for the backend. Docker is not required.
For an existing Docker service, open Settings > Build > Source > Edit,
select the same GitHub repository, and change the runtime to Python 3.

| Setting | Value |
| --- | --- |
| Branch | `main` |
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/api/health` |

Save the configuration and deploy. Verify that `/api/health` responds with
HTTP 200 and `{"status":"ok"}`. Keep real environment secrets in Render's
Environment settings, never in source control. The current health-only app
does not require database, payment, messaging, or AI credentials to start.

Changing files in Git does not switch an existing service's runtime; apply
the runtime change in Render too. Frontend hosting is configured separately.
### Deploy only after backend CI passes

1. In Render, set Auto-Deploy to Off so pushes cannot bypass GitHub tests.
2. Copy the service's Deploy Hook from its Settings page.
3. In GitHub Settings > Secrets and variables > Actions, add a repository
   secret named `RENDER_DEPLOY_HOOK` with that URL. Do not commit the URL.
4. Push to `main`. The Backend CI and Deploy workflow runs Ruff and pytest
   before its dependent Render deploy job. It passes the tested commit SHA
   to Render and fails if the secret is missing or Render rejects the request.

A successful deploy job means Render accepted the request, not that the
service is live. Check Render's deploy status and `/api/health` afterward.
Frontend pull-request checks remain separate; this workflow deploys only
the backend.

Reference: https://render.com/docs/native-runtimes

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
   - Verify `GEMMA_API_KEY` quota and rate limits.
   - Fall back to standard keyword-matching catalog search routine.

3. **If Paystack Webhook Fails in Local Dev**:
   - Resend payment verification request manually using transaction reference via `GET /api/payments/verify/{reference}`.
