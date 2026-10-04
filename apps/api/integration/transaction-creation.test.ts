import { signJwt } from '@cleverbrush/auth';
import { createXpenserClient } from '@xpenser/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Config } from '../src/config.js';
import { buildServer } from '../src/server.js';
import { postgresFixture, seedBudgetOwners } from './postgres-fixture.js';

const { db, knex } = postgresFixture('transaction_creation');
const config = {
    app: { url: 'http://web.test' },
    api: { publicBaseUrl: 'http://api.test' },
    jwt: { secret: 'transaction-replay-test-secret-32-characters' }
} as Config;
const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    forContext: () => logger
};
let running: Awaited<ReturnType<ReturnType<typeof buildServer>['listen']>>;
let url: string;
beforeAll(async () => {
    await seedBudgetOwners(knex);
    await knex('users').where({ id: 1 }).update({ main_budget_id: 1 });
    await knex('categories').insert([
        { id: 1, user_id: 1, budget_id: 1, name: 'Food', type: 'expense' },
        { id: 2, user_id: 2, budget_id: 2, name: 'Food', type: 'expense' }
    ]);
    running = await buildServer(config, logger as never, { db, knex }).listen(
        0,
        '127.0.0.1'
    );
    url = 'http://127.0.0.1:' + running.address!.port;
});
afterAll(async () => {
    await running?.close();
});
const auth = (id = 1) =>
    'Bearer ' +
    signJwt(
        {
            sub: String(id),
            role: 'user',
            exp: Math.floor(Date.now() / 1000) + 3600
        },
        config.jwt.secret
    );
const input = {
    budgetId: 1,
    categoryId: 1,
    amount: 12.34,
    currency: 'USD',
    occurredAt: '2026-10-01T12:00:00Z'
};
const send = (key: string, body: unknown = input, user = 1) =>
    fetch(url + '/api/transactions/', {
        method: 'POST',
        headers: {
            authorization: auth(user),
            'content-type': 'application/json',
            'x-idempotency-key': key
        },
        body: JSON.stringify(body)
    });
describe('transaction creation over authenticated HTTP and PostgreSQL', () => {
    it('automatically retries a lost completed response without executing the write again', async () => {
        const before = await db.transactions.countValue();
        const attempts: {
            key: string | null;
            body: BodyInit | null | undefined;
        }[] = [];
        let completedId: number | undefined;
        const client = createXpenserClient({
            baseUrl: url,
            getToken: () => auth().slice('Bearer '.length),
            fetch: async (request, init) => {
                attempts.push({
                    key: new Headers(init?.headers).get('x-idempotency-key'),
                    body: init?.body
                });
                const response = await fetch(request, init);
                if (attempts.length === 1) {
                    expect(response.status).toBe(201);
                    completedId = (await response.json()).id;
                    throw new TypeError(
                        'Response lost after the write completed'
                    );
                }
                return response;
            }
        });
        const transaction = await client.transactions.create({
            body: { ...input, occurredAt: new Date(input.occurredAt) }
        });
        expect(attempts).toHaveLength(2);
        expect(attempts[0]?.key).toBeTruthy();
        expect(attempts[1]).toEqual(attempts[0]);
        expect(transaction.id).toBe(completedId);
        expect(await db.transactions.countValue()).toBe(before + 1);
    });
    it('coalesces concurrent saves and replays the original status, Location and transaction', async () => {
        const before = await db.transactions.countValue();
        const responses = await Promise.all(
            Array.from({ length: 5 }, () => send('concurrent'))
        );
        const values = await Promise.all(
            responses.map(response => response.json())
        );
        expect(responses.map(response => response.status)).toEqual([
            201, 201, 201, 201, 201
        ]);
        expect(new Set(values.map(value => value.id)).size).toBe(1);
        expect(
            new Set(responses.map(response => response.headers.get('location')))
                .size
        ).toBe(1);
        expect(await db.transactions.countValue()).toBe(before + 1);
        expect(await (await send('concurrent')).json()).toEqual(values[0]);
        expect((await send('new-intent')).status).toBe(201);
        expect(await db.transactions.countValue()).toBe(before + 2);
    });
    it('isolates users and budgets and resolves the omitted main budget before replay', async () => {
        const first = await (await send('tenant-key')).json();
        expect((await send('tenant-key', input, 2)).status).toBe(404);
        const second = await (
            await send(
                'tenant-key',
                { ...input, budgetId: 2, categoryId: 2 },
                2
            )
        ).json();
        expect(first.id).not.toBe(second.id);
        const { budgetId: _budget, ...defaultBudget } = input;
        expect(await (await send('tenant-key', defaultBudget)).json()).toEqual(
            first
        );
        await knex('budget_members').insert({
            budget_id: 2,
            user_id: 1,
            display_name: 'Shared',
            role: 'admin'
        });
        const otherBudget = await (
            await send('tenant-key', { ...input, budgetId: 2, categoryId: 2 })
        ).json();
        expect(otherBudget.id).not.toBe(first.id);
        expect(otherBudget.id).not.toBe(second.id);
    });
    it('reauthorizes permission, membership, archived budgets and tags before replay', async () => {
        expect((await send('revoked')).status).toBe(201);
        await knex('budget_members')
            .where({ budget_id: 1, user_id: 1 })
            .update({ role: 'member', can_create_transactions: false });
        expect((await send('revoked')).status).toBe(403);
        await knex('budget_members')
            .where({ budget_id: 1, user_id: 1 })
            .update({ can_create_transactions: true, can_manage_tags: false });
        expect(
            (await send('revoked', { ...input, tags: ['food'] })).status
        ).toBe(403);
        await knex('budgets')
            .where({ id: 1 })
            .update({ archived_at: new Date() });
        expect((await send('revoked')).status).toBe(404);
        await knex('budgets').where({ id: 1 }).update({ archived_at: null });
        await knex('budget_members')
            .where({ budget_id: 1, user_id: 1 })
            .delete();
        expect((await send('revoked')).status).toBe(404);
        await knex('budget_members').insert({
            budget_id: 1,
            user_id: 1,
            display_name: 'One',
            role: 'admin'
        });
        expect((await send('revoked')).status).toBe(201);
    });
    it('applies replay independently inside explicit batch subrequests and allows CORS keys', async () => {
        const preflight = await fetch(url + '/api/transactions/', {
            method: 'OPTIONS',
            headers: {
                origin: config.app.url,
                'access-control-request-method': 'POST',
                'access-control-request-headers':
                    'authorization,content-type,x-idempotency-key'
            }
        });
        expect(preflight.status).toBe(204);
        const item = {
            method: 'POST',
            url: '/api/transactions',
            headers: {
                authorization: auth(),
                'content-type': 'application/json',
                'x-idempotency-key': 'batch'
            },
            body: JSON.stringify(input)
        };
        const response = await fetch(url + '/__batch', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ requests: [item, item] })
        });
        const result = await response.json();
        expect(
            result.responses.map((r: { status: number }) => r.status)
        ).toEqual([201, 201]);
        expect(result.responses[0].body).toBe(result.responses[1].body);
        expect(result.responses[0].headers.location).toBe(
            result.responses[1].headers.location
        );
    });
});
