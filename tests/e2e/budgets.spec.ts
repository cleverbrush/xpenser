import { expect, test } from '@playwright/test';
import { uniqueName } from './helpers';

test('creates, renames, archives, and restores a budget with correct list filtering', async ({ page }) => {
    const originalName = uniqueName('E2E budget_%');
    const renamed = `${originalName} renamed`;
    await page.goto('/settings/budgets');
    await page.getByLabel('Name', { exact: true }).fill(originalName);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForURL(/\/settings\/budgets\/\d+$/);
    const detailUrl = page.url();

    await page.getByLabel('My budget name').fill(renamed);
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await expect(page.getByRole('heading', { name: renamed, exact: true, level: 1 })).toBeVisible();
    await page.goto('/settings/budgets');
    await expect(page.getByRole('heading', { name: renamed, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: originalName, exact: true })).toHaveCount(0);

    await page.goto(detailUrl);
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Restore', exact: true })).toBeVisible();
    await page.goto('/settings/budgets');
    const archived = page.getByRole('heading', { name: 'Archived budgets', exact: true }).locator('..');
    await expect(archived.getByRole('heading', { name: renamed, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: renamed, exact: true })).toHaveCount(1);

    await page.goto(detailUrl);
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeVisible();
    await page.goto('/settings/budgets');
    const row = page.locator('article').filter({ has: page.getByRole('heading', { name: renamed, exact: true }) });
    await expect(row).toHaveCount(1);
    await expect(row.getByText('Archived', { exact: true })).toHaveCount(0);

    // Remove only the budget created by this test after verifying the full lifecycle.
    await page.goto(detailUrl);
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
    const deleted = page.waitForResponse(response => response.request().method() === 'POST' && response.url() === detailUrl);
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await (await deleted).finished();
    await page.goto('/settings/budgets');
    await expect(page.getByRole('heading', { name: renamed, exact: true })).toHaveCount(0);
});
