import { createClient } from '@cleverbrush/client';
import { batching } from '@cleverbrush/client/batching';
import { cacheTags, externalCacheTags } from '@cleverbrush/client/cache';
import { dedupe } from '@cleverbrush/client/dedupe';
import { retry } from '@cleverbrush/client/retry';
import { timeout } from '@cleverbrush/client/timeout';
import { clientTracingMiddleware } from '@cleverbrush/otel/client';
import { api } from '@xpenser/contracts';

export type TokenProvider = () => string | null;
export type CacheTagInvalidator = (tag: string) => void | Promise<void>;

export type XpenserClientOptions = {
    /** Absolute API base URL, for example http://localhost:4000. */
    readonly baseUrl: string;
    /** Returns the API JWT or API key for authenticated requests. */
    readonly getToken?: TokenProvider;
    /** Called when the API returns 401 Unauthorized. */
    readonly onUnauthorized?: () => void;
    /** Optional headers sent with every request. */
    readonly headers?: Record<string, string>;
    /** Optional fetch implementation for server tests and Next.js fetch options. */
    readonly fetch?: typeof fetch;
    /** Request timeout in milliseconds. Defaults to 10 seconds. */
    readonly timeoutMs?: number;
    /** Whether timeout failures should be retried. Defaults to true. */
    readonly retryOnTimeout?: boolean;
    /** Optional bridge to an external cache system such as Next.js tag cache. */
    readonly invalidateCacheTag?: CacheTagInvalidator;
    /** Disable request batching for call sites that need direct API reads. */
    readonly disableBatching?: boolean;
};

function hasBasePath(baseUrl: string): boolean {
    try {
        return new URL(baseUrl).pathname.replace(/\/$/, '') !== '';
    } catch {
        return false;
    }
}

/**
 * Creates a typed xpenser API client from the shared Cleverbrush contract.
 *
 * Use this factory from server code and Server Components. Browser components
 * should submit to Server Actions instead of calling the API directly.
 *
 * The middleware stack mirrors the framework recommendations:
 * tracing propagates OTel context, retry/timeout handle transient failures,
 * dedupe and tag caching reduce repeated reads, and batching is enabled only
 * when the API base URL points at the API root. Batching is skipped for proxied
 * base paths such as `/api` because the batch endpoint is mounted at the API
 * root by `ServerBuilder.useBatching()`.
 */
export function createXpenserClient(options: XpenserClientOptions) {
    const batchingMiddleware =
        options.disableBatching || hasBasePath(options.baseUrl)
            ? []
            : [batching({ maxSize: 10, windowMs: 10 })];
    const externalCacheMiddleware = options.invalidateCacheTag
        ? [
              externalCacheTags({
                  invalidateTag: options.invalidateCacheTag
              })
          ]
        : [];

    return createClient(api, {
        baseUrl: options.baseUrl,
        getToken: options.getToken,
        headers: options.headers,
        onUnauthorized: options.onUnauthorized,
        fetch: options.fetch,
        middlewares: [
            clientTracingMiddleware(),
            retry({
                limit: 2,
                retryOnTimeout: options.retryOnTimeout ?? true
            }),
            timeout({ timeout: options.timeoutMs ?? 10_000 }),
            dedupe(),
            cacheTags({
                defaultTtl: 5_000,
                ttlByTag: {
                    currencies: 24 * 60 * 60 * 1_000,
                    dashboard: 60_000,
                    vendors: 30_000,
                    'transaction-tags': 30_000,
                    transactions: 30_000,
                    categories: 30_000,
                    'user-profile': 30_000
                }
            }),
            ...externalCacheMiddleware,
            ...batchingMiddleware
        ]
    });
}

export type XpenserClient = ReturnType<typeof createXpenserClient>;
