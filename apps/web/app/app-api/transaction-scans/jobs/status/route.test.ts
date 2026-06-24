import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    createXpenserClient: vi.fn(),
    transactionScanStatus: vi.fn()
}));

vi.mock('@/lib/config', () => ({
    webConfig: { apiBaseUrl: 'https://api.example.test' }
}));

vi.mock('@xpenser/client', () => ({
    createXpenserClient: mocks.createXpenserClient
}));

import { GET } from './route';

function statusRequest(query = '?jobId=job-1&token=token-1') {
    return new Request(
        `https://app.example.test/app-api/transaction-scans/jobs/status${query}`
    );
}

describe('transaction scan job status route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.createXpenserClient.mockReturnValue({
            transactionScans: { status: mocks.transactionScanStatus }
        });
        mocks.transactionScanStatus.mockResolvedValue({
            jobId: 'job-1',
            stage: 'analyzing',
            message: 'Reading image details with AI.',
            progress: 45,
            scan: null,
            error: null
        });
    });

    it('forwards job status requests to the scanner API', async () => {
        const response = await GET(statusRequest());

        await expect(response.json()).resolves.toEqual({
            jobId: 'job-1',
            stage: 'analyzing',
            message: 'Reading image details with AI.',
            progress: 45,
            scan: null,
            error: null
        });
        expect(response.status).toBe(200);
        expect(mocks.createXpenserClient).toHaveBeenCalledWith({
            baseUrl: 'https://api.example.test',
            retryOnTimeout: false
        });
        expect(mocks.transactionScanStatus).toHaveBeenCalledWith({
            query: { jobId: 'job-1', token: 'token-1' }
        });
    });

    it('rejects missing job status query values', async () => {
        const response = await GET(statusRequest('?jobId=job-1'));

        await expect(response.json()).resolves.toEqual({
            error: 'Could not connect to scan progress. Try again.'
        });
        expect(response.status).toBe(400);
        expect(mocks.transactionScanStatus).not.toHaveBeenCalled();
    });
});
