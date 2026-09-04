import {
    createXpenserClient,
    type XpenserClientOptions
} from '@xpenser/client';
import type { TokenResponse } from '@xpenser/contracts';
import { revalidateTag, unstable_cache } from 'next/cache';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { expiredSessionPath } from './auth-routes';
import { getWebApiServiceSecret, webConfig } from './config';

export type CurrentWebSession = {
    readonly apiToken: string;
    readonly user: {
        readonly id: string;
        readonly email: string;
        readonly role: string;
        readonly defaultCurrency: string;
        readonly countryCode: string;
        readonly timezone: string;
        readonly hasCategories: boolean;
    };
};

function trustedApiClient() {
    return createXpenserClient({
        baseUrl: webConfig.apiBaseUrl,
        headers: {
            'X-Xpenser-Web-Secret': getWebApiServiceSecret()
        }
    });
}

function sessionFromTokenResponse(response: TokenResponse): CurrentWebSession {
    return {
        apiToken: response.token,
        user: {
            id: String(response.user.id),
            email: response.user.email,
            role: response.user.role,
            defaultCurrency: response.user.defaultCurrency,
            countryCode: response.user.countryCode,
            timezone: response.user.timezone,
            hasCategories: response.user.hasCategories
        }
    };
}

async function loadCurrentSession(): Promise<CurrentWebSession | null> {
    if (webConfig.singleUser?.enabled) {
        return sessionFromTokenResponse(
            await trustedApiClient().auth.singleUserSessionToken()
        );
    }

    const { auth } = await import('../auth');
    const session = await auth();
    if (!session?.apiToken) {
        return null;
    }
    return {
        apiToken: session.apiToken,
        user: {
            id: session.user.id,
            email: session.user.email,
            role: session.user.role,
            defaultCurrency: session.user.defaultCurrency,
            countryCode: session.user.countryCode,
            timezone: session.user.timezone,
            hasCategories: session.user.hasCategories
        }
    };
}

export const getCurrentSession = cache(loadCurrentSession);

export async function getSessionOrRedirect() {
    const session = await getCurrentSession();
    if (!session?.apiToken) {
        redirect('/login');
    }
    return session;
}

type ApiClientOptions = Pick<
    XpenserClientOptions,
    'disableBatching' | 'retryOnTimeout' | 'timeoutMs'
>;

async function createAuthenticatedApiClient(options: ApiClientOptions = {}) {
    const session = await getSessionOrRedirect();
    return createXpenserClient({
        baseUrl: webConfig.apiBaseUrl,
        getToken: () => session.apiToken,
        onUnauthorized: () => {
            redirect(expiredSessionPath);
        },
        invalidateCacheTag: tag => revalidateTag(tag, 'max'),
        disableBatching: options.disableBatching,
        retryOnTimeout: options.retryOnTimeout,
        timeoutMs: options.timeoutMs
    });
}

const getDefaultApiClient = cache(createAuthenticatedApiClient);

export function getApiClient(options?: ApiClientOptions) {
    return options
        ? createAuthenticatedApiClient(options)
        : getDefaultApiClient();
}

const loadCachedCurrentUser = unstable_cache(
    async (apiBaseUrl: string, apiToken: string) => {
        const client = createXpenserClient({
            baseUrl: apiBaseUrl,
            disableBatching: true,
            getToken: () => apiToken,
            onUnauthorized: () => {
                redirect(expiredSessionPath);
            }
        });
        return client.auth.me();
    },
    ['current-user'],
    { revalidate: 30, tags: ['user-profile'] }
);

export const getCurrentUser = cache(async () => {
    const session = await getSessionOrRedirect();
    return loadCachedCurrentUser(webConfig.apiBaseUrl, session.apiToken);
});

export function getAnonymousApiClient() {
    return createXpenserClient({ baseUrl: webConfig.apiBaseUrl });
}
