# Framework October beta adoption

All Framework packages use the exact npm version `0.0.0-beta-20261003113145`.
The lockfile contains one shared `@cleverbrush/schema` installation. This changes
the API upload contracts, so API, web, Telegram, and external callers must be
upgraded together. It does not introduce object storage or new infrastructure.

## Compiled reads, not cached permissions

Feature-owned definitions in `budget-access-reads.ts`, `api-key-reads.ts`,
`budget-queries.ts`, and `jobs/scan-reads.ts` use `parameter(...)`. `perConnection`
retains immutable query definitions weakly by Knex connection. Direct calls reuse
compiled SQL and result decoding, but every invocation executes fresh database
reads with independent bindings. Revoking a key or budget membership takes effect
on the next request. Transaction-scoped connections use their own definitions;
explicit `.transacting(trx)` derivatives remain in the caller's transaction.

```ts
const reads = budgetAccessReads(db.knex);
const [member] = await reads.member(budgetId, userId);
// Debug SQL without executing:
const { sql, bindings } = reads.member.toSQL(budgetId, userId);
```

Dynamic report filters, variable-size ID lists, and writes keep ordinary immutable
query builders. No response cache, schema hierarchy, or polymorphic entity is
introduced to make use of an unrelated library feature. The release's property
navigation improvements are inherited by existing queries.

## Typed multipart contracts

| Operation | File field | Text fields | File limit |
| --- | --- | --- | --- |
| `PUT /api/users/me/avatar` | `avatar` | None | 512 KiB |
| `POST /api/transaction-scans` | `image` | Optional `budgetId` | 10 MiB |
| `POST /api/transaction-scans/jobs` | `image` | Optional `budgetId` | 10 MiB |
| `PUT /api/transaction-scans/:scanId/image` | `image` | None | 10 MiB |

All accept PNG/JPEG/WebP and one file, with explicit field/part limits. The global
request limit remains 20 MiB. Authentication precedes upload parsing. Parser and
schema failures return structured 400 Problem Details; resource limits return
413. MIME validation checks the declared type, not a malware or image-content scan.

```ts
await client.users.updateAvatar({ files: { avatar: selectedFile } });
const job = await client.transactionScans.start({
    body: { budgetId: 12 },
    files: { image: selectedFile }
});
// After creating a transaction from a reviewed draft:
await client.transactionScans.uploadImage({
    params: { scanId }, files: { image: selectedFile }
});
await client.transactionScans.decide({
    params: { scanId, itemId },
    body: { decision: 'confirmed', transactionId, correctedTransaction }
});
```

The typed client also accepts `{ buffer, size, filename, mimeType }` in server
code. Let it set the multipart boundary; do not supply `Content-Type` manually.
The image endpoint checks membership, transaction-create permission, and the
original scan's SHA-256 digest before an atomic upsert keyed by scan ID. It does
not create or confirm transactions. Upload alone does not make an image publicly
accessible; retrieval still requires an authorized confirmed transaction.

Browser chunking and the 24-hour temporary-upload TTL remain. The web server
forwards assembled bytes as a typed file, and keeps the temporary image if upload
or decision recording fails. Telegram checkpoints an already-created transaction
before those follow-ups. These checkpoints do not survive a browser refresh or
bot restart, and do not make an ambiguous transaction-create timeout exactly-once.

The web upload adapter explicitly maps `/files/image` and `/files/avatar` to UI
fields. Unknown or root pointers remain form-wide; messages are never parsed to
guess fields. In this beta, declare `.upload()` after avatar cache tags to retain
file type inference. A real typed-client HTTP test guards this composition.

## JSONB documents and DTOs

`transaction_scan_items.draft_json` and `corrected_json` retain their physical
names but use native `.jsonb()` schemas and application properties `draft` and
`correctedTransaction`. Declared dates decode as `Date`; nullable corrections stay
SQL NULL. Open root and nested object schemas preserve JSON extension data.
An explicit synchronous mapper projects the public draft, retaining required
nullable fields while excluding private extension properties.

Migration 021 locks the table, checks that every non-null document is an object,
and converts both columns transactionally. Invalid JSON, array/scalar roots, or
JSON `null` abort without discarding rows. Repair malformed legacy data explicitly
and rerun. `warnings_json` and OAuth redirect URI arrays remain unchanged, as do
base64 image storage, download responses, and durable job payload versions.

## Native CORS

`useCors()` allows the serialized origin of `APP_URL`, preserves the existing
method/header allowlists and exposed headers, and does not enable credentials.
Preflights are route-aware and run before authentication. Denied origins receive
403; authenticated responses and ordinary errors get the correct CORS/Vary
headers. Preflights and early CORS denials bypass ordinary tracing middleware.

## Rollout and rollback

1. Back up PostgreSQL and allow in-flight scans and confirmations to finish.
2. Stop API/web/bot consumers together; avoid mixing old JSON-upload clients with
   the new API. Apply migration 021 before starting the new consumers.
3. Start the coordinated release. Check avatar upload, scan acceptance/progress,
   review, confirmation, image retrieval, budget access, and API-key revocation.
4. For rollback, stop consumers again, run **only migration 021's down migration**
   to convert the two columns to TEXT, and restore the previous coordinated app
   release. Do not roll back migration 020 or erase scheduler state.

The down migration preserves semantic document data, not original JSON whitespace
or key order. No production deployment is included in this PR.

## Verification

Unit and real-HTTP tests cover typed clients with batching on/off, upload limits,
invalid formats, explicit form pointers, retries, CORS and OpenAPI. PostgreSQL
tests cover concurrent bindings, fresh authorization, transaction rollback,
JSONB extension/date/null round trips, failed/up/down migrations, concurrent image
upserts, hash checks, tenant isolation, and durable job recovery. CI runs database
tests in UTC and America/Los_Angeles, then deploys a preview and runs Playwright.
