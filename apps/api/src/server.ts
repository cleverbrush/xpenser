import type { Logger } from '@cleverbrush/log';
import { useLogging } from '@cleverbrush/log';
import { tracingMiddleware } from '@cleverbrush/otel';
import { createServer } from '@cleverbrush/server';
import { createOpenApiEndpoint } from '@cleverbrush/server-openapi';
import { apiImplementation } from './api/implementation.js';
import type { Config } from './config.js';
import { configureDI, type DbResources } from './di/setup.js';
import type { JobRuntime } from './jobs/runtime.js';
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
import { xpenserAuthSchemes } from './security/api-auth.js';

/**
 * CORS middleware for the public API surface.
 *
 * The allowed origin is intentionally the configured web app origin, because
 * browser traffic normally reaches the API through the Next.js app or the
 * `/api` proxy. Non-browser clients can still use bearer/API-key auth
 * without relying on CORS.
 */
export function buildServer(
    config: Config,
    logger: Logger,
    resources: DbResources,
    jobs?: JobRuntime
) {
    const [correlationMiddleware, requestLogMiddleware] = useLogging(logger, {
        excludePaths: ['/health'],
        correlationResponseHeader: false
    });

    /**
     * Middleware order matters for the reference app:
     * Native CORS handles preflights before routing/authentication. For actual
     * requests, tracing opens the span before logging/DI/authentication.
     */
    const server = createServer({
        maxBodySize: 20 * 1024 * 1024
    })
        .useCors({
            origin: new URL(config.app.url).origin,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'X-API-Key',
                'X-Idempotency-Key',
                'Mcp-Protocol-Version',
                'Mcp-Session-Id',
                'traceparent',
                'tracestate',
                'baggage'
            ],
            exposedHeaders: [
                'WWW-Authenticate',
                'Mcp-Protocol-Version',
                'Mcp-Session-Id',
                'X-Trace-Id',
                'X-Response-Time'
            ],
            credentials: false
        })
        .use(tracingMiddleware({ excludePaths: ['/health'] }))
        .use(correlationMiddleware)
        .use(requestLogMiddleware)
        .services(services =>
            configureDI(services, config, logger, resources, jobs)
        )
        .useAuthentication({
            defaultScheme: 'jwt',
            trySchemes: ['api-key', 'jwt'],
            schemes: xpenserAuthSchemes(config, resources.db)
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
    server.handleAll(apiImplementation.complete());

    return server;
}
