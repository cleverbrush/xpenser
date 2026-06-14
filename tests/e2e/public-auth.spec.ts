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
