import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../../config.js';
import type { AppDb } from '../../db/schemas.js';
import { sessionTokenHandler } from './auth.js';

const secret = 'web-service-secret-minimum-32-chars';
const config = {
    jwt: {
        secret: 'x'.repeat(32),
        expiresInSeconds: 120
    },
    web: {
        apiServiceSecret: secret
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
