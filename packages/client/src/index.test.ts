import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createXpenserClient } from './index';

const middlewareMocks = vi.hoisted(() => ({
    batching: vi.fn(() => ({ name: 'batching' })),
    cacheTags: vi.fn(() => ({ name: 'cacheTags' })),
    clientTracingMiddleware: vi.fn(() => ({ name: 'tracing' })),
    createClient: vi.fn(() => ({ name: 'client' })),
    dedupe: vi.fn(() => ({ name: 'dedupe' })),
    externalCacheTags: vi.fn(() => ({ name: 'externalCacheTags' })),
    retry: vi.fn(() => ({ name: 'retry' })),
    timeout: vi.fn(() => ({ name: 'timeout' }))
}));

vi.mock('@cleverbrush/client', () => ({
    createClient: middlewareMocks.createClient
}));

vi.mock('@cleverbrush/client/batching', () => ({
    batching: middlewareMocks.batching
}));

vi.mock('@cleverbrush/client/cache', () => ({
    cacheTags: middlewareMocks.cacheTags,
    externalCacheTags: middlewareMocks.externalCacheTags
}));

vi.mock('@cleverbrush/client/dedupe', () => ({
    dedupe: middlewareMocks.dedupe
}));

vi.mock('@cleverbrush/client/retry', () => ({
    retry: middlewareMocks.retry
}));

vi.mock('@cleverbrush/client/timeout', () => ({
    timeout: middlewareMocks.timeout
}));

vi.mock('@cleverbrush/otel/client', () => ({
    clientTracingMiddleware: middlewareMocks.clientTracingMiddleware
}));

describe('createXpenserClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses the default request timeout and timeout retry behavior', () => {
        createXpenserClient({ baseUrl: 'http://api:4000' });

        expect(middlewareMocks.retry).toHaveBeenCalledWith({
            limit: 2,
            retryOnTimeout: true
        });
        expect(middlewareMocks.timeout).toHaveBeenCalledWith({
            timeout: 10_000
        });
    });

    it('allows long-running requests to override timeout behavior', () => {
        createXpenserClient({
            baseUrl: 'http://api:4000',
            retryOnTimeout: false,
            timeoutMs: 60_000
        });

        expect(middlewareMocks.retry).toHaveBeenCalledWith({
            limit: 2,
            retryOnTimeout: false
        });
        expect(middlewareMocks.timeout).toHaveBeenCalledWith({
            timeout: 60_000
        });
    });

    it('orders framework middlewares from tracing through cache and batching', () => {
        createXpenserClient({ baseUrl: 'http://api:4000' });

        expect(middlewareMocks.createClient).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                middlewares: [
                    { name: 'tracing' },
                    { name: 'retry' },
                    { name: 'timeout' },
                    { name: 'dedupe' },
                    { name: 'cacheTags' },
                    { name: 'batching' }
                ]
            })
        );
        expect(middlewareMocks.batching).toHaveBeenCalledWith({
            maxSize: 10,
            windowMs: 10
        });
    });

    it('skips batching when the base URL includes an API proxy path', () => {
        createXpenserClient({ baseUrl: 'http://localhost:3000/api' });

        expect(middlewareMocks.batching).not.toHaveBeenCalled();
        expect(middlewareMocks.createClient).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                middlewares: [
                    { name: 'tracing' },
                    { name: 'retry' },
                    { name: 'timeout' },
                    { name: 'dedupe' },
                    { name: 'cacheTags' }
                ]
            })
        );
    });

    it('allows callers to disable batching with an API root base URL', () => {
        createXpenserClient({
            baseUrl: 'http://api:4000',
            disableBatching: true
        });

        expect(middlewareMocks.batching).not.toHaveBeenCalled();
        expect(middlewareMocks.createClient).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                middlewares: [
                    { name: 'tracing' },
                    { name: 'retry' },
                    { name: 'timeout' },
                    { name: 'dedupe' },
                    { name: 'cacheTags' }
                ]
            })
        );
    });

    it('adds external cache tag invalidation when configured', () => {
        const invalidateCacheTag = vi.fn();

        createXpenserClient({
            baseUrl: 'http://localhost:3000/api',
            invalidateCacheTag
        });

        expect(middlewareMocks.externalCacheTags).toHaveBeenCalledWith({
            invalidateTag: invalidateCacheTag
        });
        expect(middlewareMocks.createClient).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                middlewares: [
                    { name: 'tracing' },
                    { name: 'retry' },
                    { name: 'timeout' },
                    { name: 'dedupe' },
                    { name: 'cacheTags' },
                    { name: 'externalCacheTags' }
                ]
            })
        );
    });
});
