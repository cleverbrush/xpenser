import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createXpenserClient } from './index';

const middlewareMocks = vi.hoisted(() => ({
    batching: vi.fn(() => ({ name: 'batching' })),
    cacheTags: vi.fn(() => ({ name: 'cacheTags' })),
    clientTracingMiddleware: vi.fn(() => ({ name: 'tracing' })),
    createClient: vi.fn(() => ({ name: 'client' })),
    dedupe: vi.fn(() => ({ name: 'dedupe' })),
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
    cacheTags: middlewareMocks.cacheTags
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
});
