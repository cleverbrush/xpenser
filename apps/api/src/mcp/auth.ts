import { UnauthorizedError } from '@cleverbrush/server';
import type { Principal } from '@xpenser/contracts';
import { authenticateApiKey, parseApiKey } from '../application/api-keys.js';
import {
    authenticateMcpOAuthAccessToken,
    type McpOAuthAccessPrincipal
} from '../application/mcp-oauth.js';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';

export type McpApiKeyPrincipal = Principal & {
    readonly authType: 'api_key';
    readonly apiKeyId: number;
};

export type McpPrincipal = McpApiKeyPrincipal | McpOAuthAccessPrincipal;

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

export function isMcpPrincipal(
    principal: Principal
): principal is McpPrincipal {
    return (
        isMcpApiKeyPrincipal(principal) || principal.authType === 'mcp_oauth'
    );
}

function bearerToken(headers: Record<string, string>): string | undefined {
    const header = headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return undefined;
    }
    const token = header.slice(7).trim();
    return token || undefined;
}

function headerApiKey(headers: Record<string, string>): string | undefined {
    const value = headers['x-api-key']?.trim();
    return value || undefined;
}

export async function authenticateMcpPrincipal({
    config,
    db,
    headers
}: {
    readonly config: Config;
    readonly db: AppDb;
    readonly headers: Record<string, string>;
}): Promise<McpPrincipal | undefined> {
    const explicitApiKey = headerApiKey(headers);
    if (explicitApiKey) {
        const principal = await authenticateApiKey(db, explicitApiKey);
        return principal
            ? {
                  userId: principal.userId,
                  role: principal.role,
                  authType: 'api_key',
                  apiKeyId: principal.apiKeyId
              }
            : undefined;
    }

    const token = bearerToken(headers);
    if (!token) {
        return undefined;
    }
    if (parseApiKey(token)) {
        const principal = await authenticateApiKey(db, token);
        return principal
            ? {
                  userId: principal.userId,
                  role: principal.role,
                  authType: 'api_key',
                  apiKeyId: principal.apiKeyId
              }
            : undefined;
    }

    return authenticateMcpOAuthAccessToken(db, config, token);
}
