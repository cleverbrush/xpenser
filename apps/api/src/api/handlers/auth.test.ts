import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../../config.js';
import type { AppDb } from '../../db/schemas.js';
import { hashPassword } from '../../security/password.js';
import { loginHandler, sessionTokenHandler } from './auth.js';

const secret = 'web-service-secret-minimum-32-chars';
const config = {
    jwt: {
        secret: 'x'.repeat(32),
        expiresInSeconds: 120
    },
    web: {
        apiServiceSecret: secret
    },
    emailConfirmation: {
        tokenTtlSeconds: 86_400
    }
} as Config;

function mockDb(user: object | undefined): AppDb {
    return {
        users: {
            find: vi.fn(async () => user)
        },
        categories: {
            where: vi.fn(() => ({
                limit: vi.fn(async () => [])
            }))
        }
    } as unknown as AppDb;
}

describe('session token handler', () => {
    it('rejects missing web service credentials', async () => {
        const result = await sessionTokenHandler(
            {
                body: { userId: 12 },
                context: { headers: {} }
            } as never,
            { db: mockDb(undefined), config } as never
        );

        expect(result).toMatchObject({
            status: 401,
            body: { message: 'Invalid web service credentials.' }
        });
    });

    it('rejects unknown users', async () => {
        const result = await sessionTokenHandler(
            {
                body: { userId: 12 },
                context: {
                    headers: { 'x-xpenser-web-secret': secret }
                }
            } as never,
            { db: mockDb(undefined), config } as never
        );

        expect(result).toMatchObject({
            status: 401,
            body: { message: 'User was not found.' }
        });
    });

    it('issues a token for a trusted web session', async () => {
        const result = await sessionTokenHandler(
            {
                body: { userId: 12 },
                context: {
                    headers: { 'x-xpenser-web-secret': secret }
                }
            } as never,
            {
                db: mockDb({
                    id: 12,
                    email: 'jane@example.com',
                    role: 'user',
                    defaultCurrency: 'USD',
                    countryCode: 'US',
                    timezone: 'UTC'
                }),
                config
            } as never
        );

        expect(result).toMatchObject({
            token: expect.any(String),
            expiresAt: expect.any(Date),
            user: {
                id: 12,
                email: 'jane@example.com',
                role: 'user'
            }
        });
    });
});

describe('login handler', () => {
    it('rejects valid credentials until local email is confirmed', async () => {
        const passwordHash = await hashPassword('correct horse battery staple');
        const result = await loginHandler(
            {
                body: {
                    email: 'jane@example.com',
                    password: 'correct horse battery staple'
                }
            } as never,
            {
                db: {
                    users: {
                        projected: vi.fn(() => ({
                            where: vi.fn(() => ({
                                first: vi.fn(async () => ({
                                    id: 12,
                                    email: 'jane@example.com',
                                    passwordHash,
                                    emailVerified: false,
                                    authProvider: 'local',
                                    role: 'user',
                                    defaultCurrency: 'USD',
                                    countryCode: 'US',
                                    timezone: 'UTC'
                                }))
                            }))
                        }))
                    }
                } as unknown as AppDb,
                config
            } as never
        );

        expect(result).toMatchObject({
            status: 403,
            body: {
                message:
                    'Email is not verified. Check your inbox for the confirmation link.'
            }
        });
    });
});
