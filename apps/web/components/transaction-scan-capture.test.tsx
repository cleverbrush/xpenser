/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Category, Currency } from '@xpenser/contracts';
import { XpenserFormProvider } from '@xpenser/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionCaptureWorkspace } from './transaction-scan-capture';

const refresh = vi.fn();
const createCaptureTransactionAction = vi.fn();
const createVendorAction = vi.fn();
const recordTransactionScanDecisionAction = vi.fn();
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh })
}));

vi.mock('@/lib/actions', () => ({
    createCaptureTransactionAction: (formData: FormData) =>
        createCaptureTransactionAction(formData),
    createVendorAction: (formData: FormData) => createVendorAction(formData),
    recordTransactionScanDecisionAction: (body: unknown) =>
        recordTransactionScanDecisionAction(body)
}));

const timestamp = new Date('2026-06-01T12:00:00.000Z');

function category(overrides: Partial<Category> = {}): Category {
    return {
        id: 7,
        name: 'Groceries',
        type: 'expense',
        parentId: null,
        kind: 'normal',
        displayName: 'Groceries',
        inUse: true,
        hasChildren: false,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

const currencies: Currency[] = [{ code: 'USD', name: 'US dollar' }];

function renderWorkspace() {
    return render(
        <XpenserFormProvider>
            <TransactionCaptureWorkspace
                categories={[category()]}
                currencies={currencies}
                defaultCurrency="USD"
                timezone="UTC"
                transactionTags={[]}
                transactionCurrencies={['USD']}
                vendors={[]}
            />
        </XpenserFormProvider>
    );
}

describe('TransactionCaptureWorkspace scan upload', () => {
    beforeEach(() => {
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: vi.fn(() => 'blob:receipt')
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: vi.fn()
        });
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: originalCreateObjectURL
        });
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: originalRevokeObjectURL
        });
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        createCaptureTransactionAction.mockReset();
        createVendorAction.mockReset();
        recordTransactionScanDecisionAction.mockReset();
        refresh.mockReset();
    });

    it('starts scanning as soon as an image is selected', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        attachment: {
                            fileName: 'receipt.png',
                            mimeType: 'image/png',
                            uploadId: 'upload-1'
                        },
                        job: {
                            jobId: 'job-1',
                            token: 'token-1'
                        }
                    })
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        jobId: 'job-1',
                        stage: 'analyzing',
                        message: 'Reading image details with AI.',
                        progress: 45,
                        scan: null,
                        error: null
                    })
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: () =>
                    Promise.resolve({
                        jobId: 'job-1',
                        stage: 'complete',
                        message: 'Found 0 transactions for review.',
                        progress: 100,
                        scan: {
                            scanId: 1,
                            documentKind: 'receipt',
                            warnings: [],
                            drafts: []
                        },
                        error: null
                    })
            } as Response);

        renderWorkspace();
        fireEvent.click(screen.getByRole('button', { name: 'Scan' }));
        expect(screen.queryByRole('button', { name: 'Scan image' })).toBeNull();

        fireEvent.change(screen.getByLabelText('Choose image'), {
            target: {
                files: [
                    new File(['receipt'], 'receipt.png', {
                        type: 'image/png'
                    })
                ]
            }
        });

        await waitFor(() =>
            expect(fetch).toHaveBeenNthCalledWith(
                1,
                '/app-api/transaction-scans',
                expect.objectContaining({
                    method: 'POST'
                })
            )
        );
        await waitFor(() =>
            expect(screen.getByRole('progressbar')).toBeTruthy()
        );
        expect(
            screen.getByText('Reading visible text and totals.')
        ).toBeTruthy();
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/app-api/transaction-scans/jobs/status'),
            expect.objectContaining({
                headers: { Accept: 'application/json' }
            })
        );

        await waitFor(
            () =>
                expect(screen.getByText('No transactions found')).toBeTruthy(),
            { timeout: 4_000 }
        );
    });
});
