import { describe, expect, it } from 'vitest';
import { api } from './api.js';

function authRoles(endpoint: {
    introspect(): { readonly authRoles: readonly string[] | null };
}) {
    return endpoint.introspect().authRoles;
}

describe('api contract authorization metadata', () => {
    it('keeps anonymous endpoints public', () => {
        expect(authRoles(api.auth.register)).toBeNull();
        expect(authRoles(api.auth.login)).toBeNull();
        expect(authRoles(api.auth.passportResolveUser)).toBeNull();
        expect(authRoles(api.auth.passportExchange)).toBeNull();
        expect(authRoles(api.currencies.list)).toBeNull();
        expect(authRoles(api.telegram.link)).toBeNull();
        expect(authRoles(api.telegram.token)).toBeNull();
    });

    it('marks user-scoped endpoints as authenticated', () => {
        const protectedEndpoints = [
            api.auth.me,
            api.users.updatePreferences,
            api.users.telegramStatus,
            api.users.createTelegramLinkToken,
            api.users.disconnectTelegram,
            api.users.listApiKeys,
            api.users.createApiKey,
            api.users.revokeApiKey,
            api.categories.list,
            api.categories.create,
            api.categories.update,
            api.categories.delete,
            api.transactions.list,
            api.transactions.create,
            api.transactions.update,
            api.transactions.delete,
            api.dashboard.summary,
            api.stats.overview
        ];

        for (const endpoint of protectedEndpoints) {
            expect(authRoles(endpoint)).toEqual([]);
        }
    });
});
