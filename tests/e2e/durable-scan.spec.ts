import { expect, type Page, test } from '@playwright/test';

const job = { jobId: 'browser-recovery-test', token: 'test-capability' };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVyoAAAAASUVORK5CYII=', 'base64');
const draft = {
    id: 1, amount: 12.34, currency: 'USD', occurredAt: '2026-10-01T12:00:00.000Z',
    categoryId: null, vendorId: null, transactionType: 'expense', note: 'Recovery test receipt',
    evidence: 'Lunch 12.34', suggestedCategory: null, suggestedVendorName: null,
    possibleDuplicateTransactionIds: [],
    confidence: { amount: 'high', category: 'low', currency: 'high', date: 'high', overall: 'high', vendor: 'low' }
};

async function upload(page: Page) {
    await page.route('**/app-api/transaction-scans', route => route.fulfill({ json: {
        job, attachment: { fileName: 'receipt.png', mimeType: 'image/png', uploadId: 'test-upload' }
    } }));
    await page.goto('/capture');
    await page.getByRole('button', { name: 'Scan', exact: true }).click();
    await page.locator('#scan-image').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: png });
}

test('scan review survives multiple failed polls and a retry-wait without resubmission', async ({ page }) => {
    let polls = 0;
    let uploads = 0;
    page.on('request', request => { if (new URL(request.url()).pathname === '/app-api/transaction-scans') uploads++; });
    await page.route('**/app-api/transaction-scans/jobs/status?**', async route => {
        polls++;
        if (polls <= 3) return route.fulfill({ status: 503, json: { error: 'Restarting' } });
        const complete = polls >= 5;
        return route.fulfill({ json: {
            jobId: job.jobId, stage: complete ? 'complete' : 'queued', progress: complete ? 100 : 0,
            message: complete ? 'Found 1 transaction for review.' : 'Scan interrupted. Retrying automatically.',
            error: null, scan: complete ? { scanId: 1, documentKind: 'receipt', warnings: [], drafts: [draft] } : null
        } });
    });
    await upload(page);
    await expect(page.getByText('Scan interrupted. Retrying automatically.')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#scan-note')).toHaveValue('Recovery test receipt');
    await expect(page.getByRole('button', { name: 'Confirm and save', exact: true })).toBeVisible();
    expect(polls).toBeGreaterThanOrEqual(5);
    expect(uploads).toBe(1);
    await expect(page.getByText('Could not connect to scan progress. Try again.')).toHaveCount(0);
});

test('terminal scan errors remain visible without restarting the job', async ({ page }) => {
    await page.route('**/app-api/transaction-scans/jobs/status?**', route => route.fulfill({ json: {
        jobId: job.jobId, stage: 'failed', progress: 100, message: 'Scan failed.',
        error: 'Could not scan the image. Try again.', scan: null
    } }));
    await upload(page);
    await expect(page.getByText('Could not scan the image. Try again.', { exact: true })).toBeVisible();
    await expect(page.locator('#scan-image')).toBeEnabled();
});

test('avatar form submits a typed image and confirms the saved upload', async ({ page }) => {
    await page.goto('/settings/preferences');
    await page.getByLabel('Avatar image').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    await expect(page.getByText('Avatar uploaded.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove uploaded avatar' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove uploaded avatar' }).click();
    await expect(page.getByRole('button', { name: 'Remove uploaded avatar' })).toHaveCount(0);
});
