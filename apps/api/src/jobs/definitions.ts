import { defineJob } from '@cleverbrush/scheduler';
import { enumOf, number, object, string } from '@cleverbrush/schema';

export const jobNamespace = 'xpenser';
export const scanRetentionMs = 30 * 60 * 1_000;

/** Versioned JSON-only contract. Files and public date-bearing DTOs stay in the app. */
export const TransactionScanJob = defineJob({
    name: 'transaction-scan',
    version: 1,
    input: object({ requestId: string() }),
    progress: object({ stage: enumOf('preparing', 'analyzing', 'saving') }),
    output: object({ scanId: number() }),
    retry: { maxAttempts: 3, initialDelayMs: 10_000, maxDelayMs: 60_000 },
    timeoutMs: 5 * 60 * 1_000,
    retentionMs: scanRetentionMs
});

/** Delivery-level idempotency and retry policy remain owned by email reports. */
export const EmailReportSweepJob = defineJob({
    name: 'email-report-sweep',
    version: 1,
    input: object({}),
    progress: object({}),
    output: object({}),
    retry: { maxAttempts: 1 },
    timeoutMs: 55 * 60 * 1_000
});

/** Bounded, restart-safe cleanup of application artifacts after run retention. */
export const ScanCleanupJob = defineJob({
    name: 'scan-artifact-cleanup',
    version: 1,
    input: object({}),
    progress: object({}),
    output: object({}),
    retry: { maxAttempts: 1 },
    retentionMs: scanRetentionMs
});
