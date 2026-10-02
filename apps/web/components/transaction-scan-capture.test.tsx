/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Category, Currency } from '@xpenser/contracts';
import { XpenserFormProvider } from '@xpenser/ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ScanWizard,
    TransactionCaptureWorkspace,
    waitForScanJob
} from './transaction-scan-capture';

const refresh = vi.fn();
const createCaptureTransactionAction = vi.fn();
const createVendorAction = vi.fn();
const recordTransactionScanDecisionAction = vi.fn();
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe('durable scan reconnection', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });
    it('survives more than three failed polls without resubmitting', async () => {
        vi.useFakeTimers();
        const scan = {
            scanId: 1,
            documentKind: 'receipt',
            drafts: [],
            warnings: []
        };
        const fetcher = vi
            .fn()
            .mockRejectedValueOnce(new Error('restart'))
            .mockRejectedValueOnce(new Error('restart'))
            .mockRejectedValueOnce(new Error('restart'))
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    jobId: 'job',
                    stage: 'queued',
                    progress: 0,
                    message: 'Retrying',
                    scan: null,
                    error: null
                })
            })
            .mockResolvedValue({
                ok: true,
                json: async () => ({
                    jobId: 'job',
                    stage: 'complete',
                    progress: 100,
                    message: 'Done',
                    scan,
                    error: null
                })
            });
        vi.stubGlobal('fetch', fetcher);
        const onProgress = vi.fn();
        const result = waitForScanJob(
            { jobId: 'job', token: 'capability' },
            onProgress
        );
        await vi.advanceTimersByTimeAsync(7_000);
        expect(await result).toEqual(scan);
        expect(fetcher).toHaveBeenCalledTimes(5);
        expect(onProgress).toHaveBeenCalledWith(
            expect.objectContaining({ stage: 'queued' })
        );
        expect(
            fetcher.mock.calls.every(([url]) =>
                String(url).includes('jobId=job')
            )
        ).toBe(true);
    });
    it('stops retrying after a bounded interruption', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
        const outcome = waitForScanJob(
            { jobId: 'job', token: 'capability' },
            vi.fn()
        ).catch(error => error);
        await vi.advanceTimersByTimeAsync(66_000);
        expect(await outcome).toMatchObject({
            message: 'Could not connect to scan progress. Try again.'
        });
    });
});

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
        budgetId: 1,
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
    it('preserves rejected scan edits and retries confirmation without creating twice', async () => {
        const draft = {
            id: 1,
            amount: 12,
            categoryId: 7,
            currency: 'USD',
            occurredAt: timestamp,
            vendorId: null,
            suggestedVendorName: null,
            suggestedCategory: null,
            transactionType: 'expense' as const,
            note: 'Receipt note',
            evidence: 'Receipt',
            confidence: {
                amount: 'high' as const,
                category: 'high' as const,
                currency: 'high' as const,
                date: 'high' as const,
                overall: 'high' as const,
                vendor: 'high' as const
            },
            possibleDuplicateTransactionIds: []
        };
        createCaptureTransactionAction
            .mockResolvedValueOnce({
                ok: false,
                error: 'Check note',
                issues: [{ pointer: '/note', detail: 'Note rejected' }]
            })
            .mockResolvedValueOnce({
                ok: true,
                data: {
                    id: 9,
                    amount: 12,
                    currency: 'USD',
                    occurredAt: timestamp,
                    categoryName: 'Groceries',
                    type: 'expense'
                }
            });
        recordTransactionScanDecisionAction
            .mockResolvedValueOnce({
                ok: false,
                error: 'Confirmation unavailable'
            })
            .mockResolvedValueOnce({ ok: true, data: undefined });
        render(
            <XpenserFormProvider>
                <ScanWizard
                    attachment={{
                        fileName: 'receipt.png',
                        mimeType: 'image/png',
                        uploadId: 'test-upload'
                    }}
                    categories={[category()]}
                    currencies={currencies}
                    defaultCurrency="USD"
                    timezone="UTC"
                    transactionTags={[]}
                    transactionCurrencies={['USD']}
                    vendors={[]}
                    setCategories={vi.fn()}
                    setVendors={vi.fn()}
                    onReset={vi.fn()}
                    scan={{
                        scanId: 1,
                        documentKind: 'receipt',
                        warnings: [],
                        drafts: [
                            draft,
                            { ...draft, id: 2, note: 'Second item' }
                        ]
                    }}
                />
            </XpenserFormProvider>
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm and save' })
        );
        await screen.findByText('Note rejected');
        expect(recordTransactionScanDecisionAction).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText('Note'), {
            target: { value: 'Corrected note' }
        });
        expect(screen.queryByText('Note rejected')).toBeNull();
        fireEvent.click(
            screen.getByRole('button', { name: 'Confirm and save' })
        );
        await screen.findByRole('button', { name: 'Retry finishing save' });
        fireEvent.click(
            screen.getByRole('button', { name: 'Retry finishing save' })
        );
        await waitFor(() =>
            expect(
                (screen.getByLabelText('Note') as HTMLTextAreaElement).value
            ).toBe('Second item')
        );
        expect(createCaptureTransactionAction).toHaveBeenCalledTimes(2);
        expect(recordTransactionScanDecisionAction).toHaveBeenCalledTimes(2);
        expect(
            recordTransactionScanDecisionAction.mock.calls[1]![0].body
                .transactionId
        ).toBe(9);
    });
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
