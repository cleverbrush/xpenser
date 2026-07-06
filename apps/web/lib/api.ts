import {
    createXpenserClient,
    type XpenserClientOptions
} from '@xpenser/client';
import type { TokenResponse } from '@xpenser/contracts';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
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

export async function getCurrentSession(): Promise<CurrentWebSession | null> {
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

export async function getSessionOrRedirect() {
    const session = await getCurrentSession();
    if (!session?.apiToken) {
        redirect('/login');
    }
    return session;
}

type ApiClientOptions = Pick<
    XpenserClientOptions,
    'retryOnTimeout' | 'timeoutMs'
>;

export async function getApiClient(options: ApiClientOptions = {}) {
    const session = await getSessionOrRedirect();
    return createXpenserClient({
        baseUrl: webConfig.apiBaseUrl,
        getToken: () => session.apiToken,
        onUnauthorized: () => {
            redirect(expiredSessionPath);
        },
        invalidateCacheTag: tag => revalidateTag(tag, 'max'),
        retryOnTimeout: options.retryOnTimeout,
        timeoutMs: options.timeoutMs
    });
}

export function getAnonymousApiClient() {
    return createXpenserClient({ baseUrl: webConfig.apiBaseUrl });
}
