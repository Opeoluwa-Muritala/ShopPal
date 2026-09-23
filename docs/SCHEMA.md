# Database Schema Additions

The authoritative schema is represented by `backend/app/db/models.py` and the
Alembic migrations under `backend/alembic/versions`.

## `whatsapp_messages`

Migration: `0003_create_whatsapp_messages`.

| Column | Type | Constraints / purpose |
| --- | --- | --- |
| `id` | UUID | Primary key generated with `gen_random_uuid()` |
| `message_id` | VARCHAR(255) | Required, unique Meta retry-deduplication key |
| `from_number` | VARCHAR(30) | Customer or status recipient number |
| `message_type` | VARCHAR(30) | Required message type or `status` |
| `body` | TEXT | Text or serialized type-specific content |
| `status` | VARCHAR(30) | Message delivery state |
| `wa_timestamp` | TIMESTAMPTZ | Timestamp supplied by Meta |
| `raw_payload` | JSONB | Original individual message or status object |
| `received_at` | TIMESTAMPTZ | Receipt time, defaulting to `now()` |

Incoming messages use `ON CONFLICT DO NOTHING` on `message_id`. Status callbacks
update an existing message or insert a status record when one is not present.

### Durable reply tables (migration `0004`)

`whatsapp_reply_jobs` has a UUID primary key, unique `message_id` foreign key,
nullable vendor foreign key, customer/sender routing fields, processing state,
attempt count, next-attempt timestamp, lease owner/expiry, JSONB transcript and
pending action, saved reply text, unique outbound message ID, failure category,
acceptance/delivery/read timestamps, and created/updated timestamps. The
`state,next_attempt_at` index supports polling. Message deletion cascades to jobs.

`whatsapp_reply_tool_results` stores UUID ID, job foreign key, call index, tool
name and JSONB arguments/result. `(job_id,call_index)`
is unique; deleting a job cascades to receipts. Tool mutations and their receipt
commit atomically. See [reply recovery](REPLY_RECOVERY.md) for state transitions.
