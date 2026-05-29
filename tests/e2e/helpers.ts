import { expect, type Locator, type Page } from '@playwright/test';

export const authStorageState = '.playwright/.auth/user.json';

export const testUser = {
    email: process.env.PLAYWRIGHT_TEST_EMAIL ?? 'test@cleverbrush.com',
    password: process.env.PLAYWRIGHT_TEST_PASSWORD ?? 'testPassw0rd'
};

export function uniqueName(prefix: string): string {
    return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
}

export function dateTimeLocalValue(value = new Date()): string {
    const offset = value.getTimezoneOffset() * 60_000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export async function selectOption(
    page: Page,
    trigger: Locator,
    name: string
): Promise<void> {
    await trigger.click();
    await page.getByRole('option', { exact: true, name }).click();
}

export async function signIn(page: Page): Promise<void> {
    await page.goto('/login');
    await page.getByLabel('Email').fill(testUser.email);
    await page.getByLabel('Password').fill(testUser.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/(?:dashboard|setup\/categories)(?:[?#].*)?$/, {
        timeout: 30_000
    });
}

export async function ensureDashboardReady(page: Page): Promise<void> {
    if (/\/setup\/categories(?:[?#].*)?$/.test(new URL(page.url()).pathname)) {
        await page
            .getByLabel('Category 1 name')
            .fill(uniqueName('E2E setup expense'));
        await page
            .getByLabel('Category 2 name')
            .fill(uniqueName('E2E setup income'));
        await page
            .getByLabel('Category 2 type')
            .selectOption({ label: 'Income' });
        await page.getByRole('button', { name: 'Create categories' }).click();
        await page.waitForURL(/\/dashboard(?:[?#].*)?$/, {
            timeout: 30_000
        });
    }

    await expect(
        page.getByRole('heading', { level: 1, name: 'Dashboard' })
    ).toBeVisible({ timeout: 30_000 });
}

