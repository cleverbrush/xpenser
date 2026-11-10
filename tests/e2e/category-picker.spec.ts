import { expect, test } from '@playwright/test';
import { apiBase, loginApi } from './api-helpers';
import { selectOption, uniqueName } from './helpers';

test.use({ trace: 'off' });

test('quick capture saves a category beyond the former chip limit', async ({ page, request, context, baseURL }, testInfo) => {
    const headers = await loginApi(request);
    await page.goto('/settings/budgets');
    await page.getByLabel('Name', { exact: true }).fill(uniqueName('Category dropdown'));
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.waitForURL(/\/settings\/budgets\/\d+$/);
    const budgetId = Number(new URL(page.url()).pathname.split('/').at(-1));
    try {
        const categories: { id: number; name: string }[] = [];
        for (let index = 1; index <= 8; index++) {
            const name = `Dropdown category ${index}`;
            const response = await request.post(`${apiBase}/categories`, { headers, data: { budgetId, name, type: 'expense' } });
            expect(response.status()).toBe(201);
            categories.push({ id: (await response.json()).id, name });
        }
        await context.addCookies([{ name: 'xpenser_selected_budget', value: String(budgetId), url: baseURL! }]);
        await page.goto('/capture');
        const picker = page.getByRole('combobox', { name: 'Transaction category' });
        await expect(picker).toBeVisible();
        await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
        await selectOption(page, picker, categories[7]!.name);
        await page.getByLabel('Amount', { exact: true }).fill('12.34');
        await page.screenshot({ path: testInfo.outputPath('category-dropdown-desktop.png'), fullPage: true });
        await testInfo.attach('Category dropdown desktop', { path: testInfo.outputPath('category-dropdown-desktop.png'), contentType: 'image/png' });
        await page.getByRole('button', { name: 'Save transaction', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
        const response = await request.get(`${apiBase}/transactions`, { headers, params: { budgetId } });
        expect(response.status()).toBe(200);
        expect((await response.json()).items).toEqual(expect.arrayContaining([expect.objectContaining({ categoryId: categories[7]!.id, amount: 12.34 })]));
        await page.setViewportSize({ width: 390, height: 844 });
        await picker.click();
        await page.getByRole('option', { name: categories[7]!.name, exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath('category-dropdown-mobile.png'), fullPage: true });
        await testInfo.attach('Category dropdown mobile', { path: testInfo.outputPath('category-dropdown-mobile.png'), contentType: 'image/png' });
        await page.keyboard.press('Escape');

    } finally {
        await request.patch(`${apiBase}/budgets/${budgetId}`, { headers, data: { archived: true } });
        const deleted = await request.delete(`${apiBase}/budgets/${budgetId}`, { headers });
        expect(deleted.status()).toBe(204);
    }
});
