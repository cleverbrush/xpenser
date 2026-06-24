import { endpoint, type Handler } from '@cleverbrush/server';
import {
    exchangeMcpOAuthToken,
    type McpOAuthTokenRequest,
    OAuthError,
    registerMcpOAuthClient
} from '../application/mcp-oauth.js';
import { ConfigToken, DbToken } from '../di/tokens.js';

export const OAuthProtectedResourceEndpoint = endpoint
    .get('/.well-known/oauth-protected-resource')
    .inject({ config: ConfigToken })
    .summary('MCP OAuth protected resource metadata')
    .description(
        'Returns OAuth protected resource metadata for the MCP server.'
    )
    .tags('mcp')
    .operationId('mcpOAuthProtectedResource');

export const OAuthProtectedResourceMcpEndpoint = endpoint
    .get('/.well-known/oauth-protected-resource/api/mcp')
    .inject({ config: ConfigToken })
    .summary('MCP OAuth protected resource metadata')
    .description(
        'Returns OAuth protected resource metadata for the MCP server.'
    )
    .tags('mcp')
    .operationId('mcpOAuthProtectedResourceForMcp');

export const OAuthAuthorizationServerEndpoint = endpoint
    .get('/.well-known/oauth-authorization-server')
    .inject({ config: ConfigToken })
    .summary('MCP OAuth authorization server metadata')
    .description('Returns OAuth authorization server metadata for MCP clients.')
    .tags('mcp')
    .operationId('mcpOAuthAuthorizationServer');

export const OAuthClientRegistrationEndpoint = endpoint
    .post('/api/oauth/register')
    .inject({ db: DbToken })
    .summary('MCP OAuth client registration')
    .description('Registers a public MCP OAuth client using DCR.')
    .tags('mcp')
    .operationId('mcpOAuthClientRegistration');

export const OAuthTokenEndpoint = endpoint
    .post('/api/oauth/token')
    .inject({ config: ConfigToken, db: DbToken })
    .summary('MCP OAuth token')
    .description('Exchanges MCP OAuth authorization codes and refresh tokens.')
    .tags('mcp')
    .operationId('mcpOAuthToken');

type RawContext = Parameters<Handler<typeof OAuthTokenEndpoint>>[0]['context'];

function jsonResponse(
    context: RawContext,
    status: number,
    body: unknown,
    headers: Record<string, string> = {}
) {
    context.response.writeHead(status, {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
        ...headers
    });
    context.response.end(JSON.stringify(body));
    context.responded = true;
    return undefined;
}

async function readBody(context: RawContext): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of context.request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
}

async function readJsonBody(context: RawContext): Promise<unknown> {
    const raw = await readBody(context);
    if (raw.trim() === '') {
        return {};
    }
    return JSON.parse(raw) as unknown;
}

async function readTokenBody(
    context: RawContext
): Promise<McpOAuthTokenRequest> {
    const raw = await readBody(context);
    const contentType = context.headers['content-type'] ?? '';
    if (contentType.includes('application/json')) {
        return JSON.parse(raw || '{}') as McpOAuthTokenRequest;
    }

    const params = new URLSearchParams(raw);
    return {
        grant_type: params.get('grant_type') ?? undefined,
        client_id: params.get('client_id') ?? undefined,
        code: params.get('code') ?? undefined,
        redirect_uri: params.get('redirect_uri') ?? undefined,
        code_verifier: params.get('code_verifier') ?? undefined,
        refresh_token: params.get('refresh_token') ?? undefined
    };
}

function protectedResourceMetadata(appUrl: string) {
    return {
        resource: new URL('/api/mcp', appUrl).toString(),
        authorization_servers: [appUrl],
        bearer_methods_supported: ['header'],
        scopes_supported: ['mcp'],
        resource_name: 'xpenser MCP'
    };
}

export const oauthProtectedResourceHandler: Handler<
    typeof OAuthProtectedResourceEndpoint
> = async ({ context }, { config }) => {
    return jsonResponse(
        context,
        200,
        protectedResourceMetadata(config.app.url)
    );
};

export const oauthProtectedResourceMcpHandler: Handler<
    typeof OAuthProtectedResourceMcpEndpoint
> = async ({ context }, { config }) => {
    return jsonResponse(
        context,
        200,
        protectedResourceMetadata(config.app.url)
    );
};

export const oauthAuthorizationServerHandler: Handler<
    typeof OAuthAuthorizationServerEndpoint
> = async ({ context }, { config }) => {
    const appUrl = config.app.url;
    return jsonResponse(context, 200, {
        issuer: appUrl,
        authorization_endpoint: new URL(
            '/mcp/oauth/authorize',
            appUrl
        ).toString(),
        token_endpoint: new URL('/api/oauth/token', appUrl).toString(),
        registration_endpoint: new URL(
            '/api/oauth/register',
            appUrl
        ).toString(),
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['none'],
        code_challenge_methods_supported: ['S256'],
        scopes_supported: ['mcp']
    });
};

export const oauthClientRegistrationHandler: Handler<
    typeof OAuthClientRegistrationEndpoint
> = async ({ context }, { db }) => {
    try {
        const body = await readJsonBody(context);
        return jsonResponse(
            context,
            201,
            await registerMcpOAuthClient(db, body as never)
        );
    } catch (err) {
        if (err instanceof OAuthError) {
            return jsonResponse(context, err.status, {
                error: err.error,
                error_description: err.message
            });
        }
        if (err instanceof SyntaxError) {
            return jsonResponse(context, 400, {
                error: 'invalid_request',
                error_description: 'Request body must be valid JSON.'
            });
        }
        throw err;
    }
};

export const oauthTokenHandler: Handler<typeof OAuthTokenEndpoint> = async (
    { context },
    { config, db }
) => {
    try {
        const body = await readTokenBody(context);
        return jsonResponse(
            context,
            200,
            await exchangeMcpOAuthToken(db, config, body)
        );
    } catch (err) {
        if (err instanceof OAuthError) {
            return jsonResponse(context, err.status, {
                error: err.error,
                error_description: err.message
            });
        }
        if (err instanceof SyntaxError) {
            return jsonResponse(context, 400, {
                error: 'invalid_request',
                error_description: 'Request body could not be parsed.'
            });
        }
        throw err;
    }
};
