import { UnauthorizedError } from '@cleverbrush/server';
import { describe, expect, it } from 'vitest';
import { isMcpApiKeyPrincipal, requireMcpApiKeyPrincipal } from './auth.js';

describe('MCP API key principal checks', () => {
    it('accepts principals authenticated with a xpenser API key', () => {
        const principal = {
            userId: 1,
            role: 'user',
            authType: 'api_key',
            apiKeyId: 10
        } as const;

        expect(isMcpApiKeyPrincipal(principal)).toBe(true);
        expect(requireMcpApiKeyPrincipal(principal)).toBe(principal);
    });

    it('rejects JWT and missing API key principals', () => {
        expect(
            isMcpApiKeyPrincipal({
                userId: 1,
                role: 'user',
                authType: 'jwt'
            })
        ).toBe(false);

        expect(() =>
            requireMcpApiKeyPrincipal({
                userId: 1,
                role: 'user',
                authType: 'jwt'
            })
        ).toThrow(UnauthorizedError);
    });
});
