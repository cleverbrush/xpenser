import { describe, expect, it } from 'vitest';
import {
    apiTokenExpiresAt,
    applyTokenResponse,
    shouldRefreshApiToken
} from './api-session-token';

describe('API session token helpers', () => {
    it('normalizes token expiry values', () => {
        expect(apiTokenExpiresAt(new Date('2026-06-01T00:00:00.000Z'))).toBe(
            '2026-06-01T00:00:00.000Z'
        );
        expect(apiTokenExpiresAt('invalid')).toBe('');
    });

    it('refreshes missing, invalid, expired, and nearly expired API token expiries', () => {
        const now = Date.parse('2026-06-01T00:00:00.000Z');

        expect(
            shouldRefreshApiToken(
                {
                    apiToken: 'token',
                    apiTokenExpiresAt: '2026-06-01T00:04:59.000Z'
                },
                now
            )
        ).toBe(true);
        expect(
            shouldRefreshApiToken(
                {
                    apiToken: 'token',
                    apiTokenExpiresAt: 'bad-date'
                },
                now
            )
        ).toBe(true);
        expect(
            shouldRefreshApiToken(
                {
                    apiToken: 'token',
                    apiTokenExpiresAt: '2026-06-01T00:06:00.000Z'
                },
                now
            )
        ).toBe(false);
        expect(shouldRefreshApiToken({ apiToken: 'token' }, now)).toBe(true);
        expect(shouldRefreshApiToken({}, now)).toBe(false);
    });

    it('applies refreshed token responses to Auth.js JWT payloads', () => {
        const token = applyTokenResponse(
            {},
            {
                token: 'fresh-api-token',
                expiresAt: new Date('2026-06-01T00:02:00.000Z'),
                user: {
                    id: 12,
                    email: 'jane@example.com',
                    role: 'user',
                    defaultCurrency: 'USD',
                    countryCode: 'US',
                    timezone: 'UTC',
                    hasCategories: true
                }
            }
        );

        expect(token).toMatchObject({
            apiToken: 'fresh-api-token',
            apiTokenExpiresAt: '2026-06-01T00:02:00.000Z',
            sub: '12',
            email: 'jane@example.com',
            role: 'user',
            defaultCurrency: 'USD',
            countryCode: 'US',
            timezone: 'UTC',
            hasCategories: true
        });
    });
});
