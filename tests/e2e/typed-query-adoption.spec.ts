import { expect, test } from '@playwright/test';
import { testUser, uniqueName } from './helpers';

// API fixture setup uses short-lived tokens; keep them out of trace artifacts.
test.use({ trace: 'off' });

test('typed reads preserve transaction paging, tag counts and budget filtering', async ({ request, page, context, baseURL }, testInfo) => {
    const login = await request.post('/api/api/auth/login', { data: testUser });
    expect(login.status()).toBe(200);
    const { token } = await login.json();
    const headers = { authorization: `Bearer ${token}` };
    const ids: number[] = [];
    try {
        for (const suffix of ['visible', 'other']) {
            const created = await request.post('/api/api/budgets', {
                headers, data: { name: uniqueName(`E2E typed ${suffix}`), defaultCurrency: 'USD' }
            });
            expect(created.status()).toBe(201);
            ids.push((await created.json()).id);
        }
        const budgetId = ids[0]!;
        const category = await request.post('/api/api/categories', {
            headers, data: { budgetId, name: uniqueName('Typed meals'), type: 'expense' }
        });
        expect(category.status()).toBe(201);
        const categoryId = (await category.json()).id;
        const transactionIds: number[] = [];
        const tagName = uniqueName('Typed shared tag');
        for (let i = 0; i < 4; i++) {
            const response = await request.post('/api/api/transactions', {
                headers, data: {
                    budgetId, categoryId, amount: 12.34, currency: 'USD',
                    occurredAt: '2026-06-01T12:00:00.000Z',
                    note: i === 0 ? 'literal 50%_!' : `typed row ${i}`,
                    tags: i < 2 ? [tagName] : []
                }
            });
            expect(response.status()).toBe(201);
            transactionIds.push((await response.json()).id);
        }
        for (const direction of ['asc', 'desc']) {
            const seen: number[] = [];
            for (const pageNumber of [1, 2]) {
                const response = await request.get('/api/api/transactions', {
                    headers, params: { budgetId, direction, page: pageNumber, limit: 2 }
                });
                expect(response.status()).toBe(200);
                const result = await response.json();
                expect(result).toMatchObject({ total: 4, page: pageNumber, limit: 2 });
                seen.push(...result.items.map((item: { id: number }) => item.id));
            }
            expect(seen).toEqual(direction === 'asc' ? transactionIds : [...transactionIds].reverse());
        }
        const filtered = await request.get('/api/api/transactions', {
            headers, params: { budgetId, search: '50%_!' }
        });
        expect(filtered.status()).toBe(200);
        expect(await filtered.json()).toMatchObject({ total: 1, items: [{ id: transactionIds[0], amount: 12.34 }] });
        const tags = await request.get('/api/api/transaction-tags', { headers, params: { budgetId } });
        expect(tags.status()).toBe(200);
        expect(await tags.json()).toMatchObject([{ name: tagName, transactionCount: 2 }]);
        const other = await request.get('/api/api/transactions', { headers, params: { budgetId: ids[1]! } });
        expect(other.status()).toBe(200);
        expect(await other.json()).toMatchObject({ total: 0, items: [] });
        const members = await request.get(`/api/api/budgets/${budgetId}/members`, { headers });
        expect(members.status()).toBe(200);
        expect(await members.json()).toMatchObject([{ email: testUser.email, role: 'admin' }]);
        const exported = await request.get('/api/api/transactions/export.csv', {
            headers, params: { budgetId, currencies: 'USD', direction: 'asc' }
        });
        expect(exported.status()).toBe(200);
        expect((await exported.text()).trim().split('\n')).toHaveLength(5);

        if (!baseURL) throw new Error('Missing preview URL');
        await context.addCookies([{ name: 'xpenser_selected_budget', value: String(budgetId), url: baseURL }]);
        await page.goto('/transactions?direction=asc');
        await expect(page.getByRole('heading', { level: 1, name: 'Transactions', exact: true })).toBeVisible();
        await expect(page.getByText(tagName, { exact: true }).first()).toBeVisible();
        await testInfo.attach('typed-query-transactions.png', { body: await page.screenshot(), contentType: 'image/png' });
    } finally {
        for (const id of ids) {
            const archived = await request.patch(`/api/api/budgets/${id}`, { headers, data: { archived: true } });
            expect(archived.status()).toBe(200);
            const deleted = await request.delete(`/api/api/budgets/${id}`, { headers });
            expect(deleted.status()).toBe(204);
        }
    }
});
