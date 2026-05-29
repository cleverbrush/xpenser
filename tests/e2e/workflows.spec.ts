import { expect, test } from '@playwright/test';
import {
    dateTimeLocalValue,
    selectOption,
    uniqueName
} from './helpers';

async function createCategory(
    page: import('@playwright/test').Page,
    name: string,
    type: 'expense' | 'income'
): Promise<void> {
    await page.goto('/settings/preferences');

    const form = page.getByTestId('category-form');
    await form.getByLabel('Name').fill(name);
    if (type === 'income') {
        await selectOption(page, form.getByLabel('Category type'), 'Income');
    }

    await form.getByRole('button', { name: 'Create category' }).click();
    await expect(page.getByText(name).first()).toBeVisible({
        timeout: 15_000
    });
}

test.describe('authenticated app workflows', () => {
    test('opens the main authenticated sections', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(
            page.getByRole('heading', { level: 1, name: 'Dashboard' })
        ).toBeVisible();

        await page.getByRole('link', { name: 'Transactions' }).first().click();
        await expect(
            page.getByRole('heading', { level: 1, name: 'Transactions' })
        ).toBeVisible();

        await page.getByRole('link', { name: 'Preferences' }).first().click();
        await expect(
            page.getByRole('heading', { name: 'User preferences' })
        ).toBeVisible();
    });

    test('creates categories and manages a transaction lifecycle', async ({
        page
    }) => {
        const expenseCategory = uniqueName('E2E expense');
        const incomeCategory = uniqueName('E2E income');
        const note = uniqueName('E2E transaction note');

        await createCategory(page, expenseCategory, 'expense');
        await createCategory(page, incomeCategory, 'income');

        await page.goto('/dashboard');
        await page
            .getByRole('button', { name: /^(Add|Add transaction)$/ })
            .click();

        const addDialog = page.getByRole('dialog', {
            name: 'Add transaction'
        });
        await expect(addDialog).toBeVisible();
        await selectOption(
            page,
            addDialog.getByLabel('Transaction category'),
            expenseCategory
        );
        await addDialog.getByLabel('Amount').fill('12.34');
        await addDialog
            .getByLabel('Date and time')
            .fill(dateTimeLocalValue());
        await addDialog.getByLabel('Note').fill(note);
        await addDialog.getByRole('button', { name: 'Save' }).click();
        await expect(addDialog).toBeHidden({ timeout: 15_000 });

        await page.goto('/transactions');
        await page.getByRole('button', { name: /Filters/ }).click();
        await page.getByLabel('Search').fill(note);
        await page.getByRole('button', { name: 'Apply' }).click();
        await expect(page).toHaveURL(/\/transactions\?search=/);

        const row = page.getByRole('row').filter({ hasText: expenseCategory });
        await expect(row).toHaveCount(1, { timeout: 15_000 });
        await row.first().getByLabel('Edit transaction').click();

        const editDialog = page.getByRole('dialog', {
            name: 'Edit transaction'
        });
        await expect(editDialog).toBeVisible();
        await editDialog.getByLabel('Amount').fill('23.45');
        await editDialog
            .getByRole('button', { name: 'Save changes' })
            .click();
        await expect(editDialog).toBeHidden({ timeout: 15_000 });
        await expect(page.getByText('-$23.45').first()).toBeVisible({
            timeout: 15_000
        });

        await row.first().getByLabel('Delete transaction').click();
        const deleteDialog = page.getByRole('dialog', {
            name: 'Delete transaction?'
        });
        await expect(deleteDialog).toBeVisible();
        await deleteDialog.getByRole('button', { name: 'Delete' }).click();
        await expect(deleteDialog).toBeHidden({ timeout: 15_000 });
        await expect(row).toHaveCount(0, { timeout: 15_000 });
    });
});

