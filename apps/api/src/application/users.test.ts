import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import {
    InvalidPassportIdentityError,
    issueUserToken,
    PasswordMismatchError,
    transactionCurrenciesByRecentPopularity,
    verifyWebApiServiceSecret
} from './users.js';

const config = {
    jwt: {
        secret: 'x'.repeat(32),
        expiresInSeconds: 120
    },
    web: {
        apiServiceSecret: 'web-service-secret-minimum-32-chars'
    }
} as Config;

function mockDbWithUser(): AppDb {
    return {
        users: {
            find: vi.fn(async () => ({
                id: 12,
                email: 'jane@example.com',
                role: 'user',
                defaultCurrency: 'USD',
                timezone: 'UTC'
            }))
        },
        categories: {
            where: vi.fn(() => ({
                limit: vi.fn(async () => [])
            }))
        }
    } as unknown as AppDb;
}

afterEach(() => {
    vi.useRealTimers();
});

describe('user domain errors', () => {
    it('uses a specific error for password mismatch', () => {
        expect(new PasswordMismatchError('x')).toBeInstanceOf(Error);
    });

    it('uses a specific error for invalid Passport identities', () => {
        expect(new InvalidPassportIdentityError('x')).toBeInstanceOf(Error);
    });
});

describe('user token issuance', () => {
    it('returns an explicit API token expiry', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));

        const response = await issueUserToken(mockDbWithUser(), config, 12);

        expect(response?.expiresAt).toEqual(
            new Date('2026-06-01T00:02:00.000Z')
        );
        expect(response?.token).toEqual(expect.any(String));
    });

    it('compares web service secrets without accepting partial values', () => {
        expect(
            verifyWebApiServiceSecret(
                config,
                'web-service-secret-minimum-32-chars'
            )
        ).toBe(true);
        expect(verifyWebApiServiceSecret(config, undefined)).toBe(false);
        expect(verifyWebApiServiceSecret(config, 'web-service-secret')).toBe(
            false
        );
        expect(
            verifyWebApiServiceSecret(
                config,
                'web-service-secret-minimum-32-charx'
            )
        ).toBe(false);
    });
});

describe('transaction currency ordering', () => {
    it('sorts configured currencies by recent transaction popularity', () => {
        expect(
            transactionCurrenciesByRecentPopularity(
                ['USD', 'EUR', 'GBP'],
                [{ currency: 'EUR' }, { currency: 'GBP' }, { currency: 'EUR' }]
            )
        ).toEqual(['EUR', 'GBP', 'USD']);
    });

    it('breaks popularity ties by the currency used latest', () => {
        expect(
            transactionCurrenciesByRecentPopularity(
                ['USD', 'EUR', 'GBP'],
                [
                    { currency: 'GBP' },
                    { currency: 'EUR' },
                    { currency: 'EUR' },
                    { currency: 'GBP' }
                ]
            )
        ).toEqual(['GBP', 'EUR', 'USD']);
    });

    it('includes recent currencies outside primary and favorites', () => {
        expect(
            transactionCurrenciesByRecentPopularity(
                ['USD', 'EUR'],
                [{ currency: 'UAH' }, { currency: 'USD' }, { currency: 'UAH' }]
            )
        ).toEqual(['UAH', 'USD', 'EUR']);
    });

    it('falls back to original configured order without recent transactions', () => {
        expect(
            transactionCurrenciesByRecentPopularity(['USD', 'EUR'], [])
        ).toEqual(['USD', 'EUR']);
    });
});
