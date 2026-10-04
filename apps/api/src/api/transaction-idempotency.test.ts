import { ActionResult, createServer, endpoint } from '@cleverbrush/server';
import {
    CreateTransactionBodySchema,
    TransactionIdempotencyHeadersSchema
} from '@xpenser/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as budgets from '../application/budgets.js';
import type { AppDb } from '../db/schemas.js';
import { transactionIdempotency } from './transaction-idempotency.js';

afterEach(() => vi.restoreAllMocks());
const body = {
    budgetId: 1,
    categoryId: 2,
    amount: 12,
    currency: 'USD',
    occurredAt: '2026-10-01T12:00:00Z'
};
async function fixture(
    work: (
        send: (key?: string, input?: unknown) => Promise<Response>
    ) => Promise<void>,
    limits = {},
    handler: () => unknown = () =>
        ActionResult.created({ id: 1 }, '/api/transactions/1')
) {
    vi.spyOn(budgets, 'resolveBudgetAccess').mockResolvedValue({
        budget: { id: 1 },
        permissions: { canCreateTransactions: true, canManageTags: true }
    } as never);
    const server = createServer()
        .use(async (context, next) => {
            context.principal = { userId: 1 };
            await next();
        })
        .use(transactionIdempotency({} as AppDb, limits))
        .handle(
            endpoint
                .post('/api/transactions')
                .body(CreateTransactionBodySchema)
                .headers(TransactionIdempotencyHeadersSchema),
            handler
        );
    const running = await server.listen(0, '127.0.0.1');
    const url = 'http://127.0.0.1:' + running.address!.port;
    try {
        await work((key, input = body) =>
            fetch(url + '/api/transactions', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    ...(key !== undefined ? { 'x-idempotency-key': key } : {})
                },
                body: JSON.stringify(input)
            })
        );
    } finally {
        await running.close();
    }
}
describe('transaction replay boundaries', () => {
    it('bypasses missing keys and preserves contract validation for invalid requests', async () => {
        const handler = vi.fn(() => ActionResult.created({ id: 1 }));
        await fixture(
            async send => {
                expect((await send()).status).toBe(201);
                expect((await send()).status).toBe(201);
                expect((await send('')).status).toBe(400);
                expect((await send('x'.repeat(257))).status).toBe(400);
                expect(
                    (await send('bad', { ...body, amount: -1 })).status
                ).toBe(400);
            },
            {},
            handler
        );
        expect(handler).toHaveBeenCalledTimes(2);
    });
    it('retains completed errors and treats a reused key as an assertion of the same input', async () => {
        const handler = vi.fn(() =>
            ActionResult.badRequest({ message: 'Rejected' })
        );
        await fixture(
            async send => {
                expect((await send('same')).status).toBe(400);
                expect(
                    (await send('same', { ...body, amount: 14 })).status
                ).toBe(400);
            },
            {},
            handler
        );
        expect(handler).toHaveBeenCalledOnce();
    });
    it('enforces capacity and expires completed reservations', async () => {
        let now = Date.now();
        vi.spyOn(Date, 'now').mockImplementation(() => now);
        await fixture(
            async send => {
                expect((await send('first')).status).toBe(201);
                expect((await send('second')).status).toBe(503);
                now += 11;
                expect((await send('second')).status).toBe(201);
            },
            { maxEntries: 1, ttl: 10 }
        );
    });
    it('retains an oversized successful write as a non-replayable reservation', async () => {
        const handler = vi.fn(() => ActionResult.created({ id: 1 }));
        await fixture(
            async send => {
                expect((await send('large')).status).toBe(201);
                const retry = await send('large');
                expect(retry.status).toBe(409);
                expect(retry.headers.get('content-type')).toContain(
                    'application/problem+json'
                );
            },
            { maxResponseBytes: 1 },
            handler
        );
        expect(handler).toHaveBeenCalledOnce();
    });
    it('releases thrown failures rather than claiming durable execution', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const handler = vi.fn(() => {
            throw new Error('Interrupted');
        });
        await fixture(
            async send => {
                expect((await send('error')).status).toBe(500);
                expect((await send('error')).status).toBe(500);
            },
            {},
            handler
        );
        expect(handler).toHaveBeenCalledTimes(2);
    });
});
