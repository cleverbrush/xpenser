import { env, parseEnv } from '@cleverbrush/env';
import { string } from '@cleverbrush/schema';

export const webConfig = parseEnv({
    nodeEnv: env('NODE_ENV', string().default('production')),
    appUrl: env('APP_URL', string().default('http://localhost:3000')),
    apiBaseUrl: env('API_BASE_URL', string().default('http://localhost:4000')),
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
    passport: {
        baseUrl: env(
            'PASSPORT_BASE_URL',
            string().default('https://auth.cleverbrush.com')
        ),
        project: env('PASSPORT_PROJECT', string().default('xpenser')),
        environment: env('PASSPORT_ENVIRONMENT', string().default('production'))
    }
});

const PLACEHOLDER_SECRET = 'change-me-in-production-min32chars';

export function getNextAuthSecret(): string {
    const { nextAuthSecret } = parseEnv({
        nextAuthSecret: env('NEXTAUTH_SECRET', string().minLength(32))
    });

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
