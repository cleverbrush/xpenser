import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../../config.js';
import type { AppDb } from '../../db/schemas.js';
import { hashPassword } from '../../security/password.js';
import {
    googleSignInHandler,
    loginHandler,
    sessionTokenHandler,
    singleUserSessionTokenHandler
} from './auth.js';

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
const singleUserConfig = {
    ...config,
    singleUser: {
        enabled: true,
        email: 'owner@example.com'
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

function singleUserDb(existing?: object): AppDb {
    let stored = existing as
        | (Record<string, unknown> & {
              readonly id: number;
              readonly email?: string;
          })
        | undefined;
    const users = {
        projected: vi.fn(() => ({
            where: vi.fn(() => ({
                first: vi.fn(async () => stored)
            }))
        })),
        insert: vi.fn(async (body: Record<string, unknown>) => {
            stored = {
                ...body,
                id: 12,
                weeklyEmailReportEnabled: true,
                monthlyEmailReportEnabled: true
            };
            return stored;
        }),
        find: vi.fn(async (id: number) => (stored?.id === id ? stored : null))
    };

    return {
        transaction: vi.fn(
            async (
                callback: (trx: { readonly users: typeof users }) => unknown
            ) => callback({ users })
        ),
        users,
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

describe('single-user session token handler', () => {
    it('rejects missing web service credentials', async () => {
        const result = await singleUserSessionTokenHandler(
            {
                context: { headers: {} }
            } as never,
            { db: singleUserDb(), config: singleUserConfig } as never
        );

        expect(result).toMatchObject({
            status: 401,
            body: { message: 'Invalid web service credentials.' }
        });
    });

    it('creates the configured owner and issues a token', async () => {
        const result = await singleUserSessionTokenHandler(
            {
                context: {
                    headers: { 'x-xpenser-web-secret': secret }
                }
            } as never,
            { db: singleUserDb(), config: singleUserConfig } as never
        );

        expect(result).toMatchObject({
            token: expect.any(String),
            expiresAt: expect.any(Date),
            user: {
                id: 12,
                email: 'owner@example.com',
                role: 'user'
            }
        });
    });
});

describe('direct Google sign-in handler', () => {
    const body = {
        providerSubject: 'google-subject',
        email: 'jane@example.com',
        emailVerified: true
    };

    it('rejects missing web service credentials', async () => {
        const result = await googleSignInHandler(
            {
                body,
                context: { headers: {} }
            } as never,
            { db: mockDb(undefined), config } as never
        );

        expect(result).toMatchObject({
            status: 401,
            body: { message: 'Invalid web service credentials.' }
        });
    });

    it('rejects invalid web service credentials', async () => {
        const result = await googleSignInHandler(
            {
                body,
                context: {
                    headers: { 'x-xpenser-web-secret': `${secret}-wrong` }
                }
            } as never,
            { db: mockDb(undefined), config } as never
        );

        expect(result).toMatchObject({
            status: 401,
            body: { message: 'Invalid web service credentials.' }
        });
    });
});

describe('login handler', () => {
    it('disables account login in single-user mode', async () => {
        const result = await loginHandler(
            {
                body: {
                    email: 'jane@example.com',
                    password: 'correct horse battery staple'
                }
            } as never,
            { db: mockDb(undefined), config: singleUserConfig } as never
        );

        expect(result).toMatchObject({
            status: 401,
            body: {
                message:
                    'Account authentication is disabled in single-user mode.'
            }
        });
    });

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
