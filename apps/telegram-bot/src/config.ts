import { env, parseEnv } from '@cleverbrush/env';
import { string } from '@cleverbrush/schema';

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
        string().minLength(32).default('change-me-in-production-min32chars')
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

export type BotConfig = typeof botConfig;
