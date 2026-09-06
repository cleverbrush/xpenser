import { expect, test, type APIRequestContext } from '@playwright/test';
import { testUser, uniqueName } from './helpers';

// These tests handle short-lived JWTs and API keys. Do not persist credentials
// in Playwright traces; failures assert only statuses and non-secret fields.
test.use({ trace: 'off', storageState: { cookies: [], origins: [] } });

const apiBase = '/api/api';

async function login(request: APIRequestContext) {
    // Exercise the existing pass-through API proxy with an explicit API path.
    const response = await request.post(`${apiBase}/auth/login`, {
        data: testUser
    });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { token: string };
    return { authorization: `Bearer ${body.token}` };
}

test('native authentication preserves API-key transports, precedence, and revocation', async ({
    request
}) => {
    const headers = await login(request);
    let keyId: number | undefined;
    let revoked = false;
    try {
        const created = await request.post(`${apiBase}/users/me/api-keys`, {
            headers,
            data: { name: uniqueName('E2E native auth') }
        });
        expect(created.status()).toBe(201);
        const { key, apiKey } = (await created.json()) as {
            key: string;
            apiKey: { id: number };
        };
        keyId = apiKey.id;

        const credentials: Record<string, string>[] = [
            headers,
            { 'x-api-key': key },
            { authorization: `Bearer ${key}` }
        ];
        for (const credential of credentials) {
            const response = await request.get(`${apiBase}/auth/me`, {
                headers: credential
            });
            expect(response.status()).toBe(200);
            expect(await response.json()).toMatchObject({
                email: testUser.email
            });
        }

        const invalid = await request.get(`${apiBase}/auth/me`, {
            headers: { ...headers, 'x-api-key': 'invalid-e2e-key' }
        });
        expect(invalid.status()).toBe(401);
        expect(invalid.headers()['www-authenticate']).toBe('Bearer');

        const removed = await request.delete(
            `${apiBase}/users/me/api-keys/${keyId}`,
            { headers }
        );
        expect(removed.status()).toBe(204);
        revoked = true;
        const revokedCredentials: Record<string, string>[] = [
            { ...headers, 'x-api-key': key },
            { authorization: `Bearer ${key}` }
        ];
        for (const credential of revokedCredentials) {
            const response = await request.get(`${apiBase}/auth/me`, {
                headers: credential
            });
            expect(response.status()).toBe(401);
        }
    } finally {
        if (keyId !== undefined && !revoked) {
            const response = await request.delete(
                `${apiBase}/users/me/api-keys/${keyId}`,
                { headers }
            );
            expect(response.status()).toBe(204);
        }
    }
});

test('budget lists keep each budget favorite currency list after a fresh read', async ({
    request
}) => {
    const headers = await login(request);
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
