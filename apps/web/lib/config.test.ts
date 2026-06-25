import {
    HostedXpenserOrigin,
    HostedXpenserPassportDefaults
} from '@xpenser/contracts/hosted-auth';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PLACEHOLDER_SECRET = 'change-me-in-production-min32chars';

function stubGoogleSignInEnv({
    appUrl = HostedXpenserOrigin,
    mode = 'auto',
    passportBaseUrl = '',
    passportProject = '',
    passportEnvironment = ''
}: {
    readonly appUrl?: string;
    readonly mode?: string;
    readonly passportBaseUrl?: string;
    readonly passportProject?: string;
    readonly passportEnvironment?: string;
} = {}) {
    vi.stubEnv('APP_URL', appUrl);
    vi.stubEnv('GOOGLE_SIGN_IN_MODE', mode);
    vi.stubEnv('AUTH_GOOGLE_ID', '');
    vi.stubEnv('AUTH_GOOGLE_SECRET', '');
    vi.stubEnv('PASSPORT_BASE_URL', passportBaseUrl);
    vi.stubEnv('PASSPORT_PROJECT', passportProject);
    vi.stubEnv('PASSPORT_ENVIRONMENT', passportEnvironment);
}

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

    it('uses the web-to-API secret for Auth.js in single-user mode', async () => {
        vi.stubEnv('XPENSER_SINGLE_USER_MODE', '1');
        vi.stubEnv('XPENSER_SINGLE_USER_EMAIL', 'owner@example.com');
        vi.stubEnv('WEB_API_SERVICE_SECRET', 'x'.repeat(32));
        vi.stubEnv('NEXTAUTH_SECRET', '');
        vi.resetModules();

        const { getNextAuthSecret } = await import('./config');

        expect(getNextAuthSecret()).toBe('x'.repeat(32));
    });
});

describe('web Google sign-in config', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('enables Passport sign-in for the hosted app without explicit Passport env', async () => {
        stubGoogleSignInEnv();
        vi.resetModules();

        const { getGoogleSignInProvider, webConfig } = await import('./config');

        expect(getGoogleSignInProvider()).toBe('passport');
        expect(webConfig.passport).toEqual(HostedXpenserPassportDefaults);
    });

    it('preserves explicit Passport env values for the hosted app', async () => {
        stubGoogleSignInEnv({
            passportBaseUrl: 'https://auth.override.example.com',
            passportProject: 'custom-project',
            passportEnvironment: 'staging'
        });
        vi.resetModules();

        const { webConfig } = await import('./config');

        expect(webConfig.passport).toEqual({
            baseUrl: 'https://auth.override.example.com',
            project: 'custom-project',
            environment: 'staging'
        });
    });

    it('keeps Google sign-in disabled for non-hosted apps without auth config', async () => {
        stubGoogleSignInEnv({ appUrl: 'https://self.example.com' });
        vi.resetModules();

        const { getGoogleSignInProvider } = await import('./config');

        expect(getGoogleSignInProvider()).toBe('disabled');
    });

    it('keeps GOOGLE_SIGN_IN_MODE=disabled authoritative for the hosted app', async () => {
        stubGoogleSignInEnv({ mode: 'disabled' });
        vi.resetModules();

        const { getGoogleSignInProvider } = await import('./config');

        expect(getGoogleSignInProvider()).toBe('disabled');
    });

    it('normalizes configured single-user mode email', async () => {
        stubGoogleSignInEnv({ appUrl: 'https://self.example.com' });
        vi.stubEnv('XPENSER_SINGLE_USER_MODE', 'yes');
        vi.stubEnv('XPENSER_SINGLE_USER_EMAIL', ' Owner@Example.COM ');
        vi.resetModules();

        const { webConfig } = await import('./config');

        expect(webConfig.singleUser).toEqual({
            enabled: true,
            email: 'owner@example.com'
        });
    });

    it('requires a valid email when single-user mode is enabled', async () => {
        stubGoogleSignInEnv({ appUrl: 'https://self.example.com' });
        vi.stubEnv('XPENSER_SINGLE_USER_MODE', '1');
        vi.resetModules();

        await expect(import('./config')).rejects.toThrow(
            'XPENSER_SINGLE_USER_EMAIL is required'
        );

        vi.resetModules();
        vi.stubEnv('XPENSER_SINGLE_USER_EMAIL', 'not-an-email');

        await expect(import('./config')).rejects.toThrow(
            'XPENSER_SINGLE_USER_EMAIL must be a valid email address.'
        );
    });
});
