import { env, parseEnv } from '@cleverbrush/env';
import { string } from '@cleverbrush/schema';

const PLACEHOLDER_SECRET = 'change-me-in-production-min32chars';

/**
 * Parsed Telegram bot runtime configuration.
 *
 * The bot intentionally uses the same `@cleverbrush/env` pattern as the web
 * and API apps so required secrets, coerced values, and production guardrails
 * are enforced at startup instead of at the first Telegram update.
 */
export const botConfig = parseEnv({
    nodeEnv: env('NODE_ENV', string().default('production')),
    apiBaseUrl: env('API_BASE_URL', string().default('http://localhost:4000')),
    telegram: {
        token: env(
            'TELEGRAM_BOT_TOKEN',
            string()
                .required('TELEGRAM_BOT_TOKEN is required')
                .nonempty('TELEGRAM_BOT_TOKEN is required')
        ),
        username: env(
            'TELEGRAM_BOT_USERNAME',
            string()
                .required('TELEGRAM_BOT_USERNAME is required')
                .nonempty('TELEGRAM_BOT_USERNAME is required')
        )
    },
    serviceSecret: env(
        'TELEGRAM_BOT_SERVICE_SECRET',
        string().minLength(32).default(PLACEHOLDER_SECRET)
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
    )
});

if (
    botConfig.nodeEnv === 'production' &&
    botConfig.serviceSecret === PLACEHOLDER_SECRET
) {
    throw new Error(
        'Refusing to start with placeholder production secret: TELEGRAM_BOT_SERVICE_SECRET'
    );
}

export type BotConfig = typeof botConfig;
