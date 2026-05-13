import { env, parseEnv } from '@cleverbrush/env';
import { number, string } from '@cleverbrush/schema';

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
                number().coerce().default(86_400)
            )
        },
        passport: {
            baseUrl: env(
                'PASSPORT_BASE_URL',
                string().default('https://auth.cleverbrush.com')
            ),
            project: env('PASSPORT_PROJECT', string().default('xpenser')),
            environment: env(
                'PASSPORT_ENVIRONMENT',
                string().default('production')
            ),
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
    base => ({
        db: {
            connectionString: `postgresql://${base.db.user}:${base.db.password}@${base.db.host}:${base.db.port}/${base.db.name}`
        }
    })
);

const PLACEHOLDER_SECRET = 'change-me-in-production-min32chars';

if (config.nodeEnv === 'production') {
    const placeholders: string[] = [];
    if (config.jwt.secret === PLACEHOLDER_SECRET) {
        placeholders.push('JWT_SECRET');
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
