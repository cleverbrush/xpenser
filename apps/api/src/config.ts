import { env, parseEnv } from '@cleverbrush/env';
import { number, string } from '@cleverbrush/schema';
import { UserSessionMaxAgeSeconds } from '@xpenser/contracts/session';

/**
 * API runtime configuration parsed through `@cleverbrush/env`.
 *
 * All environment variables are validated and coerced once during startup, then
 * the computed config object is injected into Cleverbrush handlers through DI.
 * Production refuses documented placeholder secrets so example defaults cannot
 * accidentally become live deployment credentials.
 */
export const config = parseEnv(
    {
        nodeEnv: env('NODE_ENV', string().default('production')),
        app: {
            url: env('APP_URL', string().default('http://localhost:3000'))
        },
        api: {
            host: env('HOST', string().default('0.0.0.0')),
            port: env('PORT', number().coerce().default(4000)),
            publicBaseUrl: env(
                'API_BASE_URL',
                string().default('http://localhost:4000')
            )
        },
        db: {
            host: env('DB_HOST', string().default('localhost')),
            port: env('DB_PORT', number().coerce().default(5432)),
            name: env('DB_NAME', string().default('xpenser')),
            user: env('DB_USER', string().default('xpenser')),
            password: env('DB_PASSWORD', string().default('xpenser_secret'))
        },
        jwt: {
            secret: env('JWT_SECRET', string().minLength(32)),
            expiresInSeconds: env(
                'JWT_EXPIRES_IN',
                number().coerce().default(UserSessionMaxAgeSeconds)
            )
        },
        web: {
            apiServiceSecret: env(
                'WEB_API_SERVICE_SECRET',
                string().minLength(32)
            )
        },
        emailConfirmation: {
            tokenTtlSeconds: env(
                'EMAIL_VERIFICATION_TOKEN_TTL_SECONDS',
                number()
                    .coerce()
                    .default(24 * 60 * 60)
            )
        },
        passport: {
            baseUrl: env('PASSPORT_BASE_URL', string().default('')),
            project: env('PASSPORT_PROJECT', string().default('')),
            environment: env('PASSPORT_ENVIRONMENT', string().default('')),
            publicKey: env('PASSPORT_PUBLIC_KEY', string().optional())
        },
        telegram: {
            botUsername: env('TELEGRAM_BOT_USERNAME', string().optional()),
            serviceSecret: env(
                'TELEGRAM_BOT_SERVICE_SECRET',
                string().minLength(32)
            ),
            linkTokenTtlSeconds: env(
                'TELEGRAM_LINK_TOKEN_TTL_SECONDS',
                number().coerce().default(600)
            ),
            jwtExpiresInSeconds: env(
                'TELEGRAM_JWT_EXPIRES_IN',
                number().coerce().default(300)
            )
        },
        frankfurter: {
            baseUrl: env(
                'FRANKFURTER_BASE_URL',
                string().default('https://api.frankfurter.dev/v2')
            )
        },
        brandfetch: {
            apiKey: env('BRANDFETCH_API_KEY', string().optional()),
            clientId: env('BRANDFETCH_CLIENT_ID', string().optional()),
            vendorEnrichmentEnabled: env(
                'VENDOR_ENRICHMENT_ENABLED',
                string().default('0')
            ),
            vendorEnrichmentTimeoutMs: env(
                'VENDOR_ENRICHMENT_TIMEOUT_MS',
                number().coerce().default(2000)
            )
        },
        openai: {
            apiKey: env('OPENAI_API_KEY', string().optional()),
            reportModel: env(
                'OPENAI_REPORT_MODEL',
                string().default('gpt-5-mini')
            ),
            transactionScanModel: env(
                'OPENAI_TRANSACTION_SCAN_MODEL',
                string().default('gpt-5.5')
            )
        },
        resend: {
            apiKey: env('RESEND_API_KEY', string().optional()),
            emailFrom: env(
                'EMAIL_FROM',
                string().default('Xpenser <reports@xpenser.app>')
            )
        },
        emailReportsEnv: {
            enabled: env('EMAIL_REPORTS_ENABLED', string().default('0')),
            schedulerEnabled: env(
                'EMAIL_REPORTS_SCHEDULER_ENABLED',
                string().default('0')
            ),
            deliveryHourLocal: env(
                'EMAIL_REPORTS_DELIVERY_HOUR_LOCAL',
                number().coerce().default(8)
            ),
            maxAttempts: env(
                'EMAIL_REPORTS_MAX_ATTEMPTS',
                number().coerce().default(3)
            )
        },
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
        )
    },
    base => {
        const enabled = ['1', 'true', 'yes'].includes(
            base.emailReportsEnv.enabled.toLowerCase()
        );
        const schedulerEnabled = ['1', 'true', 'yes'].includes(
            base.emailReportsEnv.schedulerEnabled.toLowerCase()
        );

        return {
            db: {
                connectionString: `postgresql://${base.db.user}:${base.db.password}@${base.db.host}:${base.db.port}/${base.db.name}`
            },
            emailReports: {
                enabled,
                schedulerEnabled,
                deliveryHourLocal: base.emailReportsEnv.deliveryHourLocal,
                maxAttempts: base.emailReportsEnv.maxAttempts
            },
            vendorEnrichment: {
                enabled:
                    ['1', 'true', 'yes'].includes(
                        base.brandfetch.vendorEnrichmentEnabled.toLowerCase()
                    ) && Boolean(base.brandfetch.apiKey),
                timeoutMs: base.brandfetch.vendorEnrichmentTimeoutMs
            }
        };
    }
);

const PLACEHOLDER_SECRET = 'change-me-in-production-min32chars';

if (config.nodeEnv === 'production') {
    const placeholders: string[] = [];
    if (config.jwt.secret === PLACEHOLDER_SECRET) {
        placeholders.push('JWT_SECRET');
    }
    if (config.web.apiServiceSecret === PLACEHOLDER_SECRET) {
        placeholders.push('WEB_API_SERVICE_SECRET');
    }
    if (config.telegram.serviceSecret === PLACEHOLDER_SECRET) {
        placeholders.push('TELEGRAM_BOT_SERVICE_SECRET');
    }
    if (placeholders.length > 0) {
        throw new Error(
            `Refusing to start with placeholder production secrets: ${placeholders.join(', ')}`
        );
    }
}

export type Config = typeof config;
