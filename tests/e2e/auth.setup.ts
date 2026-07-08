import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { test } from '@playwright/test';
import { authStorageState, ensureDashboardReady, signIn } from './helpers';

test.use({ storageState: undefined });
test.setTimeout(60_000);

test('authenticate seeded test user', async ({ page }) => {
    await signIn(page);
    await ensureDashboardReady(page);

    mkdirSync(dirname(authStorageState), { recursive: true });
    await page.context().storageState({ path: authStorageState });
});
