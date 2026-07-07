import {
    HostedXpenserOrigin,
    HostedXpenserPassportDefaults
} from '@xpenser/contracts/hosted-auth';
import { UserSessionMaxAgeSeconds } from '@xpenser/contracts/session';
import { afterEach, describe, expect, it, vi } from 'vitest';

function stubRequiredApiEnv({
    appUrl = 'https://self.example.com',
    passportBaseUrl = '',
    passportProject = '',
    passportEnvironment = ''
}: {
    readonly appUrl?: string;
    readonly passportBaseUrl?: string;
    readonly passportProject?: string;
    readonly passportEnvironment?: string;
} = {}) {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('APP_URL', appUrl);
    vi.stubEnv('JWT_SECRET', 'x'.repeat(32));
    vi.stubEnv('WEB_API_SERVICE_SECRET', 'x'.repeat(32));
    vi.stubEnv('TELEGRAM_BOT_SERVICE_SECRET', 'x'.repeat(32));
    vi.stubEnv('PASSPORT_BASE_URL', passportBaseUrl);
    vi.stubEnv('PASSPORT_PROJECT', passportProject);
    vi.stubEnv('PASSPORT_ENVIRONMENT', passportEnvironment);
}

describe('API config', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('defaults user JWTs to two weeks', async () => {
        const jwtExpiresIn = process.env.JWT_EXPIRES_IN;
        delete process.env.JWT_EXPIRES_IN;
        stubRequiredApiEnv();

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

    it('uses Passport defaults for the hosted app without explicit Passport env', async () => {
        stubRequiredApiEnv({ appUrl: HostedXpenserOrigin });
        vi.resetModules();

        const { config } = await import('./config.js');

        expect(config.passport).toMatchObject(HostedXpenserPassportDefaults);
    });

    it('preserves explicit Passport env values for the hosted app', async () => {
        stubRequiredApiEnv({
            appUrl: HostedXpenserOrigin,
            passportBaseUrl: 'https://auth.override.example.com',
            passportProject: 'custom-project',
            passportEnvironment: 'staging'
        });
        vi.resetModules();

        const { config } = await import('./config.js');

        expect(config.passport).toMatchObject({
            baseUrl: 'https://auth.override.example.com',
            project: 'custom-project',
            environment: 'staging'
        });
    });

    it('does not add Passport defaults for non-hosted apps', async () => {
        stubRequiredApiEnv({ appUrl: 'https://self.example.com' });
        vi.resetModules();

        const { config } = await import('./config.js');

        expect(config.passport).toMatchObject({
            baseUrl: '',
            project: '',
            environment: ''
        });
    });

    it('keeps single-user mode disabled by default', async () => {
        stubRequiredApiEnv();
        vi.resetModules();

        const { config } = await import('./config.js');

        expect(config.singleUser).toEqual({ enabled: false, email: '' });
    });

    it('normalizes configured single-user mode email', async () => {
        stubRequiredApiEnv();
        vi.stubEnv('XPENSER_SINGLE_USER_MODE', '1');
        vi.stubEnv('XPENSER_SINGLE_USER_EMAIL', ' Owner@Example.COM ');
        vi.resetModules();

        const { config } = await import('./config.js');

        expect(config.singleUser).toEqual({
            enabled: true,
            email: 'owner@example.com'
        });
    });

    it('requires a valid email when single-user mode is enabled', async () => {
        stubRequiredApiEnv();
        vi.stubEnv('XPENSER_SINGLE_USER_MODE', 'true');
        vi.resetModules();

        await expect(import('./config.js')).rejects.toThrow(
            'XPENSER_SINGLE_USER_EMAIL is required'
        );

        vi.resetModules();
        vi.stubEnv('XPENSER_SINGLE_USER_EMAIL', 'not-an-email');

        await expect(import('./config.js')).rejects.toThrow(
            'XPENSER_SINGLE_USER_EMAIL must be a valid email address.'
        );
    });

    it('normalizes email report feature flags', async () => {
        stubRequiredApiEnv();
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
        expect(config.openai.transactionScanModel).toBe('gpt-5.5');
    });

    it('accepts shell-style false feature flags', async () => {
        stubRequiredApiEnv();
        vi.stubEnv('BRANDFETCH_API_KEY', 'brandfetch-key');
        vi.stubEnv('EMAIL_REPORTS_ENABLED', 'off');
        vi.stubEnv('EMAIL_REPORTS_SCHEDULER_ENABLED', 'no');
        vi.stubEnv('VENDOR_ENRICHMENT_ENABLED', '0');
        vi.resetModules();

        const { config } = await import('./config.js');

        expect(config.emailReports.enabled).toBe(false);
        expect(config.emailReports.schedulerEnabled).toBe(false);
        expect(config.vendorEnrichment.enabled).toBe(false);
    });

    it('accepts shell-style true single-user mode flags', async () => {
        stubRequiredApiEnv();
        vi.stubEnv('XPENSER_SINGLE_USER_MODE', 'on');
        vi.stubEnv('XPENSER_SINGLE_USER_EMAIL', ' Owner@Example.COM ');
        vi.resetModules();

        const { config } = await import('./config.js');

        expect(config.singleUser).toEqual({
            enabled: true,
            email: 'owner@example.com'
        });
    });

    it('normalizes vendor enrichment feature flags', async () => {
        stubRequiredApiEnv();
        vi.stubEnv('BRANDFETCH_API_KEY', 'brandfetch-key');
        vi.stubEnv('BRANDFETCH_CLIENT_ID', 'brandfetch-client');
        vi.stubEnv('VENDOR_ENRICHMENT_ENABLED', 'yes');
        vi.stubEnv('VENDOR_ENRICHMENT_TIMEOUT_MS', '1234');
        vi.resetModules();

        const { config } = await import('./config.js');

        expect(config.brandfetch.apiKey).toBe('brandfetch-key');
        expect(config.brandfetch.clientId).toBe('brandfetch-client');
        expect(config.vendorEnrichment.enabled).toBe(true);
        expect(config.vendorEnrichment.timeoutMs).toBe(1234);
    });

    it('rejects placeholder secrets in production', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('JWT_SECRET', 'change-me-in-production-min32chars');
        vi.stubEnv(
            'WEB_API_SERVICE_SECRET',
            'change-me-in-production-min32chars'
        );
        vi.stubEnv(
            'TELEGRAM_BOT_SERVICE_SECRET',
            'change-me-in-production-min32chars'
        );
        vi.resetModules();

        await expect(import('./config.js')).rejects.toThrow(
            'Refusing to start with placeholder production secrets: JWT_SECRET, WEB_API_SERVICE_SECRET, TELEGRAM_BOT_SERVICE_SECRET'
        );
    });
});
