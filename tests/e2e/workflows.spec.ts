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
    await page.goto('/settings/categories');

    const form = page.getByTestId(`${type}-category-form`);
    await form
        .getByLabel(`New ${type === 'income' ? 'Income' : 'Expense'} category name`)
        .fill(name);

    await form
        .getByRole('button', {
            name: type === 'income' ? 'Add income' : 'Add expense'
        })
        .click();
    await expect(
        page.getByText(name).filter({ visible: true }).first()
    ).toBeVisible({
        timeout: 15_000
    });
}

async function createTransaction(
    page: import('@playwright/test').Page,
    category: string,
    type: 'expense' | 'income',
    amount: string,
    note: string,
    occurredAt = dateTimeLocalValue()
): Promise<void> {
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
        addDialog.getByLabel('Transaction type'),
        type === 'income' ? 'Income' : 'Expense'
    );
    await selectOption(
        page,
        addDialog.getByLabel('Transaction category'),
        category
    );
    await addDialog.getByLabel('Amount').fill(amount);
    await addDialog.getByLabel('Date and time').fill(occurredAt);
    await addDialog.getByLabel('Note').fill(note);
    await addDialog.getByRole('button', { name: 'Save' }).click();
    await expect(addDialog).toBeHidden({ timeout: 15_000 });
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
        await expect(
            page.getByText('-$23.45').filter({ visible: true }).first()
        ).toBeVisible({
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

    test('creates subcategories and hides archived trees from transaction creation', async ({
        page
    }) => {
        const parentCategory = uniqueName('E2E archive parent');
        const childCategory = uniqueName('E2E archive child');
        const activeCategory = uniqueName('E2E archive active');

        await createCategory(page, parentCategory, 'expense');

        await page.goto('/settings/categories');
        const subcategoryForm = page.getByTestId('subcategory-form').filter({
            has: page.getByLabel(`New ${parentCategory} subcategory name`)
        });
        await subcategoryForm
            .getByLabel(`New ${parentCategory} subcategory name`)
            .fill(childCategory);
        await subcategoryForm
            .getByLabel(`${parentCategory} subcategory behavior`)
            .selectOption({ label: 'Return' });
        await subcategoryForm
            .getByRole('button', { name: 'Add subcategory' })
            .click();
        await expect(
            page.getByText(childCategory).filter({ visible: true }).first()
        ).toBeVisible({ timeout: 15_000 });

        await createCategory(page, activeCategory, 'expense');
        await page.goto('/settings/categories');
        await page
            .getByRole('button', {
                exact: true,
                name: `Archive ${parentCategory}`
            })
            .click();
        await expect(
            page.getByRole('button', {
                exact: true,
                name: `Restore ${parentCategory}`
            })
        ).toBeVisible({ timeout: 15_000 });

        await page.goto('/dashboard');
        await page
            .getByRole('button', { name: /^(Add|Add transaction)$/ })
            .click();
        const addDialog = page.getByRole('dialog', {
            name: 'Add transaction'
        });
        await expect(addDialog).toBeVisible();
        await addDialog.getByLabel('Transaction category').click();
        await expect(
            page.getByRole('option', { exact: true, name: activeCategory })
        ).toBeVisible();
        await expect(
            page.getByRole('option', { exact: true, name: parentCategory })
        ).toHaveCount(0);
        await expect(
            page.getByRole('option', {
                exact: true,
                name: `${parentCategory} -> ${childCategory}`
            })
        ).toHaveCount(0);
    });

    test('orders add transaction categories by recent popularity', async ({
        page
    }) => {
        const mostPopular = uniqueName('E2E popular most');
        const used = uniqueName('E2E popular used');
        const unused = uniqueName('E2E popular unused');

        await createCategory(page, mostPopular, 'expense');
        await createCategory(page, used, 'expense');
        await createCategory(page, unused, 'expense');

        await createTransaction(
            page,
            mostPopular,
            'expense',
            '12.34',
            uniqueName('E2E note')
        );
        await createTransaction(
            page,
            mostPopular,
            'expense',
            '12.34',
            uniqueName('E2E note')
        );
        await createTransaction(
            page,
            used,
            'expense',
            '12.34',
            uniqueName('E2E note')
        );

        await page.goto('/dashboard');
        await page
            .getByRole('button', { name: /^(Add|Add transaction)$/ })
            .click();

        const addDialog = page.getByRole('dialog', {
            name: 'Add transaction'
        });
        await expect(addDialog).toBeVisible();
        await addDialog.getByLabel('Transaction category').click();
        await expect(
            page.getByRole('option', { exact: true, name: mostPopular })
        ).toBeVisible();
        await expect(
            page.getByRole('option', { exact: true, name: used })
        ).toBeVisible();
        await expect(
            page.getByRole('option', { exact: true, name: unused })
        ).toBeVisible();

        const optionNames = (await page.getByRole('option').allTextContents())
            .map(option => option.trim())
            .filter(Boolean);
        expect(optionNames.indexOf(mostPopular)).toBeLessThan(
            optionNames.indexOf(used)
        );
        expect(optionNames.indexOf(used)).toBeLessThan(
            optionNames.indexOf(unused)
        );
    });

    test('opens aggregate transaction filters from dashboard cards', async ({
        page
    }) => {
        const expenseCategory = uniqueName('E2E aggregate expense');
        const incomeCategory = uniqueName('E2E aggregate income');
        const expenseNote = uniqueName('E2E aggregate expense note');
        const incomeNote = uniqueName('E2E aggregate income note');

        await createCategory(page, expenseCategory, 'expense');
        await createCategory(page, incomeCategory, 'income');

        await page.goto('/dashboard');
        const expensesUrl = new URL(
            (await page
                .getByRole('link', {
                    name: 'View expenses transactions for this period'
                })
                .getAttribute('href')) ?? '/transactions',
            page.url()
        );
        const periodDate =
            expensesUrl.searchParams.get('from') ??
            dateTimeLocalValue().slice(0, 10);
        const periodOccurredAt = `${periodDate}T12:00`;

        await createTransaction(
            page,
            expenseCategory,
            'expense',
            '12.34',
            expenseNote,
            periodOccurredAt
        );
        await createTransaction(
            page,
            incomeCategory,
            'income',
            '56.78',
            incomeNote,
            periodOccurredAt
        );

        await page.goto('/dashboard');
        await page
            .getByRole('link', {
                name: 'View expenses transactions for this period'
            })
            .click();
        await expect(page).toHaveURL(url => {
            return (
                url.pathname === '/transactions' &&
                url.searchParams.get('type') === 'expense' &&
                Boolean(url.searchParams.get('from')) &&
                Boolean(url.searchParams.get('to'))
            );
        });
        await expect(page.getByLabel('Type')).toHaveValue('expense');
        await expect(
            page.getByRole('row').filter({ hasText: expenseCategory })
        ).toHaveCount(1, { timeout: 15_000 });
        await expect(
            page.getByRole('row').filter({ hasText: incomeCategory })
        ).toHaveCount(0);

        await page.goto('/dashboard');
        await page
            .getByRole('link', {
                name: 'View income transactions for this period'
            })
            .click();
        await expect(page).toHaveURL(url => {
            return (
                url.pathname === '/transactions' &&
                url.searchParams.get('type') === 'income' &&
                Boolean(url.searchParams.get('from')) &&
                Boolean(url.searchParams.get('to'))
            );
        });
        await expect(page.getByLabel('Type')).toHaveValue('income');
        await expect(
            page.getByRole('row').filter({ hasText: incomeCategory })
        ).toHaveCount(1, { timeout: 15_000 });
        await expect(
            page.getByRole('row').filter({ hasText: expenseCategory })
        ).toHaveCount(0);
    });

    test('opens category trend reports and drills into a bucket', async ({
        page
    }) => {
        const expenseCategory = uniqueName('E2E trend expense');
        const expenseNote = uniqueName('E2E trend note');

        await createCategory(page, expenseCategory, 'expense');
        await createTransaction(
            page,
            expenseCategory,
            'expense',
            '12.34',
            expenseNote
        );

        await page.goto('/stats');
        await page
            .getByRole('link', { name: new RegExp(expenseCategory) })
            .click();
        await expect(
            page.getByRole('heading', { level: 1, name: 'Category trend' })
        ).toBeVisible();
        await expect(page.getByLabel('Category')).toHaveValue(/^\d+$/);
        const controlLabels = await page
            .locator('section label')
            .evaluateAll(labels =>
                labels.map(label => label.textContent?.trim())
            );
        expect(controlLabels).toEqual(['Bucket', 'Timeframe', 'Category']);
        await expect(page.getByRole('link', { name: 'Monthly' })).toHaveAttribute(
            'aria-current',
            'page'
        );
        await expect(
            page.getByRole('link', { name: '12 months' })
        ).toHaveAttribute('aria-current', 'page');

        await page.getByRole('link', { name: 'Weekly' }).click();
        await expect(page).toHaveURL(url => {
            return (
                url.pathname.startsWith('/stats/categories/') &&
                url.searchParams.get('groupBy') === 'week'
            );
        });
        await expect(page.getByRole('link', { name: 'Weekly' })).toHaveAttribute(
            'aria-current',
            'page'
        );

        await page.getByRole('link', { name: 'Custom' }).click();
        const fromInput = page.locator('#category-trend-from');
        const toInput = page.locator('#category-trend-to');
        await expect(fromInput).toBeVisible();
        await expect(toInput).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Apply' })
        ).toHaveCount(0);
        const currentMonthFrom = `${new Date().toISOString().slice(0, 7)}-01`;
        await fromInput.fill(currentMonthFrom);
        await expect(page).toHaveURL(url => {
            return (
                url.pathname.startsWith('/stats/categories/') &&
                url.searchParams.get('groupBy') === 'week' &&
                url.searchParams.get('range') === 'custom' &&
                url.searchParams.get('from') === currentMonthFrom &&
                Boolean(url.searchParams.get('to'))
            );
        });

        await page
            .getByRole('link', { name: /View .* transactions/ })
            .first()
            .click();
        await expect(page).toHaveURL(url => {
            return (
                url.pathname === '/transactions' &&
                url.searchParams.get('type') === 'expense' &&
                Boolean(url.searchParams.get('categoryId')) &&
                Boolean(url.searchParams.get('from')) &&
                Boolean(url.searchParams.get('to'))
            );
        });
        await expect(
            page.getByRole('row').filter({ hasText: expenseCategory })
        ).toHaveCount(1, { timeout: 15_000 });
    });
});
