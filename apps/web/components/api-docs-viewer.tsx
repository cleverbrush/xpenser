'use client';

import { useEffect, useMemo, useState } from 'react';
import { openApiSpecPath } from '@/lib/public-site';

type OpenApiSpec = {
    readonly info?: {
        readonly description?: string;
        readonly title?: string;
        readonly version?: string;
    };
    readonly openapi?: string;
    readonly paths?: Record<string, PathItem>;
    readonly servers?: readonly {
        readonly description?: string;
        readonly url?: string;
    }[];
};

type PathItem = Partial<Record<HttpMethod, Operation>>;

type HttpMethod =
    | 'delete'
    | 'get'
    | 'head'
    | 'options'
    | 'patch'
    | 'post'
    | 'put'
    | 'trace';

type Operation = {
    readonly description?: string;
    readonly operationId?: string;
    readonly parameters?: readonly Parameter[];
    readonly requestBody?: RequestBody | ReferenceObject;
    readonly responses?: Record<string, ResponseObject | ReferenceObject>;
    readonly summary?: string;
    readonly tags?: readonly string[];
};

type Parameter = {
    readonly description?: string;
    readonly in?: string;
    readonly name?: string;
    readonly required?: boolean;
    readonly schema?: SchemaObject | ReferenceObject;
};

type RequestBody = {
    readonly content?: Record<string, MediaTypeObject>;
    readonly description?: string;
    readonly required?: boolean;
};

type ResponseObject = {
    readonly content?: Record<string, MediaTypeObject>;
    readonly description?: string;
};

type MediaTypeObject = {
    readonly schema?: SchemaObject | ReferenceObject;
};

type ReferenceObject = {
    readonly $ref: string;
};

type SchemaObject = {
    readonly allOf?: readonly (SchemaObject | ReferenceObject)[];
    readonly anyOf?: readonly (SchemaObject | ReferenceObject)[];
    readonly format?: string;
    readonly items?: SchemaObject | ReferenceObject;
    readonly oneOf?: readonly (SchemaObject | ReferenceObject)[];
    readonly type?: string | readonly string[];
};

type ApiOperation = {
    readonly method: HttpMethod;
    readonly operation: Operation;
    readonly path: string;
    readonly tag: string;
};

const httpMethods: readonly HttpMethod[] = [
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'head',
    'options',
    'trace'
];

const methodStyles: Record<HttpMethod, string> = {
    delete: 'border-red-200 bg-red-50 text-red-700',
    get: 'border-blue-200 bg-blue-50 text-blue-700',
    head: 'border-slate-200 bg-slate-50 text-slate-700',
    options: 'border-slate-200 bg-slate-50 text-slate-700',
    patch: 'border-amber-200 bg-amber-50 text-amber-700',
    post: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    put: 'border-violet-200 bg-violet-50 text-violet-700',
    trace: 'border-slate-200 bg-slate-50 text-slate-700'
};

function isReference(value: unknown): value is ReferenceObject {
    return (
        typeof value === 'object' &&
        value !== null &&
        '$ref' in value &&
        typeof (value as ReferenceObject).$ref === 'string'
    );
}

function schemaLabel(
    schema: SchemaObject | ReferenceObject | undefined
): string {
    if (!schema) {
        return 'No schema';
    }
    if (isReference(schema)) {
        return schema.$ref.split('/').at(-1) ?? schema.$ref;
    }
    if (schema.type === 'array') {
        return `array<${schemaLabel(schema.items)}>`;
    }
    for (const key of ['oneOf', 'anyOf', 'allOf'] as const) {
        const items = schema[key];
        if (items?.length) {
            return `${key}(${items.map(item => schemaLabel(item)).join(', ')})`;
        }
    }
    const type = Array.isArray(schema.type)
        ? schema.type.join(' | ')
        : schema.type;
    return [type, schema.format].filter(Boolean).join(':') || 'object';
}

function contentLabels(content: Record<string, MediaTypeObject> | undefined) {
    if (!content) {
        return [];
    }
    return Object.entries(content).map(([type, media]) => ({
        schema: schemaLabel(media.schema),
        type
    }));
}

function collectOperations(spec: OpenApiSpec | null): readonly ApiOperation[] {
    if (!spec?.paths) {
        return [];
    }

    return Object.entries(spec.paths).flatMap(([path, item]) =>
        httpMethods.flatMap(method => {
            const operation = item[method];
            if (!operation) {
                return [];
            }
            return [
                {
                    method,
                    operation,
                    path,
                    tag: operation.tags?.[0] ?? 'API'
                }
            ];
        })
    );
}

function operationMatches(operation: ApiOperation, filter: string): boolean {
    if (!filter) {
        return true;
    }
    const query = filter.toLowerCase();
    return [
        operation.method,
        operation.path,
        operation.tag,
        operation.operation.summary,
        operation.operation.operationId
    ]
        .filter(Boolean)
        .some(value => value?.toLowerCase().includes(query));
}

function groupedOperations(operations: readonly ApiOperation[]) {
    const groups = new Map<string, ApiOperation[]>();
    for (const operation of operations) {
        const group = groups.get(operation.tag) ?? [];
        group.push(operation);
        groups.set(operation.tag, group);
    }
    return [...groups.entries()];
}

function DetailList({
    items
}: {
    readonly items: readonly {
        readonly label: string;
        readonly value: string;
    }[];
}) {
    if (!items.length) {
        return <p className="text-sm text-muted-foreground">None.</p>;
    }
    return (
        <dl className="grid gap-2">
            {items.map(({ label, value }) => (
                <div
                    className="grid gap-1 rounded-md border bg-muted/35 p-3 sm:grid-cols-[160px_minmax(0,1fr)]"
                    key={`${label}-${value}`}
                >
                    <dt className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                        {label}
                    </dt>
                    <dd className="min-w-0 text-sm text-foreground">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

function OperationPanel({ item }: { readonly item: ApiOperation }) {
    const requestBody = isReference(item.operation.requestBody)
        ? undefined
        : item.operation.requestBody;
    const requestContent = contentLabels(requestBody?.content);
    const responses = Object.entries(item.operation.responses ?? {}).map(
        ([status, response]) => {
            if (isReference(response)) {
                return {
                    label: status,
                    value: response.$ref
                };
            }
            const content = contentLabels(response.content)
                .map(({ schema, type }) => `${type} (${schema})`)
                .join(', ');
            return {
                label: status,
                value: [response.description, content]
                    .filter(Boolean)
                    .join(' - ')
            };
        }
    );
    const parameters = (item.operation.parameters ?? []).map(parameter => ({
        label: `${parameter.name ?? 'parameter'}${parameter.in ? ` in ${parameter.in}` : ''}`,
        value: [
            parameter.required ? 'required' : 'optional',
            schemaLabel(parameter.schema),
            parameter.description
        ]
            .filter(Boolean)
            .join(' - ')
    }));

    return (
        <details
            className="group rounded-lg border bg-background shadow-sm"
            data-testid="api-operation"
        >
            <summary className="grid cursor-pointer list-none gap-3 p-4 marker:hidden sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                <span
                    className={`w-fit rounded border px-2 py-1 text-xs font-semibold uppercase tracking-normal ${methodStyles[item.method]}`}
                >
                    {item.method}
                </span>
                <span className="min-w-0">
                    <code className="block truncate text-sm font-medium">
                        {item.path}
                    </code>
                    <span className="mt-1 block text-sm text-muted-foreground">
                        {item.operation.summary ?? 'OpenAPI operation'}
                    </span>
                </span>
                {item.operation.operationId ? (
                    <code className="truncate text-xs text-muted-foreground">
                        {item.operation.operationId}
                    </code>
                ) : null}
            </summary>
            <div className="grid gap-5 border-t bg-muted/20 p-4">
                {item.operation.description ? (
                    <p className="text-sm leading-6 text-muted-foreground">
                        {item.operation.description}
                    </p>
                ) : null}
                <section>
                    <h4 className="mb-2 text-sm font-semibold">Parameters</h4>
                    <DetailList items={parameters} />
                </section>
                <section>
                    <h4 className="mb-2 text-sm font-semibold">Request body</h4>
                    <DetailList
                        items={requestContent.map(({ schema, type }) => ({
                            label: type,
                            value: [
                                requestBody?.required ? 'required' : undefined,
                                schema,
                                requestBody?.description
                            ]
                                .filter(Boolean)
                                .join(' - ')
                        }))}
                    />
                </section>
                <section>
                    <h4 className="mb-2 text-sm font-semibold">Responses</h4>
                    <DetailList items={responses} />
                </section>
            </div>
        </details>
    );
}

export function ApiDocsViewer() {
    const [filter, setFilter] = useState('');
    const [spec, setSpec] = useState<OpenApiSpec | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();

        async function loadSpec() {
            try {
                const response = await fetch(openApiSpecPath, {
                    signal: controller.signal
                });
                if (!response.ok) {
                    throw new Error(
                        `OpenAPI request failed: ${response.status}`
                    );
                }
                setSpec((await response.json()) as OpenApiSpec);
                setError(null);
            } catch (caught) {
                if (!controller.signal.aborted) {
                    setError(
                        caught instanceof Error
                            ? caught.message
                            : 'OpenAPI request failed'
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadSpec();
        return () => controller.abort();
    }, []);

    const filteredGroups = useMemo(() => {
        const operations = collectOperations(spec).filter(operation =>
            operationMatches(operation, filter)
        );
        return groupedOperations(operations);
    }, [filter, spec]);

    return (
        <div
            className="api-docs-viewer overflow-hidden rounded-lg border bg-background"
            data-testid="api-docs-viewer"
        >
            <div className="border-b bg-muted/35 p-4 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold">
                            {spec?.info?.title ?? 'OpenAPI reference'}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {spec?.openapi
                                ? `OpenAPI ${spec.openapi}`
                                : 'Generated API contract'}
                            {spec?.info?.version
                                ? ` - v${spec.info.version}`
                                : ''}
                        </p>
                    </div>
                    <label className="grid gap-1 text-sm">
                        <span className="font-medium">Filter endpoints</span>
                        <input
                            className="h-10 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                            onChange={event => setFilter(event.target.value)}
                            placeholder="transactions, mcp, stats..."
                            type="search"
                            value={filter}
                        />
                    </label>
                </div>
                {spec?.servers?.length ? (
                    <p className="mt-3 break-all text-xs text-muted-foreground">
                        Server: {spec.servers[0]?.url}
                        {spec.servers[0]?.description
                            ? ` - ${spec.servers[0].description}`
                            : ''}
                    </p>
                ) : null}
            </div>

            <div className="grid gap-5 p-4 sm:p-5">
                {loading ? (
                    <p className="text-sm text-muted-foreground">
                        Loading API reference...
                    </p>
                ) : null}
                {error ? (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                        {error}
                    </div>
                ) : null}
                {!loading && !error && filteredGroups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No endpoints match the current filter.
                    </p>
                ) : null}
                {filteredGroups.map(([tag, operations]) => (
                    <section className="grid gap-3" key={tag}>
                        <h3 className="text-base font-semibold">{tag}</h3>
                        <div className="grid gap-3">
                            {operations.map(operation => (
                                <OperationPanel
                                    item={operation}
                                    key={`${operation.method}-${operation.path}`}
                                />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
