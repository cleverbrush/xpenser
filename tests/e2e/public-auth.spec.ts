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

test('shows sign in and create account actions on the public index', async ({
    page
}) => {
    await page.goto('/');

    const main = page.locator('main');
    await expect(
        main.getByRole('link', { exact: true, name: 'Sign in' }).first()
    ).toHaveAttribute('href', '/login');
    await expect(
        main.getByRole('link', { name: 'Create account' }).first()
    ).toHaveAttribute('href', '/register');
    await expect(
        main.getByRole('link', { exact: true, name: 'xpenser blog' }).first()
    ).toHaveAttribute('href', '/blog');
});

test('serves the public blog index and a published post', async ({ page }) => {
    await page.goto('/blog');

    await expect(
        page.getByRole('heading', { name: 'xpenser blog' })
    ).toBeVisible();
    await expect(
        page.getByRole('link', {
            name: 'Markdown blog workflow for xpenser feature releases'
        })
    ).toHaveAttribute('href', '/blog/markdown-blog-workflow');

    await page.goto('/blog/markdown-blog-workflow');
    await expect(
        page.getByRole('heading', {
            name: 'Markdown blog workflow for xpenser feature releases'
        })
    ).toBeVisible();
    await expect(
        page.getByText('markdown blog workflow', { exact: true })
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'open-source expense tracker' })
    ).toHaveAttribute('href', '/open-source-expense-tracker');
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
