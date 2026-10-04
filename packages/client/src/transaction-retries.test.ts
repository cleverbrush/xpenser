import { describe, expect, it, vi } from 'vitest';
import { createXpenserClient } from './index.js';

const body = {
    budgetId: 1,
    categoryId: 2,
    amount: 12,
    currency: 'USD',
    occurredAt: new Date('2026-10-01T12:00:00Z')
};
describe('transaction creation transport', () => {
    it('reuses an automatic key after a lost response and sends creates outside batching', async () => {
        const calls: { url: string; key: string | null; body: unknown }[] = [];
        const fetcher: typeof fetch = async (url, init) => {
            calls.push({
                url: String(url),
                key: new Headers(init?.headers).get('x-idempotency-key'),
                body: init?.body
            });
            if (calls.length === 1) throw new TypeError('Response lost');
            return Response.json({ id: 4 }, { status: 201 });
        };
        const client = createXpenserClient({
            baseUrl: 'http://api.test',
            fetch: fetcher
        });
        await expect(
            client.transactions.create({
                body
            })
        ).resolves.toEqual({ id: 4 });
        expect(calls).toHaveLength(2);
        expect(calls[0]?.key).toBeTruthy();
        expect(calls[0]).toEqual(calls[1]);
        expect(calls[0]?.url).toBe('http://api.test/api/transactions/');
    });
    it('generates distinct keys for new calls and leaves other POSTs without retries or keys', async () => {
        const calls: (string | null)[] = [];
        const fetcher: typeof fetch = async (url, init) => {
            calls.push(new Headers(init?.headers).get('x-idempotency-key'));
            if (
                new URL(String(url)).pathname
                    .replace(/\/$/, '')
                    .endsWith('/api/categories')
            )
                throw new TypeError('Network failure');
            return Response.json({ id: 4 }, { status: 201 });
        };
        const client = createXpenserClient({
            baseUrl: 'http://api.test/api',
            fetch: fetcher
        });
        await client.transactions.create({ body });
        await client.transactions.create({ body });
        await expect(
            client.categories.create({
                body: { name: 'Food', type: 'expense' }
            })
        ).rejects.toThrow('Network request failed');
        expect(calls).toHaveLength(3);
        expect(calls[0]).toBeTruthy();
        expect(calls[0]).not.toBe(calls[1]);
        expect(calls[2]).toBeNull();
    });
    it('preserves a key across timeout retries and exposes 409 without retrying it', async () => {
        const keys: (string | null)[] = [];
        const fetcher: typeof fetch = async (_url, init) => {
            keys.push(new Headers(init?.headers).get('x-idempotency-key'));
            if (keys.length === 1)
                return new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener(
                        'abort',
                        () => reject(new DOMException('Aborted', 'AbortError')),
                        { once: true }
                    );
                });
            return Response.json({ title: 'Check outcome' }, { status: 409 });
        };
        const client = createXpenserClient({
            baseUrl: 'http://api.test',
            fetch: fetcher,
            timeoutMs: 5
        });
        await expect(
            client.transactions.create({ body })
        ).rejects.toMatchObject({ status: 409 });
        expect(keys).toHaveLength(2);
        expect(keys[0]).toBe(keys[1]);
    });
    it('lets simultaneous identical reads consume independent response bodies', async () => {
        const fetcher = vi.fn(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return Response.json([{ code: 'USD', name: 'US Dollar' }]);
        });
        const client = createXpenserClient({
            baseUrl: 'http://api.test',
            fetch: fetcher,
            disableBatching: true
        });
        const results = await Promise.all([
            client.currencies.list(),
            client.currencies.list(),
            client.currencies.list()
        ]);
        expect(results[0]).toEqual(results[1]);
        expect(results[1]).toEqual(results[2]);
        expect(fetcher).toHaveBeenCalledOnce();
    });
});
