import { TransactionScanLimits } from '@xpenser/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    auth: vi.fn(),
    createXpenserClient: vi.fn(),
    transactionScanCreate: vi.fn()
}));

vi.mock('@/auth', () => ({
    auth: mocks.auth
}));

vi.mock('@/lib/config', () => ({
    webConfig: { apiBaseUrl: 'https://api.example.test' }
}));

vi.mock('@xpenser/client', () => ({
    createXpenserClient: mocks.createXpenserClient
}));

import { POST } from './route';

function scanRequest(file: File) {
    const formData = new FormData();
    formData.set('image', file);
    return new Request('https://app.example.test/api/transaction-scans', {
        method: 'POST',
        body: formData
    });
}

describe('transaction scan route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auth.mockResolvedValue({ apiToken: 'api-token' });
        mocks.createXpenserClient.mockReturnValue({
            transactionScans: { create: mocks.transactionScanCreate }
        });
        mocks.transactionScanCreate.mockResolvedValue({
            scanId: 42,
            documentKind: 'receipt',
            warnings: [],
            drafts: []
        });
    });

    it('forwards a valid image to the scanner API', async () => {
        const file = new File(['receipt bytes'], 'receipt.jpg', {
            type: 'image/jpeg'
        });

        const response = await POST(scanRequest(file));

        await expect(response.json()).resolves.toEqual({
            scan: {
                scanId: 42,
                documentKind: 'receipt',
                warnings: [],
                drafts: []
            }
        });
        expect(response.status).toBe(200);
        expect(mocks.createXpenserClient).toHaveBeenCalledWith({
            baseUrl: 'https://api.example.test',
            getToken: expect.any(Function),
            retryOnTimeout: false,
            timeoutMs: 60_000
        });
        expect(mocks.transactionScanCreate).toHaveBeenCalledWith({
            body: {
                imageBase64: Buffer.from('receipt bytes').toString('base64'),
                mimeType: 'image/jpeg',
                fileName: 'receipt.jpg'
            }
        });
    });

    it('rejects oversized images before calling the scanner API', async () => {
        const file = new File(
            [new Uint8Array(TransactionScanLimits.maxImageBytes + 1)],
            'large.jpg',
            { type: 'image/jpeg' }
        );

        const response = await POST(scanRequest(file));

        await expect(response.json()).resolves.toEqual({
            error: 'Image must be 10 MB or smaller.'
        });
        expect(response.status).toBe(413);
        expect(mocks.transactionScanCreate).not.toHaveBeenCalled();
    });
});
