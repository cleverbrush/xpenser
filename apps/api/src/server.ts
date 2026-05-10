import { jwtScheme } from '@cleverbrush/auth';
import type { Logger } from '@cleverbrush/log';
import { useLogging } from '@cleverbrush/log';
import { tracingMiddleware } from '@cleverbrush/otel';
import {
    createServer,
    type Middleware,
    mapHandlers
} from '@cleverbrush/server';
import { serveOpenApi } from '@cleverbrush/server-openapi';
import { endpoints } from './api/endpoints.js';
import { handlers } from './api/handlers/index.js';
import type { Config } from './config.js';
import { configureDI } from './di/setup.js';

function corsMiddleware(config: Config): Middleware {
    return async (ctx, next) => {
        ctx.response.setHeader('Access-Control-Allow-Origin', config.app.url);
        ctx.response.setHeader(
            'Access-Control-Allow-Methods',
            'GET, POST, PUT, PATCH, DELETE, OPTIONS'
        );
        ctx.response.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, traceparent, tracestate, baggage'
        );
        ctx.response.setHeader(
            'Access-Control-Expose-Headers',
            'X-Trace-Id, X-Response-Time'
        );
        if (ctx.method === 'OPTIONS') {
            ctx.response.writeHead(204);
            ctx.response.end();
            return;
        }
        await next();
    };
}

export function buildServer(config: Config, logger: Logger) {
    const [correlationMiddleware, requestLogMiddleware] = useLogging(logger, {
        excludePaths: ['/health'],
        correlationResponseHeader: false
    });

    const server = createServer({
        maxBodySize: 1024 * 1024
    })
        .use(tracingMiddleware({ excludePaths: ['/health'] }))
        .use(corsMiddleware(config))
        .use(correlationMiddleware)
        .use(requestLogMiddleware)
        .services(services => configureDI(services, config, logger))
        .useAuthentication({
            defaultScheme: 'jwt',
            schemes: [
                jwtScheme({
                    secret: config.jwt.secret,
                    mapClaims: claims => ({
                        userId: Number(claims.sub),
                        role: claims.role as string
                    })
                })
            ]
        })
        .useAuthorization()
        .withHealthcheck()
        .useBatching();

    server.use(
        serveOpenApi({
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
            ]
        })
    );

    server.handleAll(mapHandlers(endpoints, handlers));

    return server;
}
