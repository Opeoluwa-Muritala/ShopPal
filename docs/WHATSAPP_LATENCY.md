# WhatsApp response latency

The Meta reply worker now polls while replies are running, filling available
slots without waiting for a batch of 20 messages to finish. Blocking work runs
in threads; PostgreSQL conversation locks and durable action checkpoints still
prevent concurrent shopping writes for the same customer.

After the webhook commits, it signals the local worker to read the database
immediately. No message content is passed to the worker through this signal.
Polling remains the fallback for separate processes, direct database inserts,
and missed signals. The database is the durable source of messages and jobs.

Deploy the backend and restart its worker with:

```dotenv
META_REPLY_WORKER_ENABLED=true
META_REPLY_WORKER_CONCURRENCY=4
META_REPLY_WORKER_POLL_SECONDS=1
GEMMA_TIMEOUT_SECONDS=20
GEMMA_MODEL=gemma-4-26b-a4b-it
```

An existing `GEMMA_TIMEOUT_SECONDS=90` environment override must be updated;
changing the code default does not override deployment settings. A successful
OpenRouter fallback is reused for subsequent tool rounds within the same reply.
Provider failures still use durable retries; an unavailable provider can exceed
the one-minute target. The HTTP timeout is per network operation, not a total
conversation deadline.

`meta_message_send` logs now include `latency_ms` from persisted job creation to
Meta acceptance. Measure average and p95 over representative greetings, catalog
searches, cart changes, and checkout, including simultaneous customers. Target
an average below 60,000 ms. Inspect delivery receipts separately: acceptance is
not device delivery. Include failed/pending jobs in the review to avoid measuring
only successful replies. No production latency claim has been established by
the local mocked regression tests.

Database integration tests require a dedicated migrated `TEST_DATABASE_URL`.
Never point that setting at the application database.

For an explicitly requested live-database integration run, use
`python scripts/test_live_replies.py` from `backend`. It creates and removes a
uniquely named schema on the configured database, with transaction-local schema
selection so production workers cannot claim test jobs. Tests use real database
transactions and mock AI/Meta requests. Tables are built from the local models;
this does not verify the production schema's migration history.

To test the worker from localhost in PowerShell, run from the project root:

```powershell
Set-Location backend
$env:META_REPLY_WORKER_ENABLED='true'
../.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The local worker processes jobs in the configured database. For direct WhatsApp
webhook testing, forward a public HTTPS tunnel to port 8000 and configure Meta's
callback to `/webhooks/whatsapp`. Localhost by itself is not reachable by Meta.
