import { expect, test } from '@playwright/test';
import { apiBase, loginApi } from './api-helpers';
import { uniqueName } from './helpers';

// API setup uses short-lived tokens; keep UI traces in budgets.spec.ts separate.
test.use({ trace: 'off', storageState: { cookies: [], origins: [] } });

test('budget lists keep each budget favorite currency list after a fresh read', async ({
    request
}) => {
    const headers = await loginApi(request);
    const ids: number[] = [];
    try {
        for (const favorites of [['GBP', 'EUR'], []]) {
            const response = await request.post(`${apiBase}/budgets`, {
                headers,
                data: {
                    name: uniqueName('E2E currency batch'),
                    defaultCurrency: 'USD',
                    favoriteCurrencies: favorites
                }
            });
            expect(response.status()).toBe(201);
            const budget = (await response.json()) as { id: number };
            ids.push(budget.id);
        }

        for (let read = 0; read < 2; read++) {
            const response = await request.get(`${apiBase}/budgets`, {
                headers
            });
            expect(response.status()).toBe(200);
            const budgets = (await response.json()) as {
                id: number;
                favoriteCurrencies: string[];
            }[];
            expect(
                budgets.find(budget => budget.id === ids[0])?.favoriteCurrencies
            ).toEqual(['EUR', 'GBP']);
            expect(
                budgets.find(budget => budget.id === ids[1])?.favoriteCurrencies
            ).toEqual([]);
        }
    } finally {
        for (const id of ids) {
            const archived = await request.patch(`${apiBase}/budgets/${id}`, {
                headers,
                data: { archived: true }
            });
            expect(archived.status()).toBe(200);
            const deleted = await request.delete(`${apiBase}/budgets/${id}`, {
                headers
            });
            expect(deleted.status()).toBe(204);
        }
    }
});
