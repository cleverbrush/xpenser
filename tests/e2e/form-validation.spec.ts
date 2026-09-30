import { expect, test } from '@playwright/test';
import { uniqueName } from './helpers';

// API-key success reveals a credential; never persist a trace of this test.
test.use({ trace: 'off' });

test('real API validation survives a Server Action and supports correction and retry', async ({ page }) => {
    await page.goto('/settings/preferences');
    const input = page.locator('#api-key-name');
    const original = uniqueName('Form validation');
    const corrected = uniqueName('Corrected validation');
    let intercepted = false;
    // Keep the browser value valid, but submit invalid input through the real
    // Server Action/API boundary. No response mocks or production test hooks.
    await page.route('**/settings/preferences', async route => {
        const request = route.request();
        const body = request.postData();
        if (!intercepted && request.method() === 'POST' && request.headers()['next-action'] && body?.includes(original)) {
            intercepted = true;
            await route.continue({ postData: body.replaceAll(original, 'x'.repeat(300)) });
        } else await route.continue();
    });
    await input.fill(original);
    await page.getByRole('button', { name: 'Create key', exact: true }).click();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(intercepted).toBe(true);
    await expect(input).toHaveValue(original);
    await expect(page.locator('#api-key-name-error')).toBeVisible();
    await expect(page.getByText('New API key', { exact: true })).toHaveCount(0);
    await input.fill(corrected);
    await expect(page.locator('#api-key-name-error')).toHaveCount(0);
    await page.getByRole('button', { name: 'Create key', exact: true }).click();
    await expect(page.getByText('New API key', { exact: true })).toBeVisible();
    await expect(input).toHaveValue('');
    const row = page.getByText(corrected, { exact: true }).locator('..').locator('..').locator('..');
    await row.getByRole('button', { name: 'Revoke', exact: true }).click();
    await expect(page.getByText(corrected, { exact: true })).toHaveCount(0);
});
