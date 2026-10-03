# Background jobs

Xpenser uses Framework `0.0.0-beta-20261003113145` and its PostgreSQL scheduler
adapter. No Redis, separate worker container, or additional credentials are
required. Every API process shares its existing database pool with its workers.

## Structure and lifecycle

Job definitions live in `apps/api/src/jobs/definitions.ts`; handlers live in
separate modules with `JobHandler<typeof Definition>` typing. The runtime owns
worker startup and shutdown. The scan service owns authorization and public DTOs.
Constructing the server or a producer does not start background polling.

Migration 020 creates the four adapter-owned `cb_jobs_*` tables and the
application-owned `transaction_scan_requests` artifact table. Workers start only
after migrations. Do not directly query or modify the adapter's opaque records
from application code; use scheduler/repository APIs.

Each API process has two scan slots and one email/housekeeping slot. These are
per-process limits, not a global quota. PostgreSQL claims and leases coordinate
replicas. The scheduler namespace is `xpenser`; preview and production use
separate databases. A namespace is not an authorization boundary.

On shutdown, the API stops accepting connections, closes scan observers, stops
dispatching, and drains workers for 30 seconds before requesting cancellation.
Only afterward does it close the shared database pool. Compose allows 45 seconds.
Abrupt process termination leaves accepted work recoverable within its remaining
attempt budget. Startup failures also stop workers before releasing resources.

## Receipt scanning

The start endpoint validates image limits and budget access, then commits the
uploaded image and job acceptance in one transaction. Job input contains only
the request ID, not image data, credentials, or capability tokens. A token hash
authorizes progress reads; knowing a job ID alone grants no access.

HTTP scan requests use a required multipart `image` file and optional `budgetId`
text field. Durable artifact storage and job input/output versions are unchanged.
Migration 021 stores drafts/corrections as object-valued JSONB; reads decode
declared dates and project public fields without exposing extension data.
Confirmation first uploads the original image to `PUT /api/transaction-scans/:scanId/image`,
then records the decision as JSON. Hash verification and an atomic upsert make
image retries safe. Web and Telegram retain a successfully created transaction
when a later image/decision request fails, avoiding another financial write on retry.
Browser temporary files are removed only after the decision succeeds.
See [rollout and rollback](./image-uploads.md#rollout-and-rollback).

The job reports committed `preparing`, `analyzing`, and `saving` progress.
Polling and subscriptions retain their existing public response shapes. A retry
wait is a non-terminal `queued` event with a retry message. Subscriptions replay
retained history; disconnecting does not cancel a scan.

Scans allow three attempts total, including the first, with exponential delays
starting at 10 seconds and capped at 60 seconds. Each attempt has a five-minute
timeout. Invalid input, missing configuration, and denied access do not retry.
Permissions are checked again during execution and before saving results.

The image analysis runs outside database transactions. The write phase locks
the request row and commits the scan header, all draft items, and the result link
atomically. Concurrent or recovered attempts reuse an existing result. A crash
after result commit therefore does not create another draft set or repeat AI.
Cancellation is passed to the AI request and checked before committing writes.

Execution is **at-least-once**, not exactly-once. If an AI call completed but its
result was not committed, a retry can repeat that call and incur another charge.
Separate user submissions are separate jobs. Nothing automatically confirms
drafts or creates financial transactions.

Progress tokens and scheduler records remain available for 30 minutes after
terminal completion. Active/queued work does not expire under terminal retention.
Successful result persistence clears the staged image. A bounded minutely
housekeeping job removes expired request artifacts, including failed-job images;
it may run later while an email sweep occupies the maintenance worker. Cleanup
does not remove scan results or explicitly confirmed attachments.

Browser polling tolerates roughly one minute of temporary API unavailability,
using capped backoff and a timeout for each request. Telegram subscriptions also
have a larger reconnect budget. This does not persist the browser's review state
across a page refresh or Telegram sessions across a bot restart.

## Email reports

`EMAIL_REPORTS_ENABLED` and `EMAIL_REPORTS_SCHEDULER_ENABLED` retain their meaning.
When either is disabled, the runtime removes the recurring email trigger, and
already-accepted sweeps also check the flags before doing work.

The stable hourly schedule starts when first registered, coalesces missed ticks,
and skips overlapping unfinished sweeps. Identical registration after restart
preserves its original anchor and cursor. It does not enqueue a fresh startup
sweep on every deployment. The first sweep is immediately eligible instead of
waiting for the previous process-local 30-second startup timer.

A sweep has one scheduler attempt and a 55-minute timeout. Existing weekly/monthly
period, local-time eligibility, and delivery-ledger retry rules remain unchanged.
Coalescing runs the current due-report check; it does not backfill all historical
report periods. The delivery ledger prevents concurrent replicas from sending
the same claimed report. It does not prove exactly-once provider delivery.

If shutdown interrupts an email-provider request after sending begins, the
delivery remains pending because its outcome is uncertain. Do not automatically
resend it: reconcile against the provider first. Ordinary delivery failures keep
the pre-existing ledger retry behavior.

## Verification and operations

`npm run test:queries:integration` includes real PostgreSQL job tests in disposable
schemas of `xpenser_queries`; it never targets application data. Tests cover
atomic acceptance, competing workers, recovery, retries, protected writes,
progress authorization/replay, retention, recurring schedules, and shutdown.
CI runs this suite in UTC and a non-UTC process timezone.

Job attempt spans are named `job.transaction-scan` and `job.email-report-sweep`.
They carry the job name, run ID, and attempt number, never images or tokens.
Scheduler infrastructure and lease diagnostics use the existing logger.
Use `scheduler.health()` for queue counts, oldest ready time, and queued
name/version pairs. Keep handlers for outstanding definition versions when
introducing a new persisted contract.

This first migration cannot recover jobs from the old process-local map. Let
existing scans finish before switching deployments. The schema migration is
additive; rolling application code back loses observation/recovery of new jobs
until the durable worker is restored. Migration rollback is destructive and
must only run after all producers and workers have stopped.
