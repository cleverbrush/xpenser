import { NonRetryableJobError } from '@cleverbrush/scheduler';
import { describe, expect, it } from 'vitest';
import { TransactionScanJob } from '../jobs/definitions.js';
import { scanJobError } from '../jobs/scan-handler.js';
import { BudgetAccessError, BudgetPermissionError } from './budgets.js';
import { OpenAIConfigError } from './openai.js';
import { scanProgressEvent } from './transaction-scan-jobs.js';
import { TransactionScanInputError } from './transaction-scans.js';

describe('durable transaction scan contract', () => {
    it('reports retry waits without a terminal failure', () => {
        expect(
            scanProgressEvent('job', 'queued', { retry: true })
        ).toMatchObject({
            stage: 'queued',
            error: null,
            scan: null,
            message: 'Scan interrupted. Retrying automatically.'
        });
    });
    it.each([
        ['preparing', 15],
        ['analyzing', 45],
        ['saving', 85]
    ] as const)('preserves %s progress', (stage, progress) => {
        expect(scanProgressEvent('job', stage)).toMatchObject({
            stage,
            progress,
            jobId: 'job'
        });
    });
    it('preserves the review result envelope', () => {
        const scan = {
            scanId: 10,
            documentKind: 'receipt' as const,
            warnings: [],
            drafts: []
        };
        expect(scanProgressEvent('job', 'complete', { scan })).toMatchObject({
            stage: 'complete',
            progress: 100,
            scan,
            error: null
        });
    });
    it.each([
        new TransactionScanInputError('Upload a valid image.'),
        new BudgetAccessError('private budget name'),
        new BudgetPermissionError('private role'),
        new OpenAIConfigError('secret config')
    ])('does not retry permanent failures: %s', error => {
        expect(scanJobError(error)).toBeInstanceOf(NonRetryableJobError);
    });
    it('never persists provider details in retryable failures', () => {
        const error = scanJobError(new Error('provider secret'));
        expect(error).not.toBeInstanceOf(NonRetryableJobError);
        expect(error.message).toBe('Could not scan the image. Try again.');
    });
    it('bounds attempts and keeps durable transport small and JSON-only', () => {
        expect(TransactionScanJob.policy).toMatchObject({
            retry: { maxAttempts: 3, initialDelayMs: 10000, maxDelayMs: 60000 },
            timeoutMs: 300000,
            retentionMs: 1800000
        });
        expect(
            TransactionScanJob.input.parse({ requestId: 'request' })
        ).toEqual({ requestId: 'request' });
        expect(TransactionScanJob.output.parse({ scanId: 10 })).toEqual({
            scanId: 10
        });
    });
});
