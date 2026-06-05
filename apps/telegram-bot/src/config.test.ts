import { afterEach, describe, expect, it, vi } from 'vitest';

const PLACEHOLDER_SECRET = 'change-me-in-production-min32chars';

async function importConfig() {
    vi.resetModules();
    return import('./config.js');
}

describe('Telegram bot config', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('allows the documented placeholder secret outside production', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('TELEGRAM_BOT_TOKEN', 'telegram-token');
        vi.stubEnv('TELEGRAM_BOT_USERNAME', 'xpenser_bot');

        const { botConfig } = await importConfig();

        expect(botConfig.serviceSecret).toBe(PLACEHOLDER_SECRET);
    });

    it('rejects the placeholder service secret in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('TELEGRAM_BOT_TOKEN', 'telegram-token');
        vi.stubEnv('TELEGRAM_BOT_USERNAME', 'xpenser_bot');
        vi.stubEnv('TELEGRAM_BOT_SERVICE_SECRET', PLACEHOLDER_SECRET);

        await expect(importConfig()).rejects.toThrow(
            'Refusing to start with placeholder production secret: TELEGRAM_BOT_SERVICE_SECRET'
        );
    });
});
