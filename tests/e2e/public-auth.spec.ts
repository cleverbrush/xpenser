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
    await page.emulateMedia({ colorScheme: 'light' });
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

    const neeedDirectoryBadge = page.getByRole('link', {
        name: 'Featured on neeed.directory'
    });
    await expect(neeedDirectoryBadge).toHaveAttribute(
        'href',
        'https://neeed.directory/products/xpenser?utm_source=xpenser'
    );
    await expect(neeedDirectoryBadge).toHaveAttribute('target', '_blank');
    await expect(neeedDirectoryBadge).toHaveAttribute(
        'rel',
        'noopener noreferrer'
    );

    const lightBadge = neeedDirectoryBadge.locator(
        'img[src="https://neeed.directory/badges/neeed-badge-light.svg"]'
    );
    const darkBadge = neeedDirectoryBadge.locator(
        'img[src="https://neeed.directory/badges/neeed-badge-dark.svg"]'
    );
    await expect(lightBadge).toBeVisible();
    await expect(darkBadge).toBeHidden();

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(lightBadge).toBeHidden();
    await expect(darkBadge).toBeVisible();

    const foundrListBadge = page.getByRole('link', {
        name: 'Featured on FoundrList'
    });
    await expect(foundrListBadge).toHaveAttribute(
        'href',
        'https://www.foundrlist.com/product/xpenser?utm_source=badge&utm_medium=embed'
    );
    await expect(foundrListBadge).toHaveAttribute('target', '_blank');
    await expect(foundrListBadge).toHaveAttribute('rel', 'noopener');

    const foundrListBadgeImage = foundrListBadge.locator(
        'img[src="https://www.foundrlist.com/api/badge/xpenser"]'
    );
    await expect(foundrListBadgeImage).toBeVisible();
    await expect(foundrListBadgeImage).toHaveAttribute('width', '150');
    await expect(foundrListBadgeImage).toHaveAttribute('height', '48');
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

    await page.goto('/blog/dashboard-vendor-view-controls');
    await expect(
        page.getByRole('heading', {
            name: 'Dashboard and vendor view controls'
        })
    ).toBeVisible();
    await expect(
        page.getByRole('img', {
            name: 'xpenser dashboard showing monthly income, expense, and category summaries'
        })
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'PR #58' })).toHaveAttribute(
        'href',
        'https://github.com/cleverbrush/xpenser/pull/58'
    );

    await page.goto('/blog/disable-gtm-in-pr-environments');
    await expect(
        page.getByRole('heading', {
            name: 'Google Tag Manager disabled in PR environments'
        })
    ).toBeVisible();
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        /\/og-image\.png$/
    );
    await expect(page.getByRole('link', { name: 'PR #57' })).toHaveAttribute(
        'href',
        'https://github.com/cleverbrush/xpenser/pull/57'
    );
});

test('publishes the TypeScript 7 migration benchmark', async ({ page }) => {
    await page.goto('/blog/typescript-7-migration');

    await expect(
        page.getByRole('heading', {
            name: 'TypeScript 7 migration: xpenser build-time results'
        })
    ).toBeVisible();
    await expect(
        page.getByText('TypeScript 7 migration', { exact: true })
    ).toBeVisible();
    await expect(page.getByRole('table').first()).toContainText(
        '69.5% faster'
    );
    await expect(page.getByRole('table').first()).toContainText(
        '34.4% faster'
    );
    await expect(
        page.getByRole('link', { name: 'open-source expense tracker' })
    ).toHaveAttribute('href', '/open-source-expense-tracker');
    await expect(
        page.getByRole('link', { name: 'PR #75', exact: true })
    ).toHaveAttribute('href', 'https://github.com/cleverbrush/xpenser/pull/75');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        /\/og-image\.png$/
    );
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
