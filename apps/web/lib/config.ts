import { env, parseEnv } from '@cleverbrush/env';
import { string } from '@cleverbrush/schema';
import { GoogleSignInModes, resolveGoogleSignInProvider } from './google-auth';

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
    }
});

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
