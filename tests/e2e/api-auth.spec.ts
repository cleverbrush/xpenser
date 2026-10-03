import { expect, test } from '@playwright/test';
import { apiBase, loginApi } from './api-helpers';
import { testUser, uniqueName } from './helpers';

// These tests handle JWTs and API keys. Assertions never include secret fields.
test.use({ trace: 'off', storageState: { cookies: [], origins: [] } });

test('anonymous requests and invalid passwords retain authentication errors', async ({
    request
}) => {
    const anonymous = await request.get(`${apiBase}/vendors`);
    expect(anonymous.status()).toBe(401);
    expect(anonymous.headers()['www-authenticate']).toBe('Bearer');

    const invalidLogin = await request.post(`${apiBase}/auth/login`, {
        data: { email: testUser.email, password: 'wrong-auth-test-password' }
    });
    expect(invalidLogin.status()).toBe(401);
    expect(await invalidLogin.json()).toHaveProperty('message');
});

test('native authentication preserves API-key transports, precedence, and revocation', async ({
    request
}) => {
    const headers = await loginApi(request);
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
        const listed = await request.get(`${apiBase}/users/me/api-keys`, {
            headers
        });
        expect(listed.status()).toBe(200);
        const keys = await listed.json();
        expect(keys).toContainEqual(apiKey);
        for (const entry of keys) {
            expect(Object.keys(entry).sort()).toEqual(
                [
                    'createdAt',
                    'id',
                    'keyPrefix',
                    'name',
                    ...(entry.lastUsedAt ? ['lastUsedAt'] : [])
                ].sort()
            );
        }

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
        const remaining = await request.get(`${apiBase}/users/me/api-keys`, {
            headers
        });
        expect(remaining.status()).toBe(200);
        expect(
            (await remaining.json()).map((entry: { id: number }) => entry.id)
        ).not.toContain(keyId);
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
