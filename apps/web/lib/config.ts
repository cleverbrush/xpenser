import { env, envBoolean, parseEnv } from '@cleverbrush/env';
import { string } from '@cleverbrush/schema';
import { applyHostedPassportDefaults } from '@xpenser/contracts/hosted-auth';
import { GoogleSignInModes, resolveGoogleSignInProvider } from './google-auth';

/**
 * Web runtime configuration parsed with the same `@cleverbrush/env` pattern as
 * the API. Only server-side modules should import this object; browser-exposed
 * configuration must stay behind explicit `NEXT_PUBLIC_*` variables.
 */
export const webConfig = parseEnv(
    {
        nodeEnv: env('NODE_ENV', string().default('production')),
        appUrl: env('APP_URL', string().default('http://localhost:3000')),
        apiBaseUrl: env(
            'API_BASE_URL',
            string().default('http://localhost:4000')
        ),
        logLevel: env(
            'LOG_LEVEL',
            string()
                .oneOf([
                    'trace',
                    'debug',
                    'information',
                    'warning',
                    'error',
                    'fatal'
                ] as const)
                .default('information')
        ),
        disableGtm: env('DISABLE_GTM', envBoolean().default(false)),
        feedbackWebhookUrl: env('FEEDBACK_WEBHOOK_URL', string().optional()),
        googleSignInMode: env(
            'GOOGLE_SIGN_IN_MODE',
            string().oneOf(GoogleSignInModes).default('auto')
        ),
        google: {
            clientId: env('AUTH_GOOGLE_ID', string().optional()),
            clientSecret: env('AUTH_GOOGLE_SECRET', string().optional())
        },
        passport: {
            baseUrl: env('PASSPORT_BASE_URL', string().optional()),
            project: env('PASSPORT_PROJECT', string().optional()),
            environment: env('PASSPORT_ENVIRONMENT', string().optional())
        },
        singleUserEnv: {
            enabled: env(
                'XPENSER_SINGLE_USER_MODE',
                envBoolean().default(false)
            ),
            email: env('XPENSER_SINGLE_USER_EMAIL', string().optional())
        }
    },
    base => {
        const singleUserEnabled = base.singleUserEnv.enabled;
        const singleUserEmail = base.singleUserEnv.email?.trim().toLowerCase();
        if (singleUserEnabled && !singleUserEmail) {
            throw new Error(
                'XPENSER_SINGLE_USER_EMAIL is required when XPENSER_SINGLE_USER_MODE is enabled.'
            );
        }
        if (
            singleUserEmail &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(singleUserEmail)
        ) {
            throw new Error(
                'XPENSER_SINGLE_USER_EMAIL must be a valid email address.'
            );
        }

        const feedbackWebhookUrl = base.feedbackWebhookUrl?.trim();
        if (feedbackWebhookUrl) {
            let protocol: string;
            try {
                protocol = new URL(feedbackWebhookUrl).protocol;
            } catch {
                throw new Error(
                    'FEEDBACK_WEBHOOK_URL must be a valid HTTP or HTTPS URL.'
                );
            }
            if (protocol !== 'http:' && protocol !== 'https:') {
                throw new Error(
                    'FEEDBACK_WEBHOOK_URL must be a valid HTTP or HTTPS URL.'
                );
            }
        }

        return {
            disableGtm: base.disableGtm,
            feedback: {
                webhookUrl: feedbackWebhookUrl || undefined
            },
            passport: applyHostedPassportDefaults(base.appUrl, base.passport),
            singleUser: {
                enabled: singleUserEnabled,
                email: singleUserEmail ?? ''
            }
        };
    }
);

export function getGoogleSignInProvider() {
    return resolveGoogleSignInProvider({
        mode: webConfig.googleSignInMode,
        googleClientId: webConfig.google.clientId,
        googleClientSecret: webConfig.google.clientSecret,
        passportBaseUrl: webConfig.passport.baseUrl,
        passportProject: webConfig.passport.project,
        passportEnvironment: webConfig.passport.environment
    });
}

const PLACEHOLDER_SECRET = 'change-me-in-production-min32chars';

/**
 * Reads and validates the Auth.js signing secret at call time.
 *
 * Auth.js expects this value when the auth module is initialized, but parsing it
 * lazily keeps tests and routes that do not touch auth from requiring a secret.
 */
export function getNextAuthSecret(): string {
    const { nextAuthSecret } = parseEnv({
        nextAuthSecret: env(
            'NEXTAUTH_SECRET',
            string().minLength(32).optional()
        )
    });

    if (webConfig.singleUser.enabled && !nextAuthSecret) {
        return getWebApiServiceSecret();
    }

    if (!nextAuthSecret) {
        throw new Error('NEXTAUTH_SECRET is required.');
    }

    if (
        webConfig.nodeEnv === 'production' &&
        nextAuthSecret === PLACEHOLDER_SECRET
    ) {
        throw new Error(
            'Refusing to start with placeholder production secret: NEXTAUTH_SECRET'
        );
    }

    return nextAuthSecret;
}

/**
 * Reads the private shared secret used by trusted web-to-API session refreshes.
 */
export function getWebApiServiceSecret(): string {
    const { webApiServiceSecret } = parseEnv({
        webApiServiceSecret: env(
            'WEB_API_SERVICE_SECRET',
            string().minLength(32)
        )
    });

    if (
        webConfig.nodeEnv === 'production' &&
        webApiServiceSecret === PLACEHOLDER_SECRET
    ) {
        throw new Error(
            'Refusing to start with placeholder production secret: WEB_API_SERVICE_SECRET'
        );
    }

    return webApiServiceSecret;
}
