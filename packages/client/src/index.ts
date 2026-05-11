import { createClient } from '@cleverbrush/client';
import { batching } from '@cleverbrush/client/batching';
import { cacheTags } from '@cleverbrush/client/cache';
import { dedupe } from '@cleverbrush/client/dedupe';
import { retry } from '@cleverbrush/client/retry';
import { timeout } from '@cleverbrush/client/timeout';
import { clientTracingMiddleware } from '@cleverbrush/otel/client';
import { api } from '@xpenser/contracts';

export type TokenProvider = () => string | null;

export type XpenserClientOptions = {
    /** Absolute API base URL, for example http://localhost:4000. */
    readonly baseUrl: string;
    /** Returns the API JWT for authenticated requests. */
    readonly getToken?: TokenProvider;
    /** Called when the API returns 401 Unauthorized. */
    readonly onUnauthorized?: () => void;
    /** Optional headers sent with every request. */
    readonly headers?: Record<string, string>;
    /** Optional fetch implementation for server tests and Next.js fetch options. */
    readonly fetch?: typeof fetch;
};

/**
 * Creates a typed xpenser API client from the shared Cleverbrush contract.
 *
 * Use this factory from server code and Server Components. Browser components
 * should submit to Server Actions instead of calling the API directly.
 */
export function createXpenserClient(options: XpenserClientOptions) {
    return createClient(api, {
        baseUrl: options.baseUrl,
        getToken: options.getToken,
        headers: options.headers,
        onUnauthorized: options.onUnauthorized,
        fetch: options.fetch,
        middlewares: [
            clientTracingMiddleware(),
            retry({ limit: 2, retryOnTimeout: true }),
            timeout({ timeout: 10_000 }),
            dedupe(),
            cacheTags({
                defaultTtl: 5_000,
                ttlByTag: {
                    currencies: 24 * 60 * 60 * 1_000,
                    dashboard: 60_000,
                    transactions: 30_000,
                    categories: 30_000,
                    'user-profile': 30_000
                }
            }),
            batching({ maxSize: 10, windowMs: 10 })
        ]
    });
}

export type XpenserClient = ReturnType<typeof createXpenserClient>;
