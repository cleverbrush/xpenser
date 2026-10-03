# Image uploads and scan storage

Avatar and receipt endpoints use typed multipart uploads. API, web, Telegram,
and external callers must use the same upload contract. Images remain in the
existing PostgreSQL storage; no object-storage service is required.

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
guess fields. Declare `.upload()` after avatar cache tags to retain
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
or key order.

## Verification

Unit and real-HTTP tests cover typed clients with batching on/off, upload limits,
invalid formats, explicit form pointers and retries. PostgreSQL suites
`transaction-scans.test.ts` and `scan-item-jsonb-migration.test.ts` cover JSONB
extension/date/null round trips, failed/up/down migrations, concurrent image
upserts, hash checks, and tenant isolation. Browser tests live in the avatar,
transaction-scan and durable-scan suites. CI runs database tests in UTC and
America/Los_Angeles before deploying a preview and running Playwright.

See [database reads](./database-reads.md) for compiled query behavior and
[background jobs](./background-jobs.md) for durable scan execution.
