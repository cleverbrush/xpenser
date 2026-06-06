import type { Logger } from '@cleverbrush/log';
import { useLogging } from '@cleverbrush/log';
import { tracingMiddleware } from '@cleverbrush/otel';
import {
    createServer,
    type Middleware,
    mapHandlers
} from '@cleverbrush/server';
import { createOpenApiEndpoint } from '@cleverbrush/server-openapi';
import { endpoints } from './api/endpoints.js';
import { handlers } from './api/handlers/index.js';
import type { Config } from './config.js';
import { configureDI, type DbResources } from './di/setup.js';
import { McpEndpoint, mcpHandler } from './mcp/endpoint.js';
import {
    OAuthAuthorizationServerEndpoint,
    OAuthClientRegistrationEndpoint,
    OAuthProtectedResourceEndpoint,
    OAuthProtectedResourceMcpEndpoint,
    OAuthTokenEndpoint,
    oauthAuthorizationServerHandler,
    oauthClientRegistrationHandler,
    oauthProtectedResourceHandler,
    oauthProtectedResourceMcpHandler,
    oauthTokenHandler
} from './mcp/oauth-endpoints.js';
import { xpenserAuthScheme } from './security/api-auth.js';

/**
 * CORS middleware for the public API surface.
 *
 * The allowed origin is intentionally the configured web app origin, because
 * browser traffic normally reaches the API through the Next.js app or the
 * `/external-api` proxy. Non-browser clients can still use bearer/API-key auth
 * without relying on CORS.
 */
function corsMiddleware(config: Config): Middleware {
    return async (ctx, next) => {
        ctx.response.setHeader('Access-Control-Allow-Origin', config.app.url);
        ctx.response.setHeader(
            'Access-Control-Allow-Methods',
            'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        );
        ctx.response.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, X-API-Key, Mcp-Protocol-Version, Mcp-Session-Id, traceparent, tracestate, baggage'
        );
        ctx.response.setHeader(
            'Access-Control-Expose-Headers',
            'WWW-Authenticate, Mcp-Protocol-Version, Mcp-Session-Id, X-Trace-Id, X-Response-Time'
        );
        if (ctx.method === 'OPTIONS') {
            ctx.response.writeHead(204);
            ctx.response.end();
            return;
        }
        await next();
    };
}

export function buildServer(
    config: Config,
    logger: Logger,
    resources: DbResources
) {
    const [correlationMiddleware, requestLogMiddleware] = useLogging(logger, {
        excludePaths: ['/health'],
        correlationResponseHeader: false
    });

    /**
     * Middleware order matters for the reference app:
     * tracing opens the server span first, then CORS/logging/DI/auth run inside
     * that span so logs and database spans can correlate with the request.
     */
    const server = createServer({
        maxBodySize: 20 * 1024 * 1024
    })
        .use(tracingMiddleware({ excludePaths: ['/health'] }))
        .use(corsMiddleware(config))
        .use(correlationMiddleware)
        .use(requestLogMiddleware)
        .services(services => configureDI(services, config, logger, resources))
        .useAuthentication({
            defaultScheme: 'xpenser',
            schemes: [xpenserAuthScheme(config, resources.db)]
        })
        .useAuthorization()
        .withHealthcheck()
        .useBatching();

    const openApi = createOpenApiEndpoint({
        server,
        info: {
            title: 'xpenser API',
            version: '0.1.0',
            description:
                'Schema-first income and expense tracking API built with Cleverbrush.'
        },
        servers: [
            {
                url: config.api.publicBaseUrl,
                description: 'Configured API base URL'
            }
        ],
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT or xpenser API key'
            },
            apiKey: {
                type: 'apiKey',
                in: 'header',
                name: 'X-API-Key'
            }
        }
    });

    // Register OpenAPI as a first-class endpoint. Cleverbrush middleware runs
    // after route matching, so an unmatched `/openapi.json` request would never
    // reach `serveOpenApi()`.
    server.handle(openApi.endpoint, openApi.handler);

    server.handle(
        OAuthProtectedResourceEndpoint,
        oauthProtectedResourceHandler
    );
    server.handle(
        OAuthProtectedResourceMcpEndpoint,
        oauthProtectedResourceMcpHandler
    );
    server.handle(
        OAuthAuthorizationServerEndpoint,
        oauthAuthorizationServerHandler
    );
    server.handle(
        OAuthClientRegistrationEndpoint,
        oauthClientRegistrationHandler
    );
    server.handle(OAuthTokenEndpoint, oauthTokenHandler);
    server.handle(McpEndpoint, mcpHandler);
    server.handleAll(mapHandlers(endpoints, handlers));

    return server;
}
