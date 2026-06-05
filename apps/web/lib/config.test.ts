import { afterEach, describe, expect, it, vi } from 'vitest';

const PLACEHOLDER_SECRET = 'change-me-in-production-min32chars';

describe('web config secret guards', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('rejects the placeholder Auth.js secret in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('NEXTAUTH_SECRET', PLACEHOLDER_SECRET);
        vi.resetModules();

        const { getNextAuthSecret } = await import('./config');

        expect(() => getNextAuthSecret()).toThrow(
            'Refusing to start with placeholder production secret: NEXTAUTH_SECRET'
        );
    });

    it('rejects the placeholder web-to-API service secret in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('WEB_API_SERVICE_SECRET', PLACEHOLDER_SECRET);
        vi.resetModules();

        const { getWebApiServiceSecret } = await import('./config');

        expect(() => getWebApiServiceSecret()).toThrow(
            'Refusing to start with placeholder production secret: WEB_API_SERVICE_SECRET'
        );
    });
});
