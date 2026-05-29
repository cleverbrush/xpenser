import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL;

if (!baseURL) {
    throw new Error(
        'PLAYWRIGHT_BASE_URL is required. Point it at the deployed PR environment.'
    );
}

const authStorageState = '.playwright/.auth/user.json';

export default defineConfig({
    testDir: './tests/e2e',
    outputDir: 'test-results',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [
        ['list'],
        ['html', { open: 'never', outputFolder: 'playwright-report' }]
    ],
    use: {
        baseURL,
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        video: 'retain-on-failure'
    },
    projects: [
        {
            name: 'setup',
            testMatch: /.*\.setup\.ts/
        },
        {
            name: 'chromium',
            dependencies: ['setup'],
            testMatch: /.*\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: authStorageState
            }
        }
    ]
});
