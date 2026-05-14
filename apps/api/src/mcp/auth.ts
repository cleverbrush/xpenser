import { UnauthorizedError } from '@cleverbrush/server';
import type { Principal } from '@xpenser/contracts';

export type McpApiKeyPrincipal = Principal & {
    readonly authType: 'api_key';
    readonly apiKeyId: number;
};

export function isMcpApiKeyPrincipal(
    principal: Principal
): principal is McpApiKeyPrincipal {
    return (
        principal.authType === 'api_key' &&
        typeof principal.apiKeyId === 'number'
    );
}

export function requireMcpApiKeyPrincipal(
    principal: Principal
): McpApiKeyPrincipal {
    if (!isMcpApiKeyPrincipal(principal)) {
        throw new UnauthorizedError('MCP access requires a xpenser API key.');
    }

    return principal;
}
