import type { InferType } from '@cleverbrush/schema';
import knexFactory from 'knex';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { apiKeyRead, userAvatarRead } from './entity-reads.js';
import { apiKeyMapping } from './mappings/api-keys.js';
import {
    type TransactionMappingSource,
    transactionMapping
} from './mappings/transactions.js';
import { perConnection } from './read-models.js';
import {
    transactionListBaseQuery,
    transactionListCountQuery,
    transactionListPageQuery,
    transactionListRead
} from './transaction-queries.js';

const knex = knexFactory({ client: 'pg' });
const other = knexFactory({ client: 'pg' });
afterAll(async () => {
    await Promise.all([knex.destroy(), other.destroy()]);
});

describe('immutable read definitions', () => {
    it('reuses definitions only within the same connection', () => {
        const create = vi.fn(() => ({}));
        const prepared = perConnection(create);
        expect(prepared(knex)).toBe(prepared(knex));
        expect(prepared(other)).not.toBe(prepared(knex));
        expect(create).toHaveBeenCalledTimes(2);
        expect(apiKeyRead(knex)).toBe(apiKeyRead(knex));
        expect(apiKeyMapping(knex)).toBe(apiKeyMapping(knex));
        expect(transactionMapping(knex)).toBe(transactionMapping(knex));
    });

    it('branches count, pagination and tenants without changing the reusable source', () => {
        const definition = transactionListRead(knex);
        const original = definition.toKnexQuery().toSQL();
        const base = transactionListBaseQuery(knex, 7, {
            direction: 'asc',
            vendorId: 'none'
        });
        const before = base.toKnexQuery().toSQL();
        const page = transactionListPageQuery(base, 'asc', 5, 10);
        const count = transactionListCountQuery(base);
        expect(page.toKnexQuery().toSQL().bindings).toEqual([7, 5, 10]);
        expect(count.toKnexQuery().toSQL().bindings).toEqual([7]);
        expect(count.toQuery()).not.toMatch(/order by|limit|offset/i);
        expect(base.toKnexQuery().toSQL()).toMatchObject({
            sql: before.sql,
            bindings: before.bindings
        });
        expect(
            transactionListBaseQuery(knex, 8, { direction: 'desc' })
                .toKnexQuery()
                .toSQL().bindings
        ).toEqual([8]);
        expect(definition.toKnexQuery().toSQL()).toMatchObject({
            sql: original.sql,
            bindings: original.bindings
        });
        expect(count.rowSchema.introspect().properties).toHaveProperty('total');
        expect(page.rowSchema.introspect().properties).not.toHaveProperty(
            'total'
        );
    });

    it('prepares metadata and maps synchronously without executing SQL', () => {
        const executed = vi.fn();
        knex.on('query', executed);
        try {
            const row = {
                id: 1,
                name: 'Test',
                keyPrefix: 'xpk_test',
                createdAt: new Date(),
                lastUsedAt: null
            };
            const source = apiKeyRead(knex).rowSchema;
            expect(source.validate(row).valid).toBe(true);
            const mapped = apiKeyMapping(knex)(row);
            expect(mapped).not.toBeInstanceOf(Promise);
            expect(mapped).toEqual({ ...row, lastUsedAt: undefined });
            transactionMapping(knex);
            expect(executed).not.toHaveBeenCalled();
        } finally {
            knex.off('query', executed);
        }
    });

    it('derives safe public projections and honest decoded types', () => {
        const keys = apiKeyRead(knex).rowSchema.introspect().properties;
        expect(Object.keys(keys).sort()).toEqual([
            'createdAt',
            'id',
            'keyPrefix',
            'lastUsedAt',
            'name'
        ]);
        const avatar = userAvatarRead(knex).rowSchema.introspect().properties;
        expect(avatar).not.toHaveProperty('passwordHash');
        expect(avatar).not.toHaveProperty('avatarImageBase64');
        type Key = InferType<ReturnType<typeof apiKeyRead>['rowSchema']>;
        expectTypeOf<Key['lastUsedAt']>().toEqualTypeOf<Date | null>();
        expectTypeOf<
            TransactionMappingSource['amount']
        >().toEqualTypeOf<string>();
        expectTypeOf<
            TransactionMappingSource['exchangeRateDate']
        >().toEqualTypeOf<Date>();
        expectTypeOf<TransactionMappingSource>().not.toBeAny();
        // @ts-expect-error Secret material is not in the public read schema.
        expectTypeOf<Key['secretHash']>();
    });
});
