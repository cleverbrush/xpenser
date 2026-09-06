import { signJwt } from '@cleverbrush/auth';
import { number, string } from '@cleverbrush/schema';
import { createServer, endpoint, route } from '@cleverbrush/server';
import { PrincipalSchema } from '@xpenser/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
    generateApiKeyMaterial,
    hashApiKeySecret
} from '../application/api-keys.js';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import { buildServer } from '../server.js';

const config = {
    jwt: { secret: 'x'.repeat(32) },
    app: { url: 'http://localhost:3000' },
    api: { publicBaseUrl: 'http://localhost:4000' }
} as Config;

function jwt(claims: Record<string, unknown> = {}) {
    return signJwt(
        {
            sub: '42',
            role: 'user',
            exp: Math.floor(Date.now() / 1000) + 60,
            ...claims
        },
        config.jwt.secret
    );
}

function fixture(email = 'owner@example.com') {
    const material = generateApiKeyMaterial();
    const key = {
        id: 7,
        userId: 42,
        keyId: material.keyId,
        secretHash: hashApiKeySecret(material.secret),
        revokedAt: undefined as Date | undefined
    };
    const update = vi.fn(async () => undefined);
    const db = {
        apiKeys: {
            where: vi.fn(
                (selector: (row: typeof key) => unknown, value: unknown) => ({
                    first: async () =>
                        selector(key) === value ? key : undefined,
                    update
                })
            )
        },
        users: { find: vi.fn(async () => ({ id: 42, email, role: 'user' })) }
    } as unknown as AppDb;
    return { db, key, material, update };
}

async function withServer(
    run: (baseUrl: string, data: ReturnType<typeof fixture>) => Promise<void>,
    options: { singleUser?: boolean; email?: string } = {}
) {
    const data = fixture(options.email);
    const appConfig = options.singleUser
        ? ({
              ...config,
              singleUser: { enabled: true, email: 'owner@example.com' }
          } as Config)
        : config;
    // Read the real application's registration, then exercise Framework's
    // HTTP authentication/authorization pipeline with a dependency-free handler.
    const app = buildServer(
        appConfig,
        {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        } as never,
        { db: data.db, knex: {} } as never
    );
    const authentication = app.getAuthenticationConfig();
    expect(authentication).toMatchObject({
        defaultScheme: 'jwt',
        trySchemes: ['api-key', 'jwt']
    });
    if (!authentication) throw new Error('Authentication was not registered');

    const server = createServer()
        .useAuthentication(authentication)
        .useAuthorization()
        .handle(
            endpoint
                .get('/protected')
                .authorize(PrincipalSchema)
                .responses({ 200: PrincipalSchema }),
            ({ principal }) => principal
        )
        .handle(
            endpoint.get('/public').public().responses({ 200: string() }),
            () => 'public'
        );

    // Generic registration first: 4.4.2+ must prefer the literal route.
    const items = endpoint.resource('/items');
    const byId = route({ id: number().coerce() })`/${value => value.id}`;
    server.handle(
        items.get(byId).responses({ 200: string() }),
        () => 'dynamic'
    );
    server.handle(
        items.get(route`/export`).responses({ 200: string() }),
        () => 'export'
    );

    const running = await server.listen(0, '127.0.0.1');
    try {
        await run(`http://127.0.0.1:${running.address?.port}`, data);
    } finally {
        await running.close();
    }
}

describe('native multi-scheme HTTP authentication', () => {
    it('accepts JWT and both API-key transports with unchanged principal values', async () => {
        await withServer(async (url, data) => {
            const response = await fetch(`${url}/protected`, {
                headers: { authorization: `Bearer ${jwt()}` }
            });
            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({
                userId: 42,
                role: 'user',
                authType: 'jwt'
            });
            expect(data.db.apiKeys.where).not.toHaveBeenCalled();

            const credentials: Record<string, string>[] = [
                { 'x-api-key': data.material.key },
                { authorization: `Bearer ${data.material.key}` }
            ];
            for (const headers of credentials) {
                const response = await fetch(`${url}/protected`, { headers });
                expect(response.status).toBe(200);
                expect(await response.json()).toEqual({
                    userId: 42,
                    role: 'user',
                    authType: 'api_key',
                    apiKeyId: 7
                });
            }
            expect(data.update).toHaveBeenCalledTimes(2);
            expect(data.update).toHaveBeenLastCalledWith({
                lastUsedAt: expect.any(Date)
            });
        });
    });

    it('gives an explicit API key precedence over another user JWT', async () => {
        await withServer(async (url, data) => {
            const response = await fetch(`${url}/protected`, {
                headers: {
                    'x-api-key': data.material.key,
                    authorization: `Bearer ${jwt({ sub: '99' })}`
                }
            });
            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({
                userId: 42,
                authType: 'api_key'
            });
        });
    });

    it('never falls through from an invalid or revoked explicit key to a valid JWT or bearer key', async () => {
        await withServer(async (url, data) => {
            for (const bearer of [jwt(), data.material.key]) {
                const response = await fetch(`${url}/protected`, {
                    headers: {
                        'x-api-key': 'invalid-key',
                        authorization: `Bearer ${bearer}`
                    }
                });
                expect(response.status).toBe(401);
                await response.arrayBuffer();
            }
            data.key.revokedAt = new Date();
            const credentials: Record<string, string>[] = [
                {
                    'x-api-key': data.material.key,
                    authorization: `Bearer ${jwt()}`
                },
                { authorization: `Bearer ${data.material.key}` }
            ];
            for (const headers of credentials) {
                const response = await fetch(`${url}/protected`, { headers });
                expect(response.status).toBe(401);
                await response.arrayBuffer();
            }
            expect(data.update).not.toHaveBeenCalled();
        });
    });

    it('rejects absent, malformed, expired, unknown-key, and MCP OAuth credentials with the Bearer challenge', async () => {
        await withServer(async url => {
            const credentials: Record<string, string>[] = [
                {},
                { authorization: 'Bearer malformed' },
                { authorization: `Bearer ${jwt({ exp: 1 })}` },
                { 'x-api-key': generateApiKeyMaterial().key },
                { authorization: `Bearer ${jwt({ auth_type: 'mcp_oauth' })}` }
            ];
            for (const headers of credentials) {
                const response = await fetch(`${url}/protected`, { headers });
                expect(response.status).toBe(401);
                expect(response.headers.get('www-authenticate')).toBe('Bearer');
                await response.arrayBuffer();
            }
        });
    });

    it('treats an empty explicit key as absent and skips authentication for public routes', async () => {
        await withServer(async (url, data) => {
            const response = await fetch(`${url}/protected`, {
                headers: {
                    'x-api-key': '   ',
                    authorization: `Bearer ${jwt()}`
                }
            });
            expect(response.status).toBe(200);
            await response.arrayBuffer();
            const publicResponse = await fetch(`${url}/public`, {
                headers: { 'x-api-key': 'bad-key' }
            });
            expect(publicResponse.status).toBe(200);
            expect(await publicResponse.json()).toBe('public');
            expect(data.db.apiKeys.where).not.toHaveBeenCalled();
        });
    });

    it.each([
        { email: 'owner@example.com', status: 200 },
        { email: 'other@example.com', status: 401 }
    ])('preserves single-user restrictions for $email', async ({
        email,
        status
    }) => {
        await withServer(
            async (url, data) => {
                const credentials: Record<string, string>[] = [
                    { authorization: `Bearer ${jwt()}` },
                    { 'x-api-key': data.material.key },
                    { authorization: `Bearer ${data.material.key}` }
                ];
                for (const headers of credentials) {
                    const response = await fetch(`${url}/protected`, {
                        headers
                    });
                    expect(response.status).toBe(status);
                    await response.arrayBuffer();
                }
            },
            { singleUser: true, email }
        );
    });

    it('uses literal routes ahead of earlier dynamic registrations after the package upgrade', async () => {
        await withServer(async url => {
            const literal = await fetch(`${url}/items/export`);
            expect(literal.status).toBe(200);
            expect(await literal.json()).toBe('export');
            const dynamic = await fetch(`${url}/items/7`);
            expect(dynamic.status).toBe(200);
            expect(await dynamic.json()).toBe('dynamic');
        });
    });
});
