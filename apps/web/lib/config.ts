import { env, parseEnv } from '@cleverbrush/env';
import { string } from '@cleverbrush/schema';

export const webConfig = parseEnv({
    appUrl: env('APP_URL', string().default('http://localhost:3000')),
    apiBaseUrl: env('API_BASE_URL', string().default('http://localhost:4000')),
    nextAuthSecret: env(
        'NEXTAUTH_SECRET',
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
    ),
    google: {
        clientId: env('GOOGLE_CLIENT_ID', string().optional()),
        clientSecret: env('GOOGLE_CLIENT_SECRET', string().optional())
    }
});
