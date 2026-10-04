import { expect, test } from '@playwright/test';
import { apiBase, loginApi } from './api-helpers';
import { uniqueName } from './helpers';

test.use({ trace: 'off' });

test('transaction retries replay one save over HTTP and after a lost browser response', async ({
    page, request, context, baseURL
}, testInfo) => {
    const headers = await loginApi(request);
    await page.goto('/settings/budgets');
    await page.getByLabel('Name', { exact: true }).fill(uniqueName('Retry checks'));
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForURL(/\/settings\/budgets\/\d+$/);
    const budgetId = Number(new URL(page.url()).pathname.split('/').at(-1));
    expect(Number.isSafeInteger(budgetId)).toBe(true);
    try {
        const category = await request.post(apiBase + '/categories', {
            headers, data: { budgetId, name: 'Meals', type: 'expense' }
        });
        expect(category.status()).toBe(201);
        const categoryId = (await category.json()).id;
        const data = { budgetId, categoryId, amount: 12.34, currency: 'USD', occurredAt: new Date().toISOString(), note: 'HTTP retry' };
        const key = crypto.randomUUID();
        const responses = await Promise.all(Array.from({ length: 3 }, () => request.post(apiBase + '/transactions', {
            headers: { ...headers, 'x-idempotency-key': key }, data
        })));
        const bodies = await Promise.all(responses.map(response => response.json()));
        expect(responses.map(response => response.status())).toEqual([201, 201, 201]);
        expect(new Set(bodies.map(body => body.id)).size).toBe(1);
        expect(new Set(responses.map(response => response.headers().location)).size).toBe(1);
        const intentional = await request.post(apiBase + '/transactions', {
            headers: { ...headers, 'x-idempotency-key': crypto.randomUUID() }, data
        });
        expect(intentional.status()).toBe(201);
        expect((await intentional.json()).id).not.toBe(bodies[0].id);

        if (!baseURL) throw new Error('Missing preview URL');
        await context.addCookies([{ name: 'xpenser_selected_budget', value: String(budgetId), url: baseURL }]);
        await page.goto('/capture');
        await page.getByLabel('Amount', { exact: true }).fill('23.45');
        await page.getByLabel('Note', { exact: true }).fill('Browser response lost');
        let lost = false;
        await page.route('**/capture', async route => {
            if (!lost && route.request().method() === 'POST' && route.request().headers()['next-action']) {
                lost = true;
                const response = await route.fetch();
                expect(response.ok()).toBe(true); // The action completed before the response was lost.
                await route.abort('failed');
            } else {
                await route.continue();
            }
        });
        const save = page.getByRole('button', { name: 'Save transaction', exact: true });
        await save.click();
        await expect(page.getByText('Could not save the transaction.', { exact: true })).toBeVisible();
        expect(lost).toBe(true);
        await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('23.45');
        await save.click();
        await expect(page.getByText('Saved', { exact: true })).toBeVisible();
        const listed = await request.get(apiBase + '/transactions', { headers, params: { budgetId } });
        expect(listed.status()).toBe(200);
        const result = await listed.json();
        expect(result.total).toBe(3);
        expect(result.items.filter((item: { note: string }) => item.note === 'Browser response lost')).toHaveLength(1);
        await testInfo.attach('transaction-retry.png', { body: await page.screenshot(), contentType: 'image/png' });
    } finally {
        await request.patch(apiBase + '/budgets/' + budgetId, { headers, data: { archived: true } });
        const removed = await request.delete(apiBase + '/budgets/' + budgetId, { headers });
        expect(removed.status()).toBe(204);
    }
});
