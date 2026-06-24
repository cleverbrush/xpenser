import { expect, test } from '@playwright/test';

test.use({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 390, height: 844 }
});

test('shows Google sign-in on the public login screen', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Sign in with Google' })
    ).toBeVisible();
});

test('serves the public API contract through Swagger UI', async ({
    page,
    request
}) => {
    const openApiResponse = await request.get('/api/openapi.json');
    expect(openApiResponse.ok()).toBe(true);
    const openApi = await openApiResponse.json();
    expect(openApi.paths['/api/transactions']).toBeDefined();
    expect(JSON.stringify(openApi)).not.toContain('/external-api');

    const legacyResponse = await request.get('/external-api/openapi.json');
    expect(legacyResponse.status()).toBe(404);

    await page.goto('/api-docs/swagger');
    await expect(
        page.getByRole('heading', { name: 'xpenser Swagger reference' })
    ).toBeVisible();
    const transactionsOperation = page
        .locator('.opblock-summary')
        .filter({ hasText: '/api/transactions' })
        .first();
    await expect(transactionsOperation).toBeVisible({ timeout: 15_000 });
    await transactionsOperation.click();
    await expect(page.getByText('Responses').first()).toBeVisible();
});
