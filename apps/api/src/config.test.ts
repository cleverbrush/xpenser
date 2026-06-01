import { UserSessionMaxAgeSeconds } from '@xpenser/contracts/session';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('API config', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('defaults user JWTs to two weeks', async () => {
        const jwtExpiresIn = process.env.JWT_EXPIRES_IN;
        delete process.env.JWT_EXPIRES_IN;
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('JWT_SECRET', 'x'.repeat(32));
        vi.stubEnv('WEB_API_SERVICE_SECRET', 'x'.repeat(32));
        vi.stubEnv('TELEGRAM_BOT_SERVICE_SECRET', 'x'.repeat(32));

        try {
            vi.resetModules();
            const { config } = await import('./config.js');

            expect(config.jwt.expiresInSeconds).toBe(UserSessionMaxAgeSeconds);
        } finally {
            if (jwtExpiresIn === undefined) {
                delete process.env.JWT_EXPIRES_IN;
            } else {
                process.env.JWT_EXPIRES_IN = jwtExpiresIn;
            }
        }
    });

    it('normalizes email report feature flags', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('JWT_SECRET', 'x'.repeat(32));
        vi.stubEnv('WEB_API_SERVICE_SECRET', 'x'.repeat(32));
        vi.stubEnv('TELEGRAM_BOT_SERVICE_SECRET', 'x'.repeat(32));
        vi.stubEnv('EMAIL_REPORTS_ENABLED', '1');
        vi.stubEnv('EMAIL_REPORTS_SCHEDULER_ENABLED', 'true');
        vi.stubEnv('EMAIL_FROM', 'Xpenser <noreply@example.com>');
        vi.resetModules();

        const { config } = await import('./config.js');

        expect(config.emailReports.enabled).toBe(true);
        expect(config.emailReports.schedulerEnabled).toBe(true);
        expect(config.emailReports.deliveryHourLocal).toBe(8);
        expect(config.emailConfirmation.tokenTtlSeconds).toBe(86_400);
        expect(config.resend.emailFrom).toBe('Xpenser <noreply@example.com>');
        expect(config.openai.reportModel).toBe('gpt-5-mini');
    });
});
