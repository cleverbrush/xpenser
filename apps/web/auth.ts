import { createXpenserClient } from '@xpenser/client';
import NextAuth, { type DefaultSession } from 'next-auth';
import type {} from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { webConfig } from './lib/config';

type ApiUser = {
    readonly id: string;
    readonly email: string;
    readonly role: string;
    readonly defaultCurrency: string;
    readonly hasCategories: boolean;
};

declare module 'next-auth' {
    interface Session {
        apiToken: string;
        user: ApiUser & DefaultSession['user'];
    }

    interface User {
        apiToken?: string;
        role?: string;
        defaultCurrency?: string;
        hasCategories?: boolean;
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        apiToken?: string;
        role?: string;
        defaultCurrency?: string;
        hasCategories?: boolean;
    }
}

function apiClient() {
    return createXpenserClient({ baseUrl: webConfig.apiBaseUrl });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    session: { strategy: 'jwt' },
    secret: webConfig.nextAuthSecret,
    trustHost: true,
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
                    role: response.user.role,
                    defaultCurrency: response.user.defaultCurrency,
                    hasCategories: response.user.hasCategories
                };
            }
        }),
        Google({
            clientId: webConfig.google.clientId ?? '',
            clientSecret: webConfig.google.clientSecret ?? ''
        })
    ],
    pages: {
        signIn: '/login'
    },
    callbacks: {
        async jwt({ token, user, account }) {
            if (user?.apiToken) {
                token.apiToken = user.apiToken;
                token.sub = user.id;
                token.email = user.email;
                token.role = user.role;
                token.defaultCurrency = user.defaultCurrency;
                token.hasCategories = user.hasCategories;
            }

            if (account?.provider === 'google') {
                const googleToken = account.id_token ?? account.access_token;
                if (googleToken) {
                    const response = await apiClient().auth.google({
                        body: { idToken: googleToken }
                    });
                    token.apiToken = response.token;
                    token.sub = String(response.user.id);
                    token.email = response.user.email;
                    token.role = response.user.role;
                    token.defaultCurrency = response.user.defaultCurrency;
                    token.hasCategories = response.user.hasCategories;
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
                    hasCategories: Boolean(token.hasCategories)
                }
            };
        }
    }
});
