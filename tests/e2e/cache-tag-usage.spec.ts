import { expect, test as base } from '@playwright/test';
import { testUser, uniqueName } from './helpers';

type CacheFixture = {
    vendors: { id: number; name: string }[];
    notes: string[];
};

// API fixture setup handles a short-lived JWT. Never record it in traces.
const test = base.extend<{ cacheFixture: CacheFixture }>({
    cacheFixture: async ({ page, context, request, baseURL }, use) => {
        const login = await request.post('/api/api/auth/login', { data: testUser });
        expect(login.status()).toBe(200);
        const { token } = (await login.json()) as { token: string };
        const headers = { authorization: `Bearer ${token}` };

        // Creating through the UI also invalidates Next.js's cached profile,
        // so the newly selected budget is visible immediately.
        await page.goto('/settings/budgets');
        await page.getByLabel('Name', { exact: true }).fill(uniqueName('E2E cache budget'));
        await page.getByRole('button', { name: 'Create', exact: true }).click();
        await page.waitForURL(/\/settings\/budgets\/\d+$/);
        const budgetId = Number(new URL(page.url()).pathname.split('/').at(-1));
        expect(Number.isSafeInteger(budgetId)).toBe(true);
        try {
            if (!baseURL) throw new Error('Missing preview URL');
            await context.addCookies([{ name: 'xpenser_selected_budget', value: String(budgetId), url: baseURL }]);
            const categoryResponse = await request.post('/api/api/categories', {
                headers, data: { budgetId, name: uniqueName('E2E cache category'), type: 'expense' }
            });
            expect(categoryResponse.status()).toBe(201);
            const category = (await categoryResponse.json()) as { id: number };
            const vendors: CacheFixture['vendors'] = [];
            const notes: string[] = [];
            for (const suffix of ['alpha', 'beta']) {
                const name = uniqueName(`E2E cache vendor ${suffix}`);
                const response = await request.post('/api/api/vendors', {
                    headers,
                    // Explicit fixture metadata avoids third-party brand enrichment.
                    data: { budgetId, name, resolvedName: name }
                });
                expect(response.status()).toBe(201);
                vendors.push((await response.json()) as { id: number; name: string });
                const note = uniqueName(`E2E cache ${suffix} note`);
                notes.push(note);
                const transaction = await request.post('/api/api/transactions', {
                    headers,
                    data: { budgetId, categoryId: category.id, vendorId: vendors.at(-1)?.id, amount: 10, currency: 'USD', occurredAt: new Date().toISOString(), note }
                });
                expect(transaction.status()).toBe(201);
            }
            await use({ vendors, notes });
        } finally {
            // Remove only this fixture's isolated budget and its child records.
            const archived = await request.patch(`/api/api/budgets/${budgetId}`, { headers, data: { archived: true } });
            expect(archived.status()).toBe(200);
            const deleted = await request.delete(`/api/api/budgets/${budgetId}`, { headers });
            expect(deleted.status()).toBe(204);
        }
    }
});

test.use({ trace: 'off' });

test('vendor searches, detail reads, and edits keep the correct profile', async ({ page, cacheFixture }, testInfo) => {
    const [first, second] = cacheFixture.vendors;
    await page.goto('/settings/vendors');
    for (const vendor of [first, second, first]) {
        await page.getByLabel('Search vendors').fill(vendor.name);
        await page.getByRole('button', { name: 'Search', exact: true }).click();
        await page.waitForURL(url => url.searchParams.get('search') === vendor.name);
        const row = page.getByRole('row').filter({ hasText: vendor.name });
        await expect(row).toBeVisible();
        await row.getByRole('link', { name: 'Open', exact: true }).click();
        await expect(page.getByRole('heading', { level: 1, name: vendor.name, exact: true })).toBeVisible();
        if (vendor.id === first.id) {
            await page.getByRole('button', { name: 'Edit', exact: true }).click();
            const dialog = page.getByRole('dialog', { name: 'Edit vendor' });
            const description = 'Saved profile from cache regression test';
            await dialog.getByLabel('Description', { exact: true }).fill(description);
            await dialog.getByRole('button', { name: 'Save vendor' }).click();
            await expect(dialog).toBeHidden();
            await expect(page.getByText(description, { exact: true })).toBeVisible();
        }
        await testInfo.attach(`vendor-${vendor.id}.png`, { body: await page.screenshot(), contentType: 'image/png' });
        await page.getByRole('link', { name: 'Vendors', exact: true }).last().click();
        await page.waitForURL(/\/settings\/vendors$/);
    }
});

test('transaction filters and CSV export use the currently selected records', async ({ page, cacheFixture }, testInfo) => {
    const [first, second] = cacheFixture.notes;
    await page.goto(`/transactions?search=${encodeURIComponent(first)}`);
    await expect(page.getByRole('row').filter({ hasText: first })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: second })).toHaveCount(0);
    if (!(await page.getByLabel('Search', { exact: true }).isVisible())) {
        await page.getByRole('button', { name: /^Filters/ }).click();
    }
    await page.getByLabel('Search', { exact: true }).fill(second);
    await page.getByLabel('Search', { exact: true }).press('Enter');
    await page.waitForURL(url => url.searchParams.get('search') === second);
    await expect(page.getByRole('row').filter({ hasText: second })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: first })).toHaveCount(0);
    await page.getByRole('button', { name: 'View settings', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Export CSV', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Export CSV' });
    const downloading = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export', exact: true }).click();
    const download = await downloading;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const csv = Buffer.concat(chunks).toString('utf8');
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    expect(csv).toContain(second);
    expect(csv).not.toContain(first);
    await expect(dialog).toBeHidden();
    await testInfo.attach('filtered-export.csv', { body: Buffer.from(csv), contentType: 'text/csv' });
    await testInfo.attach('filtered-transactions.png', { body: await page.screenshot(), contentType: 'image/png' });
});
