import { generateOpenApiSpec } from '@cleverbrush/server-openapi';
import { api } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import { buildServer } from '../server.js';
import { endpoints } from './endpoints.js';
import { handlers } from './handlers/index.js';

function sortedKeys(value: object): string[] {
    return Object.keys(value).sort();
}

function collectEndpointPaths(
    value: Record<string, unknown>,
    prefix: string[] = []
): string[] {
    return Object.entries(value).flatMap(([key, item]) => {
        if (
            item &&
            typeof item === 'object' &&
            'introspect' in item &&
            typeof item.introspect === 'function'
        ) {
            return [[...prefix, key].join('.')];
        }
        return collectEndpointPaths(item as Record<string, unknown>, [
            ...prefix,
            key
        ]);
    });
}

function collectEndpointEntries(
    value: Record<string, unknown>,
    prefix: string[] = []
): Array<{ readonly name: string; readonly endpoint: { introspect(): any } }> {
    return Object.entries(value).flatMap(([key, item]) => {
        if (
            item &&
            typeof item === 'object' &&
            'introspect' in item &&
            typeof item.introspect === 'function'
        ) {
            return [
                {
                    name: [...prefix, key].join('.'),
                    endpoint: item as { introspect(): any }
                }
            ];
        }
        return collectEndpointEntries(item as Record<string, unknown>, [
            ...prefix,
            key
        ]);
    });
}

type TestOpenApiOperation = {
    readonly security?: ReadonlyArray<Record<string, readonly string[]>>;
};

type TestOpenApiDocument = {
    readonly info?: {
        readonly title?: string;
    };
    readonly components?: {
        readonly securitySchemes?: Record<string, unknown>;
    };
    readonly paths: Record<
        string,
        {
            readonly get?: TestOpenApiOperation;
            readonly post?: TestOpenApiOperation;
        }
    >;
};

function testServerConfig() {
    return {
        app: { url: 'http://localhost:3000' },
        api: {
            publicBaseUrl: 'http://localhost:4000'
        },
        jwt: { secret: 'x'.repeat(32) }
    } as never;
}

function testLogger() {
    return {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined
    } as never;
}

describe('api endpoint map', () => {
    it('mounts every implemented handler', () => {
        expect(sortedKeys(endpoints)).toEqual(sortedKeys(handlers));

        for (const section of sortedKeys(handlers)) {
            expect(
                sortedKeys(endpoints[section as keyof typeof endpoints])
            ).toEqual(sortedKeys(handlers[section as keyof typeof handlers]));
        }
    });

    it('keeps the API-local endpoint metadata tree aligned with the public contract', () => {
        expect(collectEndpointPaths(endpoints).sort()).toEqual(
            collectEndpointPaths(
                api as unknown as Record<string, unknown>
            ).sort()
        );
    });

    it('documents every registered endpoint for generated OpenAPI output', () => {
        const missingMetadata = collectEndpointEntries(endpoints).filter(
            ({ endpoint }) => {
                const meta = endpoint.introspect();
                return (
                    !meta.summary ||
                    !meta.description ||
                    !meta.operationId ||
                    !Array.isArray(meta.tags) ||
                    meta.tags.length === 0
                );
            }
        );

        expect(missingMetadata.map(entry => entry.name)).toEqual([]);
    });

    it('generates OpenAPI security schemes for both supported credential styles', () => {
        const server = buildServer(testServerConfig(), testLogger(), {
            knex: {},
            db: {}
        } as never);
        const spec = generateOpenApiSpec({
            server,
            info: { title: 'xpenser API', version: 'test' },
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
        }) as TestOpenApiDocument;

        expect(spec.components?.securitySchemes).toMatchObject({
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
        });
        expect(spec.paths['/api/auth/me']?.get?.security).toEqual([
            { bearerAuth: [] },
            { apiKey: [] }
        ]);
        expect(spec.paths['/api/auth/login']?.post?.security).toBeUndefined();
    });

    it('serves the generated OpenAPI document from the runtime server', async () => {
        const server = buildServer(testServerConfig(), testLogger(), {
            knex: {},
            db: {}
        } as never);
        const runningServer = await server.listen(0, '127.0.0.1');

        try {
            const port = runningServer.address?.port;
            expect(port).toBeTypeOf('number');

            const response = await fetch(
                `http://127.0.0.1:${port}/openapi.json`
            );
            const spec = (await response.json()) as TestOpenApiDocument;

            expect(response.status).toBe(200);
            expect(spec.info?.title).toBe('xpenser API');
            expect(spec.components?.securitySchemes).toMatchObject({
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
            });
            expect(spec.paths['/api/auth/me']?.get?.security).toEqual([
                { bearerAuth: [] },
                { apiKey: [] }
            ]);
        } finally {
            await runningServer.close();
        }
    });

    it('serves MCP OAuth discovery metadata and challenges unauthenticated MCP requests', async () => {
        const server = buildServer(testServerConfig(), testLogger(), {
            knex: {},
            db: {}
        } as never);
        const runningServer = await server.listen(0, '127.0.0.1');

        try {
            const port = runningServer.address?.port;
            expect(port).toBeTypeOf('number');

            const baseUrl = `http://127.0.0.1:${port}`;
            const authorizationServer = await fetch(
                `${baseUrl}/.well-known/oauth-authorization-server`
            );
            await expect(authorizationServer.json()).resolves.toMatchObject({
                issuer: 'http://localhost:3000',
                authorization_endpoint:
                    'http://localhost:3000/mcp/oauth/authorize',
                token_endpoint: 'http://localhost:3000/api/oauth/token',
                registration_endpoint:
                    'http://localhost:3000/api/oauth/register',
                code_challenge_methods_supported: ['S256']
            });

            const protectedResource = await fetch(
                `${baseUrl}/.well-known/oauth-protected-resource/api/mcp`
            );
            await expect(protectedResource.json()).resolves.toMatchObject({
                resource: 'http://localhost:3000/api/mcp',
                authorization_servers: ['http://localhost:3000'],
                scopes_supported: ['mcp']
            });

            const mcp = await fetch(`${baseUrl}/api/mcp`, { method: 'POST' });
            expect(mcp.status).toBe(401);
            expect(mcp.headers.get('www-authenticate')).toBe(
                'Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/api/mcp"'
            );
        } finally {
            await runningServer.close();
        }
    });
});
