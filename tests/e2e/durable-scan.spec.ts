import { expect, type Page, test } from '@playwright/test';
import { apiBase, loginApi } from './api-helpers';
import { uniqueName } from './helpers';
import { png } from './image-fixtures';

// Fixture authentication must not be captured in traces.
test.use({ trace: 'off' });

const job = { jobId: 'browser-recovery-test', token: 'test-capability' };
const draft = {
    id: 1,
    amount: 12.34,
    currency: 'USD',
    occurredAt: '2026-10-01T12:00:00.000Z',
    categoryId: null,
    vendorId: null,
    transactionType: 'expense',
    note: 'Recovery test receipt',
    evidence: 'Lunch 12.34',
    suggestedCategory: null,
    suggestedVendorName: null,
    possibleDuplicateTransactionIds: [],
    confidence: {
        amount: 'high',
        category: 'low',
        currency: 'high',
        date: 'high',
        overall: 'high',
        vendor: 'low'
    }
};

async function upload(page: Page) {
    await page.route('**/app-api/transaction-scans', route =>
        route.fulfill({
            json: {
                job,
                attachment: {
                    fileName: 'receipt.png',
                    mimeType: 'image/png',
                    uploadId: 'test-upload'
                }
            }
        })
    );
    await page.goto('/capture');
    await page.getByRole('button', { name: 'Scan', exact: true }).click();
    await page.locator('#scan-image').setInputFiles({
        name: 'receipt.png',
        mimeType: 'image/png',
        buffer: png
    });
}

test('scan review survives multiple failed polls and a retry-wait without resubmission', async ({
    page
}) => {
    let polls = 0;
    let uploads = 0;
    page.on('request', request => {
        if (new URL(request.url()).pathname === '/app-api/transaction-scans')
            uploads++;
    });
    await page.route(
        '**/app-api/transaction-scans/jobs/status?**',
        async route => {
            polls++;
            if (polls <= 3)
                return route.fulfill({
                    status: 503,
                    json: { error: 'Restarting' }
                });
            const complete = polls >= 5;
            return route.fulfill({
                json: {
                    jobId: job.jobId,
                    stage: complete ? 'complete' : 'queued',
                    progress: complete ? 100 : 0,
                    message: complete
                        ? 'Found 1 transaction for review.'
                        : 'Scan interrupted. Retrying automatically.',
                    error: null,
                    scan: complete
                        ? {
                              scanId: 1,
                              documentKind: 'receipt',
                              warnings: [],
                              drafts: [draft]
                          }
                        : null
                }
            });
        }
    );
    await upload(page);
    await expect(
        page.getByText('Scan interrupted. Retrying automatically.')
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#scan-note')).toHaveValue(
        'Recovery test receipt'
    );
    await expect(
        page.getByRole('button', { name: 'Confirm and save', exact: true })
    ).toBeVisible();
    expect(polls).toBeGreaterThanOrEqual(5);
    expect(uploads).toBe(1);
    await expect(
        page.getByText('Could not connect to scan progress. Try again.')
    ).toHaveCount(0);
});

test('terminal scan errors remain visible without restarting the job', async ({
    page
}) => {
    await page.route('**/app-api/transaction-scans/jobs/status?**', route =>
        route.fulfill({
            json: {
                jobId: job.jobId,
                stage: 'failed',
                progress: 100,
                message: 'Scan failed.',
                error: 'Could not scan the image. Try again.',
                scan: null
            }
        })
    );
    await upload(page);
    await expect(
        page.getByText('Could not scan the image. Try again.', { exact: true })
    ).toBeVisible();
    await expect(page.locator('#scan-image')).toBeEnabled();
});

test.describe('scanned transaction selectors', () => {
    test('populates the first draft before navigation and loads subsequent drafts', async ({
        page,
        request
    }, testInfo) => {
        const headers = await loginApi(request);
        await page.goto('/settings/budgets');
        await page
            .getByLabel('Name', { exact: true })
            .fill(uniqueName('E2E scan selectors'));
        await page.getByRole('button', { name: 'Create', exact: true }).click();
        await page.waitForURL(/\/settings\/budgets\/\d+$/);
        const budgetId = Number(new URL(page.url()).pathname.split('/').at(-1));
        try {
            const categories = [];
            for (const name of ['Scan groceries', 'Scan travel']) {
                const response = await request.post(`${apiBase}/categories`, {
                    headers,
                    data: { budgetId, name, type: 'expense' }
                });
                expect(response.status()).toBe(201);
                categories.push(await response.json());
            }
            for (const currency of ['EUR', 'USD']) {
                const response = await request.post(`${apiBase}/transactions`, {
                    headers,
                    data: {
                        budgetId,
                        categoryId: categories[0].id,
                        amount: 1,
                        currency,
                        occurredAt: draft.occurredAt,
                        note: 'Scan selector fixture'
                    }
                });
                expect(response.status()).toBe(201);
            }
            // Refresh the cached budget profile after API fixture creation.
            await Promise.all([
                page.waitForResponse(
                    response =>
                        response.request().method() === 'POST' &&
                        new URL(response.url()).pathname ===
                            `/settings/budgets/${budgetId}`
                ),
                page
                    .getByRole('button', {
                        name: 'Save currencies',
                        exact: true
                    })
                    .click()
            ]);
            await page.route(
                '**/app-api/transaction-scans/jobs/status?**',
                route =>
                    route.fulfill({
                        json: {
                            jobId: job.jobId,
                            stage: 'complete',
                            progress: 100,
                            message: 'Found 2 transactions for review.',
                            error: null,
                            scan: {
                                scanId: 1,
                                documentKind: 'receipt',
                                warnings: [],
                                drafts: [
                                    {
                                        ...draft,
                                        categoryId: categories[0].id,
                                        currency: 'EUR'
                                    },
                                    {
                                        ...draft,
                                        id: 2,
                                        categoryId: categories[1].id,
                                        currency: 'USD'
                                    }
                                ]
                            }
                        }
                    })
            );
            await upload(page);
            await expect(
                page.getByLabel('Scanned transaction category')
            ).toHaveText('Scan groceries');
            await expect(
                page.getByLabel('Currency', { exact: true })
            ).toHaveText('EUR');
            await page.screenshot({
                path: testInfo.outputPath('first-scanned-transaction.png')
            });
            await testInfo.attach('first-scanned-transaction', {
                path: testInfo.outputPath('first-scanned-transaction.png'),
                contentType: 'image/png'
            });
            await page.getByLabel('Next scanned transaction').click();
            await expect(
                page.getByLabel('Scanned transaction category')
            ).toHaveText('Scan travel');
            await expect(
                page.getByLabel('Currency', { exact: true })
            ).toHaveText('USD');
            await page.screenshot({
                path: testInfo.outputPath('second-scanned-transaction.png')
            });
            await testInfo.attach('second-scanned-transaction', {
                path: testInfo.outputPath('second-scanned-transaction.png'),
                contentType: 'image/png'
            });
            await page.getByLabel('Previous scanned transaction').click();
            await expect(
                page.getByLabel('Scanned transaction category')
            ).toHaveText('Scan groceries');
            await expect(
                page.getByLabel('Currency', { exact: true })
            ).toHaveText('EUR');
        } finally {
            const archived = await request.patch(
                `${apiBase}/budgets/${budgetId}`,
                {
                    headers,
                    data: { archived: true }
                }
            );
            expect(archived.status()).toBe(200);
            const response = await request.delete(
                `${apiBase}/budgets/${budgetId}`,
                { headers }
            );
            expect(response.status()).toBe(204);
        }
    });
});
