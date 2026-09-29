import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { ConfigToken, DbToken } from '../../../di/tokens.js';

/** Server-only configuration for the shared auth contract. */
export const authScope = implement(api).group('auth', {
    inject: { db: DbToken },
    operations: {
        register: {
            operationId: 'register',
            tags: ['auth'],
            description:
                'Creates a local account and sends an email confirmation magic link.',
            summary: 'Register',
            inject: { config: ConfigToken }
        },
        login: {
            operationId: 'login',
            tags: ['auth'],
            description:
                'Authenticates a local account and returns an API JWT.',
            summary: 'Login',
            inject: { config: ConfigToken }
        },
        confirmEmail: {
            operationId: 'confirmEmail',
            tags: ['auth'],
            description:
                'Consumes an email confirmation magic link and returns an API JWT.',
            summary: 'Confirm email',
            inject: { config: ConfigToken }
        },
        resendEmailConfirmation: {
            operationId: 'resendEmailConfirmation',
            tags: ['auth'],
            description:
                'Sends a fresh email confirmation magic link when needed.',
            summary: 'Resend email confirmation',
            inject: { config: ConfigToken }
        },
        passportResolveUser: {
            operationId: 'passportResolveUser',
            tags: ['auth'],
            description:
                'Maps a Passport Google identity to a local xpenser user.',
            summary: 'Passport user resolution',
            inject: { config: ConfigToken }
        },
        passportExchange: {
            operationId: 'passportExchange',
            tags: ['auth'],
            description:
                'Exchanges a Passport authorization code for an xpenser API JWT.',
            summary: 'Passport code exchange',
            inject: { config: ConfigToken }
        },
        googleSignIn: {
            operationId: 'googleSignIn',
            tags: ['auth'],
            description:
                'Maps an Auth.js Google identity to a local xpenser user and issues an API JWT.',
            summary: 'Direct Google sign-in',
            inject: { config: ConfigToken }
        },
        sessionToken: {
            operationId: 'sessionToken',
            tags: ['auth'],
            description:
                'Issues a fresh xpenser API JWT for a trusted authenticated web session.',
            summary: 'Web session token',
            inject: { config: ConfigToken }
        },
        singleUserSessionToken: {
            operationId: 'singleUserSessionToken',
            tags: ['auth'],
            description:
                'Issues an API JWT for the configured single-user self-hosted deployment.',
            summary: 'Single-user web session token',
            inject: { config: ConfigToken }
        },
        me: {
            operationId: 'getCurrentUser',
            tags: ['users'],
            description:
                'Returns preferences, accessible budgets, and derived transaction currency ordering for the authenticated user.',
            summary: 'Current user'
        }
    }
});
