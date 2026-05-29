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
});
