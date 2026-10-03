import { expect, test } from '@playwright/test';
import { apiBase, loginApi } from './api-helpers';

test.use({ trace: 'off', storageState: { cookies: [], origins: [] } });

test('missing vendors return the mapped not-found error', async ({
    request
}) => {
    const headers = await loginApi(request);
    const missing = await request.get(`${apiBase}/vendors/2147483647`, {
        headers
    });
    expect(missing.status()).toBe(404);
    expect(await missing.json()).toEqual({ message: 'Vendor was not found.' });
});
