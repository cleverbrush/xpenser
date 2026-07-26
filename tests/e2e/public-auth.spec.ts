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

    const acidToolsBadge = page.getByRole('link', { name: 'Acid Tools' });
    await expect(acidToolsBadge).toHaveAttribute(
        'href',
        'https://acidtools.com/ai/xpenser-cleverbrush'
    );
    await expect(acidToolsBadge).toHaveAttribute('target', '_blank');
    await expect(acidToolsBadge).toHaveAttribute(
        'rel',
        'noopener noreferrer'
    );

    const acidToolsLightBadge = acidToolsBadge.locator(
        'img[src="https://acidtools.com/assets/images/badge.png"]'
    );
    const acidToolsDarkBadge = acidToolsBadge.locator(
        'img[src="https://acidtools.com/assets/images/badge-dark.png"]'
    );
    await acidToolsBadge.scrollIntoViewIfNeeded();
    await expect(acidToolsLightBadge).toBeVisible();
    await expect(acidToolsLightBadge).toHaveAttribute('height', '54');
    await expect(acidToolsLightBadge).toHaveAttribute('loading', 'lazy');
    await expect(acidToolsDarkBadge).toBeHidden();
    await expect(acidToolsDarkBadge).toHaveAttribute('height', '54');
    await expect(acidToolsDarkBadge).toHaveAttribute('loading', 'lazy');

    const smolLaunchBadge = page.getByRole('link', {
        name: 'xpenser — Featured on Smol Launch'
    });
    await expect(smolLaunchBadge).toHaveAttribute(
        'href',
        'https://smollaunch.com'
    );
    await expect(smolLaunchBadge).toHaveAttribute('target', '_blank');
    await expect(smolLaunchBadge).toHaveAttribute('rel', 'noopener');

    const smolLaunchLightBadge = smolLaunchBadge.locator(
        'img[src="https://smollaunch.com/badges/featured.svg"]'
    );
    const smolLaunchDarkBadge = smolLaunchBadge.locator(
        'img[src="https://smollaunch.com/badges/featured-dark.svg"]'
    );
    await smolLaunchBadge.scrollIntoViewIfNeeded();
    await expect(smolLaunchLightBadge).toBeVisible();
    await expect(smolLaunchLightBadge).toHaveAttribute('width', '250');
    await expect(smolLaunchLightBadge).toHaveAttribute('height', '60');
    await expect(smolLaunchLightBadge).toHaveAttribute('loading', 'lazy');
    await expect(smolLaunchDarkBadge).toBeHidden();
    await expect(smolLaunchDarkBadge).toHaveAttribute('width', '250');
    await expect(smolLaunchDarkBadge).toHaveAttribute('height', '60');
    await expect(smolLaunchDarkBadge).toHaveAttribute('loading', 'lazy');

    const launchLlamaBadge = page.getByRole('link', {
        name: 'As seen on Launch Llama Newsletter'
    });
    await expect(launchLlamaBadge).toHaveAttribute(
        'href',
        'https://tools.launchllama.co?utm_source=badge&utm_medium=referral'
    );
    await expect(launchLlamaBadge).toHaveAttribute('target', '_blank');
    await expect(launchLlamaBadge).toHaveAttribute(
        'rel',
        'noopener noreferrer'
    );

    const launchLlamaLightBadge = launchLlamaBadge.locator(
        'img[src="https://tools.launchllama.co/featured-badge.png?v=2"]'
    );
    const launchLlamaDarkBadge = launchLlamaBadge.locator(
        'img[src="https://tools.launchllama.co/featured-badge-white.png?v=2"]'
    );
    await launchLlamaBadge.scrollIntoViewIfNeeded();
    await expect(launchLlamaLightBadge).toBeVisible();
    await expect(launchLlamaLightBadge).toHaveAttribute('width', '200');
    await expect(launchLlamaLightBadge).toHaveAttribute('height', '50');
    await expect(launchLlamaLightBadge).toHaveAttribute('loading', 'lazy');
    await expect(launchLlamaDarkBadge).toBeHidden();
    await expect(launchLlamaDarkBadge).toHaveAttribute('width', '200');
    await expect(launchLlamaDarkBadge).toHaveAttribute('height', '50');
    await expect(launchLlamaDarkBadge).toHaveAttribute('loading', 'lazy');

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(lightBadge).toBeHidden();
    await expect(darkBadge).toBeVisible();
    await expect(acidToolsLightBadge).toBeHidden();
    await expect(acidToolsDarkBadge).toBeVisible();
    await expect(smolLaunchLightBadge).toBeHidden();
    await expect(smolLaunchDarkBadge).toBeVisible();
    await expect(launchLlamaLightBadge).toBeHidden();
    await expect(launchLlamaDarkBadge).toBeVisible();

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
