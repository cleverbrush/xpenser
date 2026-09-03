import { beforeEach, describe, expect, it, vi } from 'vitest';

type CapturedAuthConfig = {
    readonly logger: {
        readonly error: (error: Error) => void;
    };
    readonly providers: ReadonlyArray<{
        readonly authorize?: (
            credentials: Record<string, unknown>
        ) => Promise<unknown>;
        readonly id?: string;
    }>;
};

const mocks = vi.hoisted(() => ({
    authConfigFactory: undefined as (() => CapturedAuthConfig) | undefined,
    authLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    },
    confirmEmail: vi.fn(),
    createXpenserClient: vi.fn(),
    nextAuthAuth: vi.fn(),
    nextAuthSignIn: vi.fn(),
    nextAuthSignOut: vi.fn()
}));

vi.mock('next-auth', () => ({
    default: (factory: () => CapturedAuthConfig) => {
        mocks.authConfigFactory = factory;
        return {
            auth: mocks.nextAuthAuth,
            handlers: { GET: vi.fn(), POST: vi.fn() },
            signIn: mocks.nextAuthSignIn,
            signOut: mocks.nextAuthSignOut
        };
    }
}));

vi.mock('next-auth/providers/credentials', () => ({
    default: (options: Record<string, unknown>) => ({
        ...options,
        id: options.id ?? 'credentials'
    })
}));

vi.mock('next-auth/providers/google', () => ({
    default: (options: Record<string, unknown>) => options
}));

vi.mock('@xpenser/client', () => ({
    createXpenserClient: mocks.createXpenserClient
}));

vi.mock('./lib/config', () => ({
    getGoogleSignInProvider: () => 'disabled',
    getNextAuthSecret: () => 'test-secret',
    getWebApiServiceSecret: () => 'test-service-secret',
    webConfig: { apiBaseUrl: 'https://api.example.test' }
}));

vi.mock('./lib/log-templates', () => ({
    AuthDebugLogged: 'auth-debug',
    AuthErrorLogged: 'auth-error',
    AuthWarningLogged: 'auth-warning'
}));

vi.mock('./lib/logger', () => ({
    loggerFor: () => mocks.authLogger
}));

vi.mock('./lib/public-url', () => ({
    configureAuthPublicUrl: vi.fn()
}));

import './auth';

function authConfig(): CapturedAuthConfig {
    if (!mocks.authConfigFactory) {
        throw new Error('Auth.js configuration was not captured');
    }
    return mocks.authConfigFactory();
}

function emailConfirmationProvider() {
    const provider = authConfig().providers.find(
        candidate => candidate.id === 'email-confirmation-token'
    );
    if (!provider?.authorize) {
        throw new Error('Email confirmation provider was not configured');
    }
    return provider;
}

describe('email confirmation Auth.js provider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.createXpenserClient.mockReturnValue({
            auth: {
                confirmEmail: mocks.confirmEmail,
                login: vi.fn()
            }
        });
    });

    it('maps an expected API 400 to a credentials rejection', async () => {
        mocks.confirmEmail.mockRejectedValue({
            body: { message: 'Confirmation link is invalid or expired.' },
            status: 400
        });

        await expect(
            emailConfirmationProvider().authorize?.({ token: 'expired-token' })
        ).resolves.toBeNull();
        expect(mocks.confirmEmail).toHaveBeenCalledWith({
            body: { token: 'expired-token' }
        });
    });

    it('rethrows unexpected API failures', async () => {
        const failure = Object.assign(new Error('API unavailable'), {
            status: 503
        });
        mocks.confirmEmail.mockRejectedValue(failure);

        await expect(
            emailConfirmationProvider().authorize?.({ token: 'valid-token' })
        ).rejects.toBe(failure);
    });

    it('logs expected credential rejections as warnings', () => {
        const rejection = Object.assign(new Error('Credentials rejected'), {
            type: 'CredentialsSignin'
        });

        authConfig().logger.error(rejection);

        expect(mocks.authLogger.warn).toHaveBeenCalledWith('auth-warning', {
            AuthWarningCode: 'CredentialsSignin'
        });
        expect(mocks.authLogger.error).not.toHaveBeenCalled();
    });

    it('keeps unexpected Auth.js failures at error severity', () => {
        const failure = Object.assign(new Error('Callback failed'), {
            type: 'CallbackRouteError'
        });

        authConfig().logger.error(failure);

        expect(mocks.authLogger.error).toHaveBeenCalledWith(
            failure,
            'auth-error',
            {
                AuthErrorMessage: 'Callback failed',
                AuthErrorType: 'CallbackRouteError'
            }
        );
        expect(mocks.authLogger.warn).not.toHaveBeenCalled();
    });
});
