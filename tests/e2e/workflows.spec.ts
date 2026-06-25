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
    await page
        .getByRole('button', {
            exact: true,
            name: type === 'income' ? 'Add income' : 'Add expense'
        })
        .click();

    const form = page.getByTestId(`${type}-category-form`);
    await form
        .getByLabel(
            `New ${type === 'income' ? 'Income' : 'Expense'} category name`
        )
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
    occurredAt = dateTimeLocalValue(),
    vendor?: string,
    tags: readonly string[] = []
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
    if (vendor) {
        await addDialog.getByLabel('Vendor').fill(vendor);
        await addDialog.getByRole('button', { name: `Add ${vendor}` }).click();
        await expect(addDialog.getByText(vendor)).toBeVisible({
            timeout: 15_000
        });
    }
    for (const tag of tags) {
        await addDialog.getByLabel('Tags').fill(tag);
        await addDialog.getByLabel('Tags').press('Enter');
        await expect(
            addDialog.getByRole('button', { name: `Remove tag ${tag}` })
        ).toBeVisible();
    }
    await addDialog.getByRole('button', { name: 'Save' }).click();
    await expect(addDialog).toBeHidden({ timeout: 15_000 });
}

function startOfDayDateTime(date: string): string {
    return `${date}T00:00`;
}

async function swipeReportAreaFromBlankSpace(
    page: import('@playwright/test').Page
): Promise<void> {
    const swipeArea = page.getByTestId('dashboard-swipe-area');
    await expect(swipeArea).toBeVisible();
    const box = await swipeArea.boundingBox();
    if (!box) {
        throw new Error('Report swipe area was not visible.');
    }

    const y = box.y + box.height - 24;
    const startX = box.x + 48;
    const endX = Math.min(box.x + box.width - 24, startX + 260);

    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 8 });
    await page.mouse.up();
}

test.describe('authenticated app workflows', () => {
    test('signs out to the public index page', async ({ page }) => {
        await page.goto('/dashboard');
        await page.getByRole('button', { name: 'Sign out' }).click();

        await expect(page).toHaveURL('/');
        await expect(
            page.getByRole('heading', {
                level: 1,
                name: /Self-hosted personal finance tracking with xpenser/i
            })
        ).toBeVisible();
    });

    test('opens the main authenticated sections', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(
            page.getByRole('heading', { level: 1, name: 'Dashboard' })
        ).toBeVisible();

        await page.getByRole('link', { name: 'Transactions' }).first().click();
        await expect(
            page.getByRole('heading', { level: 1, name: 'Transactions' })
        ).toBeVisible();

        await page.getByRole('link', { name: 'Add' }).first().click();
        await expect(
            page.getByRole('button', { name: 'Save transaction' })
        ).toBeVisible();
        await expect(page.getByLabel('Note')).toBeVisible();

        await page.getByRole('link', { name: 'Preferences' }).first().click();
        await expect(
            page.getByRole('heading', { name: 'User preferences' })
        ).toBeVisible();
        await expect(page.getByText('MCP server')).toBeVisible();
        await expect(page.getByText('/api/mcp').first()).toBeVisible();
    });

    test('swipes sparse dashboard and vendor reports from empty body space', async ({
        page
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });

        await page.goto('/dashboard?period=day&date=2001-01-02');
        await expect(
            page.getByRole('heading', { level: 1, name: 'Dashboard' })
        ).toBeVisible();
        await swipeReportAreaFromBlankSpace(page);
        await expect(page).toHaveURL(url => {
            return (
                url.pathname === '/dashboard' &&
                url.searchParams.get('period') === 'day' &&
                url.searchParams.get('date') === '2001-01-01'
            );
        });

        await page.goto('/vendors?period=day&date=2001-01-02');
        await expect(
            page.getByRole('heading', { level: 1, name: 'Vendors' })
        ).toBeVisible();
        await swipeReportAreaFromBlankSpace(page);
        await expect(page).toHaveURL(url => {
            return (
                url.pathname === '/vendors' &&
                url.searchParams.get('period') === 'day' &&
                url.searchParams.get('date') === '2001-01-01'
            );
        });
    });

    test('expands dashboard vendor and vendor category breakdowns', async ({
        page
    }) => {
        const expenseCategory = uniqueName('E2E nested expense');
        const firstVendor = uniqueName('E2E nested small');
        const secondVendor = uniqueName('E2E nested large');

        await createCategory(page, expenseCategory, 'expense');
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
        const occurredAt = startOfDayDateTime(periodDate);

        await createTransaction(
            page,
            expenseCategory,
            'expense',
            '20',
            uniqueName('E2E nested small note'),
            occurredAt,
            firstVendor
        );
        await createTransaction(
            page,
            expenseCategory,
            'expense',
            '80',
            uniqueName('E2E nested large note'),
            occurredAt,
            secondVendor
        );

        await page.goto(`/dashboard?period=day&date=${periodDate}`);
        await page
            .getByRole('button', { name: `Expand ${expenseCategory}` })
            .click();
        await expect(page.getByText(secondVendor)).toBeVisible();
        await expect(page.getByText(firstVendor)).toBeVisible();
        const dashboardText = (await page.locator('body').textContent()) ?? '';
        expect(dashboardText.indexOf(secondVendor)).toBeLessThan(
            dashboardText.indexOf(firstVendor)
        );
        const dashboardLink =
            (await page
                .getByRole('link', { name: new RegExp(secondVendor) })
                .first()
                .getAttribute('href')) ?? '';
        expect(dashboardLink).toContain('/transactions?');
        expect(dashboardLink).toContain('type=expense');
        expect(dashboardLink).toContain('categoryId=');
        expect(dashboardLink).toContain('vendorId=');

        await page.goto(`/vendors?period=day&date=${periodDate}`);
        await page
            .getByRole('button', { name: `Expand ${secondVendor}` })
            .click();
        await expect(page.getByText(expenseCategory)).toBeVisible();
        const vendorsLink =
            (await page
                .getByRole('link', { name: new RegExp(expenseCategory) })
                .first()
                .getAttribute('href')) ?? '';
        expect(vendorsLink).toContain('/transactions?');
        expect(vendorsLink).toContain('type=expense');
        expect(vendorsLink).toContain('categoryId=');
        expect(vendorsLink).toContain('vendorId=');
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

    test('filters transactions by tags', async ({ page }) => {
        const expenseCategory = uniqueName('E2E tagged expense');
        const meTag = uniqueName('E2E me tag');
        const wifeTag = uniqueName('E2E wife tag');

        await createCategory(page, expenseCategory, 'expense');
        await createTransaction(
            page,
            expenseCategory,
            'expense',
            '10.00',
            uniqueName('E2E tagged me note'),
            dateTimeLocalValue(),
            undefined,
            [meTag]
        );
        await createTransaction(
            page,
            expenseCategory,
            'expense',
            '20.00',
            uniqueName('E2E tagged wife note'),
            dateTimeLocalValue(),
            undefined,
            [wifeTag]
        );

        await page.goto('/transactions');
        await page.getByRole('button', { name: /Filters/ }).click();
        await expect(page.getByLabel(meTag)).toBeVisible({
            timeout: 15_000
        });
        await page.getByLabel(meTag).check();
        await page.getByRole('button', { name: 'Apply' }).click();

        await expect(page).toHaveURL(/\/transactions\?.*tagId=/);
        await expect(
            page.getByRole('row').filter({ hasText: meTag })
        ).toHaveCount(1, { timeout: 15_000 });
        await expect(
            page.getByRole('row').filter({ hasText: wifeTag })
        ).toHaveCount(0);
    });

    test('reports expense distribution by tags', async ({ page }) => {
        const expenseCategory = uniqueName('E2E report tag expense');
        const meTag = uniqueName('E2E report me tag');
        const wifeTag = uniqueName('E2E report wife tag');
        const meNote = uniqueName('E2E report me note');
        const sharedNote = uniqueName('E2E report shared note');
        const untaggedNote = uniqueName('E2E report untagged note');
        const meVendor = uniqueName('E2E report me vendor');
        const sharedVendor = uniqueName('E2E report shared vendor');
        const untaggedVendor = uniqueName('E2E report untagged vendor');
        const reportDate = dateTimeLocalValue().slice(0, 10);
        const occurredAt = startOfDayDateTime(reportDate);

        await createCategory(page, expenseCategory, 'expense');
        await createTransaction(
            page,
            expenseCategory,
            'expense',
            '10.00',
            meNote,
            occurredAt,
            meVendor,
            [meTag]
        );
        await createTransaction(
            page,
            expenseCategory,
            'expense',
            '20.00',
            sharedNote,
            occurredAt,
            sharedVendor,
            [meTag, wifeTag]
        );
        await createTransaction(
            page,
            expenseCategory,
            'expense',
            '5.00',
            untaggedNote,
            occurredAt,
            untaggedVendor
        );

        await page.goto(`/stats?period=day&date=${reportDate}&view=tags`);
        await expect(
            page.getByRole('heading', { level: 1, name: 'Reports' })
        ).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Tags' })).toHaveAttribute(
            'aria-selected',
            'true'
        );
        await expect(
            page.getByRole('link', { name: new RegExp(meTag) })
        ).toBeVisible({ timeout: 15_000 });
        await expect(
            page.getByRole('link', { name: new RegExp(wifeTag) })
        ).toBeVisible();
        await expect(
            page.getByRole('link', { name: /Untagged/ })
        ).toBeVisible();

        await page.getByRole('link', { name: new RegExp(meTag) }).click();
        await expect(page).toHaveURL(url => {
            return (
                url.pathname === '/stats' &&
                url.searchParams.get('view') === 'tags' &&
                Boolean(url.searchParams.get('tag'))
            );
        });
        await expect(
            page.getByRole('heading', { level: 3, name: meTag })
        ).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText(expenseCategory).first()).toBeVisible();

        const tagTransactionsHref =
            (await page
                .getByRole('link', { name: /-\$30\.00/ })
                .last()
                .getAttribute('href')) ?? '/transactions';
        await page.goto(tagTransactionsHref);
        await expect(page).toHaveURL(url => {
            return (
                url.pathname === '/transactions' &&
                url.searchParams.get('type') === 'expense' &&
                Boolean(url.searchParams.get('tagId'))
            );
        });
        await expect(
            page.getByRole('row').filter({ hasText: meVendor })
        ).toHaveCount(1, { timeout: 15_000 });
        await expect(
            page.getByRole('row').filter({ hasText: sharedVendor })
        ).toHaveCount(1);
        await expect(
            page.getByRole('row').filter({ hasText: untaggedVendor })
        ).toHaveCount(0);
    });

    test('creates subcategories and hides archived trees from transaction creation', async ({
        page
    }) => {
        const parentCategory = uniqueName('E2E archive parent');
        const childCategory = uniqueName('E2E archive child');
        const activeCategory = uniqueName('E2E archive active');

        await createCategory(page, parentCategory, 'expense');

        await page.goto('/settings/categories');
        await page
            .getByRole('button', {
                exact: true,
                name: `Expand ${parentCategory}`
            })
            .click();
        await page
            .getByRole('button', {
                exact: true,
                name: `Add subcategory to ${parentCategory}`
            })
            .click();
        const subcategoryForm = page.getByTestId('subcategory-form').filter({
            has: page.getByLabel(`New ${parentCategory} subcategory name`)
        });
        await subcategoryForm
            .getByLabel(`New ${parentCategory} subcategory name`)
            .fill(childCategory);
        await subcategoryForm.getByLabel('Reverse direction').check();
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
        await expect(
            page.getByRole('button', {
                exact: true,
                name: `Edit ${parentCategory}`
            })
        ).toHaveCount(0);
        await expect(
            page.getByRole('button', {
                exact: true,
                name: `Delete ${parentCategory}`
            })
        ).toHaveCount(0);

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

    test('does not autofocus category name on mobile edit', async ({ page }) => {
        const category = uniqueName('E2E mobile edit');

        await page.setViewportSize({ height: 844, width: 390 });
        await createCategory(page, category, 'expense');

        await page.goto('/settings/categories');
        await page
            .getByRole('button', {
                exact: true,
                name: `Edit ${category}`
            })
            .click();

        const editDialog = page.getByRole('dialog', { name: 'Edit category' });
        await expect(editDialog).toBeVisible();
        const nameInput = editDialog.getByLabel('Name');
        await expect(nameInput).toHaveValue(category);
        await expect(nameInput).not.toBeFocused();
    });

    test('moves transactions before deleting an in-use category', async ({
        page
    }) => {
        const sourceCategory = uniqueName('E2E move source');
        const replacementCategory = uniqueName('E2E move target');
        const returnsParentCategory = uniqueName('E2E move returns parent');
        const returnsCategory = uniqueName('E2E move returns');
        const note = uniqueName('E2E move note');

        await createCategory(page, sourceCategory, 'expense');
        await createCategory(page, replacementCategory, 'expense');
        await createCategory(page, returnsParentCategory, 'expense');

        await page.goto('/settings/categories');
        await page
            .getByRole('button', {
                exact: true,
                name: `Expand ${returnsParentCategory}`
            })
            .click();
        await page
            .getByRole('button', {
                exact: true,
                name: `Add subcategory to ${returnsParentCategory}`
            })
            .click();
        const returnsForm = page.getByTestId('subcategory-form').filter({
            has: page.getByLabel(
                `New ${returnsParentCategory} subcategory name`
            )
        });
        await returnsForm
            .getByLabel(`New ${returnsParentCategory} subcategory name`)
            .fill(returnsCategory);
        await returnsForm.getByLabel('Reverse direction').check();
        await returnsForm
            .getByRole('button', { name: 'Add subcategory' })
            .click();
        await expect(
            page.getByText(returnsCategory).filter({ visible: true }).first()
        ).toBeVisible({ timeout: 15_000 });

        await createTransaction(page, sourceCategory, 'expense', '8.90', note);

        await page.goto('/settings/categories');
        await page
            .getByRole('button', {
                exact: true,
                name: `Delete ${sourceCategory}`
            })
            .click();

        const deleteDialog = page.getByRole('dialog', {
            name: 'Delete category?'
        });
        await expect(deleteDialog).toBeVisible();
        await deleteDialog.getByLabel('Replacement category').click();
        await expect(
            page.getByRole('option', {
                exact: true,
                name: replacementCategory
            })
        ).toBeVisible();
        await expect(
            page.getByRole('option', {
                exact: true,
                name: `${returnsParentCategory} -> ${returnsCategory}`
            })
        ).toHaveCount(0);
        await page
            .getByRole('option', {
                exact: true,
                name: replacementCategory
            })
            .click();
        await deleteDialog
            .getByRole('button', { name: 'Move and delete' })
            .click();
        await expect(deleteDialog).toBeHidden({ timeout: 15_000 });
        await expect(
            page.getByRole('button', {
                exact: true,
                name: `Delete ${sourceCategory}`
            })
        ).toHaveCount(0);

        await page.goto(
            `/transactions?search=${encodeURIComponent(note)}`
        );

        await expect(page.getByLabel('Search')).toHaveValue(note);
        const row = page.getByRole('row').filter({
            hasText: replacementCategory
        });
        await expect(row).toHaveCount(1, { timeout: 15_000 });
        await expect(row.first()).not.toContainText(sourceCategory);
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

        await page.goto(`/dashboard?period=day&date=${periodDate}`);
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

        await page.goto(`/dashboard?period=day&date=${periodDate}`);
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
        const occurredAt = startOfDayDateTime(periodDate);

        await createTransaction(
            page,
            expenseCategory,
            'expense',
            '12.34',
            expenseNote,
            occurredAt
        );

        await page.goto(
            `/stats?period=day&date=${occurredAt.slice(0, 10)}&view=categories`
        );
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
        const transactionDate = occurredAt.slice(0, 10);
        const currentMonthFrom = `${transactionDate.slice(0, 7)}-01`;
        await fromInput.fill(currentMonthFrom);
        await toInput.fill(transactionDate);
        await expect(page).toHaveURL(url => {
            return (
                url.pathname.startsWith('/stats/categories/') &&
                url.searchParams.get('groupBy') === 'week' &&
                url.searchParams.get('range') === 'custom' &&
                url.searchParams.get('from') === currentMonthFrom &&
                url.searchParams.get('to') === transactionDate
            );
        });

        const drilldownLink = page
            .getByRole('link', { name: /View .* transactions/ })
            .first();
        await expect(drilldownLink).toBeVisible();
        const drilldownHref = await drilldownLink.getAttribute('href');
        expect(drilldownHref).toMatch(/^\/transactions\?/);
        await page.goto(drilldownHref ?? '/transactions');
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
