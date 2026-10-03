import { expect, type APIRequestContext } from '@playwright/test';
import { testUser } from './helpers';

export const apiBase = '/api/api';

/** Callers must disable traces to keep short-lived credentials out of artifacts. */
export async function loginApi(request: APIRequestContext) {
    const response = await request.post(`${apiBase}/auth/login`, {
        data: testUser
    });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as { token: string };
    return { authorization: `Bearer ${body.token}` };
}
