import {
    createXpenserClient,
    type XpenserClientOptions
} from '@xpenser/client';
import { redirect } from 'next/navigation';
import { auth } from '../auth';
import { expiredSessionPath } from './auth-routes';
import { webConfig } from './config';

export async function getSessionOrRedirect() {
    const session = await auth();
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
        retryOnTimeout: options.retryOnTimeout,
        timeoutMs: options.timeoutMs
    });
}

export function getAnonymousApiClient() {
    return createXpenserClient({ baseUrl: webConfig.apiBaseUrl });
}
