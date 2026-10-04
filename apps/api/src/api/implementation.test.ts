import { createHash } from 'node:crypto';
import { toJsonSchema } from '@cleverbrush/schema-json';
import { createServer } from '@cleverbrush/server';
import { generateOpenApiSpec } from '@cleverbrush/server-openapi';
import { api } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import {
    ConfigToken,
    DbToken,
    LoggerToken,
    ScanJobsToken
} from '../di/tokens.js';
import { buildServer } from '../server.js';
import { apiImplementation } from './implementation.js';

const server = createServer().handleAll(apiImplementation.complete());
const registrations = [
    ...server.getRegistrations(),
    ...server.getSubscriptionRegistrations()
];

function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
        return Object.fromEntries(
            Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, item]) => [key, canonical(item)])
        );
    return value;
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
    readonly parameters?: readonly unknown[];
    readonly responses?: Record<string, unknown>;
    readonly security?: ReadonlyArray<Record<string, readonly string[]>>;
};

type TestOpenApiDocument = {
    readonly info?: {
        readonly title?: string;
    };
    readonly components?: {
        readonly securitySchemes?: Record<string, unknown>;
        readonly schemas?: Record<string, unknown>;
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

describe('contract-bound API implementation', () => {
    it('registers every contract exactly once without changing wire metadata', () => {
        const entries = collectEndpointEntries(
            api as unknown as Record<string, unknown>
        );
        expect(entries).toHaveLength(69);
        expect(server.getRegistrations()).toHaveLength(68);
        expect(server.getSubscriptionRegistrations()).toHaveLength(1);
        for (const { name, endpoint } of entries) {
            const original = endpoint.introspect();
            const matches = registrations.filter(
                ({ endpoint: candidate }) =>
                    candidate.basePath === original.basePath &&
                    candidate.pathTemplate === original.pathTemplate &&
                    ('method' in candidate
                        ? candidate.method === original.method
                        : original.protocol === 'subscription')
            );
            expect(matches, name).toHaveLength(1);
            const registered = matches[0]!.endpoint;
            // Identity comparisons include schema validators and cache selectors,
            // which would disappear from a JSON snapshot.
            for (const [key, value] of Object.entries(original)) {
                if (
                    [
                        'serviceSchemas',
                        'summary',
                        'description',
                        'tags',
                        'operationId'
                    ].includes(key)
                )
                    continue;
                expect(
                    (registered as unknown as Record<string, unknown>)[key],
                    name + '.' + key
                ).toEqual(value);
            }
            expect(registered.summary, name).toBeTruthy();
            expect(registered.description, name).toBeTruthy();
            expect(registered.operationId, name).toBeTruthy();
            expect(registered.tags?.length, name).toBeGreaterThan(0);
        }
    });

    it('keeps per-operation DI isolated, including public scan operations', () => {
        const metadata = (id: string) =>
            registrations.find(r => r.endpoint.operationId === id)!.endpoint;
        expect(metadata('searchVendorCandidates').serviceSchemas).toEqual({
            config: ConfigToken
        });
        expect(metadata('listVendors').serviceSchemas).toEqual({ db: DbToken });
        expect(metadata('updateVendor').serviceSchemas).toEqual({
            db: DbToken,
            logger: LoggerToken
        });
        for (const id of [
            'transactionScanProgress',
            'transactionScanJobStatus'
        ]) {
            expect(metadata(id).serviceSchemas).toEqual({
                jobs: ScanJobsToken
            });
            expect(metadata(id).authRoles).toBeNull();
        }
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

        // Typed uploads, scan-image PUT and transaction replay headers/errors are deliberate changes.
        // Deliberate API changes should review/update this compatibility fingerprint.
        expect(
            createHash('sha256')
                .update(JSON.stringify(canonical(spec)))
                .digest('hex')
        ).toBe(
            '011d620a40ca12c8f2625bcf463dd4846081c3ee52ced82039bb51c93e35a057'
        );
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
        const creation = spec.paths['/api/transactions']?.post;
        expect(creation?.parameters).toContainEqual(
            expect.objectContaining({
                in: 'header',
                name: 'x-idempotency-key',
                schema: expect.objectContaining({
                    minLength: 1,
                    maxLength: 256
                })
            })
        );
        expect(creation?.parameters).not.toContainEqual(
            expect.objectContaining({
                name: 'x-idempotency-key',
                required: true
            })
        );
        expect(creation?.responses).toHaveProperty('409');
        expect(creation?.responses).toHaveProperty('503');
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

    it('reuses canonical components with local nullability and descriptions', () => {
        const server = buildServer(testServerConfig(), testLogger(), {
            knex: {},
            db: {}
        } as never);
        const spec = generateOpenApiSpec({
            server,
            info: { title: 'xpenser API', version: 'test' }
        }) as TestOpenApiDocument;
        const schemas = spec.components?.schemas;
        expect(schemas).toBeDefined();
        const usages = [
            [
                'TransactionScanDraft',
                'suggestedCategory',
                'TransactionScanSuggestedCategory',
                true,
                true,
                'Scanner suggestion for a category that does not exist yet.'
            ],
            [
                'TransactionScanProgressEvent',
                'scan',
                'TransactionScanResponse',
                true,
                true,
                'Final scan result when the job completed successfully.'
            ],
            [
                'TransactionScanDecisionBody',
                'correctedTransaction',
                'TransactionScanCorrectedTransaction',
                false,
                true,
                'Final user-corrected values, when confirmed.'
            ],
            [
                'StatsTagReport',
                'selectedTag',
                'StatsTagDetail',
                true,
                true,
                'Selected tag detail, when requested and present.'
            ]
        ] as const;
        for (const [
            parent,
            field,
            target,
            required,
            nullable,
            description
        ] of usages) {
            const component = schemas?.[parent] as {
                properties: Record<string, unknown>;
                required: string[];
            };
            const reference = {
                allOf: [{ $ref: `#/components/schemas/${target}` }]
            };
            expect(component.properties[field]).toEqual({
                ...(nullable
                    ? { anyOf: [reference, { type: 'null' }] }
                    : reference),
                description
            });
            expect(component.required.includes(field)).toBe(required);
            expect(schemas?.[target]).toMatchObject({ type: 'object' });
            expect(
                Object.keys(schemas ?? {}).filter(name =>
                    name.startsWith(target)
                )
            ).toEqual([target]);
        }
        // Check every emitted reference, not only the five adopted use sites.
        for (const match of JSON.stringify(spec).matchAll(
            /"\$ref":"#\/components\/schemas\/([^" ]+)"/g
        )) {
            const name = match[1]?.replaceAll('~1', '/').replaceAll('~0', '~');
            expect(schemas).toHaveProperty(name ?? '');
        }
    });

    it('keeps contract JSON schemas self-contained without a component registry', () => {
        const bodies = collectEndpointEntries(
            api as unknown as Record<string, unknown>
        )
            .map(({ endpoint }) => endpoint.introspect().bodySchema)
            .filter(Boolean);
        expect(bodies.length).toBeGreaterThan(0);
        for (const body of bodies) {
            const schema = toJsonSchema(body);
            expect(JSON.stringify(schema)).not.toContain('"$ref"');
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
