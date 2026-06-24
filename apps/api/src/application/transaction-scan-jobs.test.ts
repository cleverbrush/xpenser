import type { TransactionScanResponse } from '@xpenser/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    getTransactionScanJobStatus,
    startTransactionScanJob
} from './transaction-scan-jobs.js';

const mocks = vi.hoisted(() => ({
    scanTransactionsFromImage: vi.fn()
}));

vi.mock('./transaction-scans.js', () => {
    class TransactionScanInputError extends Error {}

    return {
        scanTransactionsFromImage: mocks.scanTransactionsFromImage,
        TransactionScanInputError
    };
});

const scan: TransactionScanResponse = {
    scanId: 10,
    documentKind: 'receipt',
    warnings: [],
    drafts: []
};

describe('transaction scan jobs', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns queued status before the scan finishes', () => {
        mocks.scanTransactionsFromImage.mockReturnValue(new Promise(() => {}));

        const job = startTransactionScanJob({} as never, {} as never, 1, {
            imageBase64: 'aW1hZ2U=',
            mimeType: 'image/png'
        });

        expect(getTransactionScanJobStatus(job)).toMatchObject({
            jobId: job.jobId,
            stage: 'queued',
            message: 'Scan queued.',
            progress: 0,
            scan: null,
            error: null
        });
    });

    it('returns the complete event after the scan finishes', async () => {
        mocks.scanTransactionsFromImage.mockResolvedValue(scan);

        const job = startTransactionScanJob({} as never, {} as never, 1, {
            imageBase64: 'aW1hZ2U=',
            mimeType: 'image/png'
        });

        await vi.waitFor(() => {
            expect(getTransactionScanJobStatus(job)).toMatchObject({
                jobId: job.jobId,
                stage: 'complete',
                progress: 100,
                scan,
                error: null
            });
        });
    });

    it('returns a failed status for an unknown or unauthorized job token', () => {
        expect(
            getTransactionScanJobStatus({
                jobId: '00000000-0000-4000-8000-000000000042',
                token: 'missing-token'
            })
        ).toEqual({
            jobId: '00000000-0000-4000-8000-000000000042',
            stage: 'failed',
            message: 'Scan job was not found.',
            progress: 100,
            scan: null,
            error: 'Scan job was not found.'
        });
    });
});
