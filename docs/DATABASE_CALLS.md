# Database calls and local catalog caching

## Local collection data

`backend/app/data/scarf_collections.csv` is the reviewed copy of
`Downloads/scarves_by_category.csv`: 155 distinct scarf names and 17 visible
collections (plus the internal Unplaced category). It contains category metadata,
not stock or authoritative prices. `scarf_collections.py` loads it once per
process. Edit the file and restart/redeploy to change the mapping.

Avaia category membership uses this local mapping even when a Bumpa product
response omits collections. Other merchants retain their own saved categories.
New category buttons carry names rather than list indexes, so reordering the CSV
cannot send a selection to the wrong collection. Previous numeric buttons still
decode using the old menu order; missing categories are rejected.
Rendering collection labels requires no product/catalog query; handling a chat
still reads and writes conversation state and deduplication records.

Browse inventory is cached in server process memory for 60 seconds, keyed by
merchant, with at most 32 cached catalogs and 2,000 products per cached catalog.
Concurrent browse requests share a load. Each process has its own cache; a
restart clears it. An active merchant normally causes at most one browse SELECT
per minute per process, unless evicted or over the size limit. Browsing filters
and paginates in memory. Selection and checkout still validate live inventory.

Do not cache payments, authorization decisions, deduplication, or order state in
this catalog cache. An empty/expired cache loads from the database. No database
credentials or customer records are written into the CSV.

## Recurring calls

Counts below are calculated from code/configuration, not production telemetry.
They are per process or browser tab. A scheduler invocation can issue more than
one SQL statement. Production environment overrides must be checked separately.

| Caller | Previous cadence | Updated behavior | DB work |
| --- | --- | --- | --- |
| Reply recovery worker | Every 1 second when a slot is free (~86,400/day) | Empty queue backs off to 600 seconds (~144/day at steady idle, plus startup); active work uses base interval | SELECT ready reply jobs; additional reads/locks/writes for jobs actually processed |
| Dashboard browser | Every 5 seconds (~17,280 requests/day per open tab) | Every 60 seconds while visible (at most ~1,440/day plus initial load) | Authentication plus vendor/catalog or orders/cart/product reads |
| Analytics browser | Query remount/focus could refetch | 60-second query freshness; no window-focus refetch | Orders/products API reads plus authentication |
| Bumpa payment recovery | Every 15 seconds (~5,760/day) | Preserved | Due checkout SELECT; active checkout/vendor reads and status updates |
| Transfer expiry | Every minute (~1,440/day) | Preserved | Pending transfer SELECT; vendor reads and writes when transfers expire |
| Legacy order expiry | Every minute (~1,440/day) | Preserved | Pending order SELECT, updates when expired |
| Legacy payment reconciliation | Every 10 minutes (~144/day) | Preserved | Pending order SELECT; provider verification and updates for matches |
| Catalog sync | Every 10 minutes (~144/day) | Cadence preserved; batch upserts of up to 50 products | Active merchants SELECT, sync guard INSERT/UPDATE, connection/vendor SELECTs, page upserts, final unpublished/sync status UPDATEs |
| Privacy retention | Hourly (24/day) | Preserved | Deletes expired conversation/dedup state and scrubs old checkout/transfer details |

For a 170-product catalog, product writes fall from 170 individual upsert
statements to four batched upserts per complete sweep. Additional coordination
statements still apply. Avaia uses the bundled category map instead of fetching
each storefront collection and querying each membership. Other shops accumulate
memberships before a single catalog SELECT and batched updates.

The reply worker wakes immediately for committed messages delivered through the
same process. Jobs produced by another process, failed polls, and scheduled
retries can wait up to `META_REPLY_WORKER_IDLE_POLL_SECONDS` (default 600). Use a
smaller value if that recovery latency is unacceptable. Startup polls immediately.

`DATABASE_BACKGROUND_JOBS_ENABLED` defaults to **true**. Setting it to false
disables payment recovery, transfer/order expiry, reconciliation, retention, and
scheduled catalog sync together. Do not disable these without equivalent
externally scheduled jobs. It does not disable the reply worker.

## Calls triggered by real usage

| Flow | Reads and writes retained |
| --- | --- |
| Incoming WhatsApp webhook | Merchant lookup; inbound message insert; processed-message dedup insert; opt-out/state/rate-limit checks and updates |
| Conversation steps | Conversation state SELECT and UPDATE/INSERT; outbound message persistence; catalog SELECT only on browse cache miss |
| Product selection | Bumpa connection SELECT, cached product SELECT, provider HTTP request, cache UPSERT, updated product SELECT |
| Basket and checkout | Guest-cart restore/persistence; credentials; live item validation; checkout/transfer records; relevant conversation state |
| Payments and approval | Authenticated callback/review, deduplication, locked status reads/updates; invoice/notification tracking |
| Account/API access | Account/authentication reads; login/token/revocation writes; requested tenant data |
| Health endpoint | No DB query |

These writes preserve payment correctness, authentication, replay protection and
conversation recovery. Collection caching does not eliminate them.

## Refresh live inventory

From `backend`, use the project Python environment:

```powershell
..\.venv\Scripts\python.exe scripts/refresh_inventory.py --merchant-id 7c5b4c3e-38d9-4568-9d39-649e93c54b74
..\.venv\Scripts\python.exe scripts/refresh_inventory.py --merchant-id 7c5b4c3e-38d9-4568-9d39-649e93c54b74 --apply
```

The first command previews provider fields and mapping completeness. The second
claims the primary sync, fetches current Bumpa inventory, then copies only that
merchant's product cache to DB2 in batches. Explicit database targets prevent
silent failover in this maintenance command. A busy sync is respected; partial
provider failure does not unpublish unseen products or proceed to DB2.

If a crashed process leaves the sync flag set, `--apply --recover-stale-sync`
can release it only when its recorded start is more than 24 hours old. The
update checks the observed timestamp so it cannot clear a newly claimed sync.
Credential initialization failures now also pass through normal sync cleanup.

Verified refresh on October 27, 2026: recovered a flag left running since
October 21, fetched 162 products, and updated both databases. Each contains 170
cached rows, with 162 published and eight retained but unpublished. Stock was
mapped for all rows; seven rows have no mapped base price. No prices were
invented. The run used 16 SQL statements on DB1 (including guard recovery and
validation) and six on DB2; transaction control is not included in these counts.

This is a one-time catalog copy, not continuous database replication. DB2 must
not be treated as a current copy of orders, payment state, or customer activity
after either database receives new writes. Matching schemas alone do not make
automatic write failover safe.

## Compute expectations

Fewer SQL statements reduce database work, but do not guarantee equivalent
compute-hour savings. In particular, the preserved 15-second payment poll and
minute-level expiry jobs can keep a serverless database awake. Eliminating that
idle compute requires scheduling around pending work or an external event/job
system, with recovery and expiry behavior preserved.

Neon's default scale-to-zero idle window is five minutes; any regular query
inside that window can prevent suspension. See
[Neon scale to zero](https://neon.com/docs/introduction/scale-to-zero).

Code changes require deployment/restart to affect the running bot. Local edits
and live inventory maintenance are separate operations; neither commits nor
deploys the application.
