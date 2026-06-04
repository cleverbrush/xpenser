import { TransactionScanLimits } from '@xpenser/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteScanUpload } from '@/lib/transaction-scan-upload-store';

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

const uploadId = '00000000-0000-4000-8000-000000000001';
const userId = '1';

function scanRequest(body: Record<string, unknown>) {
    return new Request('https://app.example.test/api/transaction-scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

function chunkBody(overrides: Partial<Record<string, unknown>> = {}) {
    const bytes = Buffer.from('receipt bytes');
    return {
        chunkBase64: bytes.toString('base64'),
        chunkIndex: 0,
        fileName: 'receipt.jpg',
        fileSize: bytes.length,
        mimeType: 'image/jpeg',
        totalChunks: 1,
        uploadId,
        ...overrides
    };
}

describe('transaction scan route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.auth.mockResolvedValue({
            apiToken: 'api-token',
            user: { id: userId }
        });
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

    afterEach(async () => {
        await deleteScanUpload(userId, uploadId);
    });

    it('forwards a valid image to the scanner API', async () => {
        const response = await POST(scanRequest(chunkBody()));

        await expect(response.json()).resolves.toEqual({
            attachment: {
                fileName: 'receipt.jpg',
                mimeType: 'image/jpeg',
                uploadId
            },
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
            timeoutMs: 95_000
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
        const response = await POST(
            scanRequest(
                chunkBody({
                    fileSize: TransactionScanLimits.maxImageBytes + 1
                })
            )
        );

        await expect(response.json()).resolves.toEqual({
            error: 'Image must be 10 MB or smaller.'
        });
        expect(response.status).toBe(413);
        expect(mocks.transactionScanCreate).not.toHaveBeenCalled();
    });
});
