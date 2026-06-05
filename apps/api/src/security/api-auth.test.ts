import { signJwt } from '@cleverbrush/auth';
import { describe, expect, it, vi } from 'vitest';
import {
    generateApiKeyMaterial,
    hashApiKeySecret
} from '../application/api-keys.js';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import { xpenserAuthScheme } from './api-auth.js';

const config = {
    jwt: {
        secret: 'x'.repeat(32)
    }
} as Config;

function authContext(headers: Record<string, string>) {
    return {
        headers,
        cookies: {},
        items: new Map()
    };
}

describe('xpenser auth scheme', () => {
    it('authenticates regular app JWT bearer tokens', async () => {
        const token = signJwt(
            {
                sub: '42',
                role: 'user',
                exp: Math.floor(Date.now() / 1000) + 60
            },
            config.jwt.secret
        );
        const scheme = xpenserAuthScheme(config, {} as AppDb);

        const result = await scheme.authenticate(
            authContext({ authorization: `Bearer ${token}` })
        );

        expect(result.succeeded).toBe(true);
        if (!result.succeeded) {
            throw new Error(result.failure);
        }
        expect(result.principal.value).toEqual({
            userId: 42,
            role: 'user',
            authType: 'jwt'
        });
    });

    it('authenticates durable API keys from the X-API-Key header', async () => {
        const material = generateApiKeyMaterial();
        const apiKeyRow = {
            id: 7,
            userId: 42,
            keyId: material.keyId,
            secretHash: hashApiKeySecret(material.secret)
        };
        const update = vi.fn(async () => undefined);
        const db = {
            apiKeys: {
                where: vi.fn(() => ({
                    first: vi.fn(async () => apiKeyRow),
                    update
                }))
            },
            users: {
                find: vi.fn(async () => ({ id: 42, role: 'user' }))
            }
        } as unknown as AppDb;
        const scheme = xpenserAuthScheme(config, db);

        const result = await scheme.authenticate(
            authContext({ 'x-api-key': material.key })
        );

        expect(result.succeeded).toBe(true);
        if (!result.succeeded) {
            throw new Error(result.failure);
        }
        expect(result.principal.value).toEqual({
            userId: 42,
            role: 'user',
            authType: 'api_key',
            apiKeyId: 7
        });
        expect(result.principal.claims.get('auth_type')).toBe('api_key');
        expect(update).toHaveBeenCalledWith({ lastUsedAt: expect.any(Date) });
    });

    it('accepts API keys sent as bearer tokens for external clients', async () => {
        const material = generateApiKeyMaterial();
        const db = {
            apiKeys: {
                where: vi.fn(() => ({
                    first: vi.fn(async () => ({
                        id: 7,
                        userId: 42,
                        keyId: material.keyId,
                        secretHash: hashApiKeySecret(material.secret)
                    })),
                    update: vi.fn(async () => undefined)
                }))
            },
            users: {
                find: vi.fn(async () => ({ id: 42, role: 'user' }))
            }
        } as unknown as AppDb;
        const scheme = xpenserAuthScheme(config, db);

        const result = await scheme.authenticate(
            authContext({ authorization: `Bearer ${material.key}` })
        );

        expect(result.succeeded).toBe(true);
    });
});
