# Durable Meta AI replies

Meta message receipt and reply completion are separate operations. A webhook 200
now means the incoming event and its reply job committed to PostgreSQL. It does
not mean the AI answered or WhatsApp delivered the response.

The old handler relied on INSERT `rowcount` to trigger AI processing. With the
current psycopg/SQLAlchemy configuration that test could be false even after an
insert. Intake now uses `RETURNING message_id`, covered by PostgreSQL tests.

## Deploy

1. Apply `python -m alembic upgrade head` from `backend` before deploying this
   code. Revision `0004` adds jobs and tool receipts; it does not replay history.
2. Keep the existing Meta and Gemma credentials. Set
   `META_REPLY_WORKER_ENABLED=true` on Render after the migration.
3. Deploy the updated native Python service. No extra service or Docker is needed.
4. Send a new text message and inspect `python -m app.services.reply_review` in a
   trusted backend shell using the production DATABASE_URL.
5. Correlate the job's outbound ID with Meta's sent/delivered/read callbacks.

To pause generation/sending, set the flag false and restart. Intake still stores
jobs; a currently running send may finish during shutdown. The in-process worker
cannot run while Render is asleep. It resumes durable jobs when the service wakes.

## Processing and retry policy

The worker polls every five seconds. PostgreSQL transaction advisory locks
serialize each sender/customer pair, including across multiple app instances and
transaction-pooling connections. A five-minute lease is renewed at checkpoints;
each provider request is bounded to 30 seconds for Gemma or 20 seconds for Meta.
The coordination connection holds the advisory lock while data transactions use
a separate connection. This requires two pool connections per active worker.

States: `pending`, `processing`, `retry`, `sending`, `accepted`, `delivered`,
`read`, `delivery_unknown`, `needs_review`. API acceptance is not delivery.

Transient failures retry after 10s, 30s, 2m, 5m, and 15m. The sixth failure requires
review. Configuration failures and expired 24-hour message windows require review.
Incoming rate limiting is applied once per new event; retries do not consume it.

Every selected AI action is saved before execution. The tool's database writes,
result receipt and transcript checkpoint commit together. After restart, the agent
continues from saved results instead of repeating cart/order writes. The generated
reply and conversation history commit before sending, so send retries never rerun
Gemma. Product IDs are tenant-scoped and prices come from the database.

A timeout after a send may mean Meta accepted the message. Such jobs become
`delivery_unknown`; they are not resent automatically. A persisted job identifier
in `biz_opaque_callback_data` lets a signed status callback resolve this state.
Expired `sending` leases also require reconciliation instead of blind resending.
Explicit delivery failures become `needs_review`. This is not an exactly-once
delivery guarantee from Meta.

## Gemma and diagnostics

Recovery uses a validated text JSON action protocol with the configured Gemma
model: either one customer tool and arguments or a customer reply. It does not
depend on native `functionCall` or `systemInstruction` support. The allowlist
excludes all dashboard/admin tasks. Native Twilio behavior is retained.

Gemma credentials now travel in the `x-goog-api-key` header rather than URL query
parameters. Logs contain job IDs and failure categories, never provider bodies,
customer text or tokens. `gemma_http_400/401/403/404` require configuration review;
timeouts and other transient errors use the bounded retry schedule.

Local live probes of the configured `gemma-4-31b-it` endpoint timed out during
implementation. Mocked protocol tests and real PostgreSQL recovery tests passed;
these do not establish live model behavior. Live catalog selection and a full
WhatsApp exchange must still be checked after deployment.

## Historical messages and manual review

`python -m app.services.reply_review` is read-only. It reports counts by state,
untracked historical-message count, and up to 100 review/retry jobs, without
customer content or phone numbers. The pre-existing message table lacks original
sender metadata and inbound-to-outbound linkage; no safe automatic inference of
historical reply completion is possible. Never replay all rows with `received`.

Use a fresh test message first. A historical request must be reviewed against
conversation/cart/order records and actual delivery evidence before any manual
recovery. Do not reset a job's pending action, transcript or tool receipts: doing
so can repeat shopping actions. Do not reset `delivery_unknown` without first
checking Meta delivery evidence. This release adds no public retry/admin route.

## Verification

Tests cover actual PostgreSQL insert detection, duplicate callbacks, atomic tool
rollback, restart recovery, parallel claims, bounded retries, stale leases,
checkout without duplicate orders/stock decrement, status reconciliation,
messaging-window expiry, tenant scoping, invalid actions, and persistence 503s.
Use an isolated database for tests: both `DATABASE_URL` and `TEST_DATABASE_URL`
must point to it. CI sets both; never run tests against production.
