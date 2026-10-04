import { expect, test } from '@playwright/test';
import { apiBase, loginApi } from './api-helpers';
import { uniqueName } from './helpers';

test.use({ trace: 'off' });

test('concurrent HTTP retries replay one transaction', async ({ page, request }) => {
    const headers = await loginApi(request);
    await page.goto('/settings/budgets');
    await page
        .getByLabel('Name', { exact: true })
        .fill('Retry ' + uniqueName('QA').split(' ').at(-1));
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForURL(/\/settings\/budgets\/\d+$/);
    const budgetId = Number(new URL(page.url()).pathname.split('/').at(-1));
    expect(Number.isSafeInteger(budgetId)).toBe(true);
    try {
        const category = await request.post(apiBase + '/categories', {
            headers,
            data: { budgetId, name: 'Meals', type: 'expense' }
        });
        expect(category.status()).toBe(201);
        const categoryId = (await category.json()).id;
        const data = {
            budgetId,
            categoryId,
            amount: 12.34,
            currency: 'USD',
            occurredAt: new Date().toISOString(),
            note: 'HTTP retry'
        };
        const key = crypto.randomUUID();
        const responses = await Promise.all(
            Array.from({ length: 3 }, () =>
                request.post(apiBase + '/transactions', {
                    headers: { ...headers, 'x-idempotency-key': key },
                    data
                })
            )
        );
        const bodies = await Promise.all(
            responses.map(response => response.json())
        );
        expect(responses.map(response => response.status())).toEqual([
            201, 201, 201
        ]);
        expect(new Set(bodies.map(body => body.id)).size).toBe(1);
        expect(
            new Set(responses.map(response => response.headers().location)).size
        ).toBe(1);
        const intentional = await request.post(apiBase + '/transactions', {
            headers: { ...headers, 'x-idempotency-key': crypto.randomUUID() },
            data
        });
        expect(intentional.status()).toBe(201);
        expect((await intentional.json()).id).not.toBe(bodies[0].id);

        const listed = await request.get(apiBase + '/transactions', {
            headers,
            params: { budgetId }
        });
        expect(listed.status()).toBe(200);
        expect((await listed.json()).total).toBe(2);
    } finally {
        await request.patch(apiBase + '/budgets/' + budgetId, {
            headers,
            data: { archived: true }
        });
        const removed = await request.delete(apiBase + '/budgets/' + budgetId, {
            headers
        });
        expect(removed.status()).toBe(204);
    }
});
