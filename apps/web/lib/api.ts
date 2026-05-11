import { createXpenserClient } from '@xpenser/client';
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

export async function getApiClient() {
    const session = await getSessionOrRedirect();
    return createXpenserClient({
        baseUrl: webConfig.apiBaseUrl,
        getToken: () => session.apiToken,
        onUnauthorized: () => {
            redirect(expiredSessionPath);
        }
    });
}

export function getAnonymousApiClient() {
    return createXpenserClient({ baseUrl: webConfig.apiBaseUrl });
}
