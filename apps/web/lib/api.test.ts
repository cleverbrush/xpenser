import type { TokenResponse } from '@xpenser/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

const clientMocks = vi.hoisted(() => ({
    createXpenserClient: vi.fn()
}));

const nextCacheMocks = vi.hoisted(() => ({
    revalidateTag: vi.fn()
}));

vi.mock('react', () => ({
    cache: <Args extends readonly unknown[], Result>(
        fn: (...args: Args) => Result
    ) => {
        let result: Result | undefined;
        let called = false;
        return (...args: Args) => {
            if (!called) {
                result = fn(...args);
                called = true;
            }
            return result as Result;
        };
    }
}));

vi.mock('@xpenser/client', () => ({
    createXpenserClient: clientMocks.createXpenserClient
}));

vi.mock('next/cache', () => ({
    revalidateTag: nextCacheMocks.revalidateTag
}));

vi.mock('next/navigation', () => ({
    redirect: vi.fn((path: string) => {
        throw new Error(`redirect:${path}`);
    })
}));

function tokenResponse(): TokenResponse {
    return {
        token: 'api-token',
        expiresAt: new Date('2026-07-06T10:00:00.000Z'),
        user: {
            id: 7,
            email: 'owner@example.com',
            role: 'user',
            defaultCurrency: 'USD',
            countryCode: 'US',
            timezone: 'UTC',
            hasCategories: true,
            mainBudgetId: 1
        }
    };
}

function stubSingleUserEnv() {
    vi.stubEnv('XPENSER_SINGLE_USER_MODE', '1');
    vi.stubEnv('XPENSER_SINGLE_USER_EMAIL', 'owner@example.com');
    vi.stubEnv('WEB_API_SERVICE_SECRET', 'x'.repeat(32));
    vi.stubEnv('API_BASE_URL', 'http://api:4000');
}

describe('web API client factory', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('bridges authenticated API mutations to Next cache tags', async () => {
        stubSingleUserEnv();
        const trustedClient = {
            auth: {
                singleUserSessionToken: vi
                    .fn()
                    .mockResolvedValue(tokenResponse())
            }
        };
        const authenticatedClient = { name: 'authenticated-client' };
        clientMocks.createXpenserClient
            .mockReturnValueOnce(trustedClient)
            .mockReturnValueOnce(authenticatedClient);

        const { getApiClient } = await import('./api');
        await expect(
            getApiClient({ retryOnTimeout: false, timeoutMs: 30_000 })
        ).resolves.toBe(authenticatedClient);

        const authenticatedCall = clientMocks.createXpenserClient.mock.calls[1];
        expect(authenticatedCall).toBeDefined();

        const authenticatedOptions = authenticatedCall?.[0] as NonNullable<
            typeof authenticatedCall
        >[0];
        expect(authenticatedOptions).toMatchObject({
            baseUrl: 'http://api:4000',
            retryOnTimeout: false,
            timeoutMs: 30_000
        });
        expect(authenticatedOptions.getToken()).toBe('api-token');

        authenticatedOptions.invalidateCacheTag('transactions');

        expect(nextCacheMocks.revalidateTag).toHaveBeenCalledWith(
            'transactions',
            'max'
        );
    });

    it('keeps anonymous clients independent from Next cache invalidation', async () => {
        vi.stubEnv('API_BASE_URL', 'http://api:4000');
        const anonymousClient = { name: 'anonymous-client' };
        clientMocks.createXpenserClient.mockReturnValueOnce(anonymousClient);

        const { getAnonymousApiClient } = await import('./api');

        expect(getAnonymousApiClient()).toBe(anonymousClient);
        expect(clientMocks.createXpenserClient).toHaveBeenCalledWith({
            baseUrl: 'http://api:4000'
        });
    });

    it('deduplicates the session, default client, and current user in a server render', async () => {
        stubSingleUserEnv();
        const trustedClient = {
            auth: {
                singleUserSessionToken: vi
                    .fn()
                    .mockResolvedValue(tokenResponse())
            }
        };
        const me = { id: 7, email: 'owner@example.com' };
        const authenticatedClient = {
            auth: { me: vi.fn().mockResolvedValue(me) }
        };
        clientMocks.createXpenserClient
            .mockReturnValueOnce(trustedClient)
            .mockReturnValueOnce(authenticatedClient);

        const { getApiClient, getCurrentSession, getCurrentUser } =
            await import('./api');
        const [firstSession, secondSession, firstClient, secondClient] =
            await Promise.all([
                getCurrentSession(),
                getCurrentSession(),
                getApiClient(),
                getApiClient()
            ]);
        const [firstUser, secondUser] = await Promise.all([
            getCurrentUser(),
            getCurrentUser()
        ]);

        expect(firstSession).toBe(secondSession);
        expect(firstClient).toBe(secondClient);
        expect(firstUser).toBe(me);
        expect(secondUser).toBe(me);
        expect(
            trustedClient.auth.singleUserSessionToken
        ).toHaveBeenCalledOnce();
        expect(authenticatedClient.auth.me).toHaveBeenCalledOnce();
        expect(clientMocks.createXpenserClient).toHaveBeenCalledTimes(2);
    });
});
