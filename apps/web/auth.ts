import { createXpenserClient } from '@xpenser/client';
import { UserSessionMaxAgeSeconds } from '@xpenser/contracts/session';
import NextAuth, { type DefaultSession, type NextAuthResult } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import {
    apiTokenExpiresAt,
    applyTokenResponse,
    shouldRefreshApiToken
} from './lib/api-session-token';
import { expiredSessionPath } from './lib/auth-routes';
import {
    getNextAuthSecret,
    getWebApiServiceSecret,
    webConfig
} from './lib/config';
import {
    AuthDebugLogged,
    AuthErrorLogged,
    AuthWarningLogged
} from './lib/log-templates';
import { loggerFor } from './lib/logger';
import { configureAuthPublicUrl } from './lib/public-url';

type ApiUser = {
    readonly id: string;
    readonly email: string;
    readonly role: string;
    readonly defaultCurrency: string;
    readonly timezone: string;
    readonly hasCategories: boolean;
};

declare module 'next-auth' {
    interface Session {
        apiToken: string;
        user: ApiUser & DefaultSession['user'];
    }

    interface User {
        apiToken?: string;
        apiTokenExpiresAt?: string;
        role?: string;
        defaultCurrency?: string;
        timezone?: string;
        hasCategories?: boolean;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        apiToken?: string;
        apiTokenExpiresAt?: string;
        role?: string;
        defaultCurrency?: string;
        timezone?: string;
        hasCategories?: boolean;
    }
}

function apiClient() {
    return createXpenserClient({ baseUrl: webConfig.apiBaseUrl });
}

function internalApiClient() {
    return createXpenserClient({
        baseUrl: webConfig.apiBaseUrl,
        headers: {
            'X-Xpenser-Web-Secret': getWebApiServiceSecret()
        }
    });
}

configureAuthPublicUrl();

const authLogger = loggerFor('Auth.js');

function authErrorType(error: Error): string {
    const typedError = error as Error & { readonly type?: unknown };
    return typeof typedError.type === 'string' ? typedError.type : error.name;
}

function apiErrorStatus(err: unknown): number | undefined {
    return typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof err.status === 'number'
        ? err.status
        : undefined;
}

async function refreshApiToken(token: JWT): Promise<JWT> {
    const userId = Number(token.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
        token.apiToken = undefined;
        token.apiTokenExpiresAt = undefined;
        return token;
    }

    const response = await internalApiClient().auth.sessionToken({
        body: { userId }
    });
    return applyTokenResponse(token, response);
}

const nextAuth: NextAuthResult = NextAuth(() => ({
    session: { strategy: 'jwt', maxAge: UserSessionMaxAgeSeconds },
    jwt: { maxAge: UserSessionMaxAgeSeconds },
    secret: getNextAuthSecret(),
    trustHost: true,
    logger: {
        error(error) {
            authLogger.error(error, AuthErrorLogged, {
                AuthErrorType: authErrorType(error),
                AuthErrorMessage: error.message
            });
        },
        warn(code) {
            authLogger.warn(AuthWarningLogged, {
                AuthWarningCode: code
            });
        },
        debug(message, metadata) {
            authLogger.debug(AuthDebugLogged, {
                AuthDebugMessage: message,
                AuthDebugMetadata: metadata
            });
        }
    },
    providers: [
        Credentials({
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' }
            },
            authorize: async credentials => {
                const email = String(credentials?.email ?? '');
                const password = String(credentials?.password ?? '');
                const response = await apiClient().auth.login({
                    body: { email, password }
                });

                return {
                    id: String(response.user.id),
                    email: response.user.email,
                    apiToken: response.token,
                    apiTokenExpiresAt: apiTokenExpiresAt(response.expiresAt),
                    role: response.user.role,
                    defaultCurrency: response.user.defaultCurrency,
                    timezone: response.user.timezone,
                    hasCategories: response.user.hasCategories
                };
            }
        }),
        Credentials({
            id: 'passport-code',
            name: 'Passport',
            credentials: {
                code: { label: 'Code', type: 'text' },
                codeVerifier: { label: 'Code verifier', type: 'text' }
            },
            authorize: async credentials => {
                const code = String(credentials?.code ?? '');
                const codeVerifier = String(credentials?.codeVerifier ?? '');
                const response = await apiClient().auth.passportExchange({
                    body: { code, codeVerifier }
                });

                return {
                    id: String(response.user.id),
                    email: response.user.email,
                    apiToken: response.token,
                    apiTokenExpiresAt: apiTokenExpiresAt(response.expiresAt),
                    role: response.user.role,
                    defaultCurrency: response.user.defaultCurrency,
                    timezone: response.user.timezone,
                    hasCategories: response.user.hasCategories
                };
            }
        }),
        Credentials({
            id: 'email-confirmation-token',
            name: 'Email confirmation',
            credentials: {
                token: { label: 'Token', type: 'text' }
            },
            authorize: async credentials => {
                const token = String(credentials?.token ?? '');
                const response = await apiClient().auth.confirmEmail({
                    body: { token }
                });

                return {
                    id: String(response.user.id),
                    email: response.user.email,
                    apiToken: response.token,
                    apiTokenExpiresAt: apiTokenExpiresAt(response.expiresAt),
                    role: response.user.role,
                    defaultCurrency: response.user.defaultCurrency,
                    timezone: response.user.timezone,
                    hasCategories: response.user.hasCategories
                };
            }
        })
    ],
    pages: {
        signIn: '/login',
        error: expiredSessionPath
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user?.apiToken) {
                token.apiToken = user.apiToken;
                token.apiTokenExpiresAt = user.apiTokenExpiresAt;
                token.sub = user.id;
                token.email = user.email;
                token.role = user.role;
                token.defaultCurrency = user.defaultCurrency;
                token.timezone = user.timezone;
                token.hasCategories = user.hasCategories;
            }

            if (shouldRefreshApiToken(token)) {
                try {
                    return await refreshApiToken(token);
                } catch (err) {
                    authLogger.warn(AuthWarningLogged, {
                        AuthWarningCode:
                            apiErrorStatus(err) === 401
                                ? 'ApiTokenRefreshUnauthorized'
                                : 'ApiTokenRefreshFailed'
                    });
                    if (apiErrorStatus(err) === 401) {
                        token.apiToken = undefined;
                        token.apiTokenExpiresAt = undefined;
                    }
                }
            }

            return token;
        },
        async session({ session, token }) {
            return {
                ...session,
                apiToken: token.apiToken ?? '',
                user: {
                    ...session.user,
                    id: token.sub ?? '',
                    email: token.email ?? '',
                    role: token.role ?? 'user',
                    defaultCurrency: token.defaultCurrency ?? 'USD',
                    timezone: token.timezone ?? 'UTC',
                    hasCategories: Boolean(token.hasCategories)
                }
            };
        }
    }
}));

export const handlers: NextAuthResult['handlers'] = nextAuth.handlers;
export const auth: NextAuthResult['auth'] = nextAuth.auth;
export const signIn: NextAuthResult['signIn'] = nextAuth.signIn;
export const signOut: NextAuthResult['signOut'] = nextAuth.signOut;
