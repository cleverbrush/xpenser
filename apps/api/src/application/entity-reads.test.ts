import type { InferType } from '@cleverbrush/schema';
import knexFactory from 'knex';
import { afterAll, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { apiKeyRead, userAvatarRead } from './entity-reads.js';
import { apiKeyMapping } from './mappings/api-keys.js';
import {
    type TransactionMappingSource,
    transactionMapping
} from './mappings/transactions.js';
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
    it('exposes metadata without a connection and creates independent bound readers', async () => {
        expect(Reflect.get(apiKeyRead, 'then')).toBeUndefined();
        expect(await Promise.resolve(apiKeyRead)).toBe(apiKeyRead);
        const source = apiKeyRead.rowSchema;
        const first = apiKeyRead.query(knex);
        const second = apiKeyRead.query(other);
        expect(first).not.toBe(second);
        expect(first).not.toBe(apiKeyRead.query(knex));
        expect(first.rowSchema).toBe(source);
        expect(second.rowSchema).toBe(source);
    });

    it('branches count, pagination and tenants without changing the reusable source', () => {
        const definition = transactionListRead;
        const original = definition.toSQL(knex);
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
        expect(definition.toSQL(knex)).toMatchObject({
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
            const source = apiKeyRead.rowSchema;
            expect(source.validate(row).valid).toBe(true);
            const mapped = apiKeyMapping(row);
            expect(mapped).not.toBeInstanceOf(Promise);
            expect(mapped).toEqual({ ...row, lastUsedAt: undefined });
            expect(transactionMapping).toBeTypeOf('function');
            expect(executed).not.toHaveBeenCalled();
        } finally {
            knex.off('query', executed);
        }
    });

    it('derives safe public projections and honest decoded types', () => {
        const keys = apiKeyRead.rowSchema.introspect().properties;
        expect(Object.keys(keys).sort()).toEqual([
            'createdAt',
            'id',
            'keyPrefix',
            'lastUsedAt',
            'name'
        ]);
        const avatar = userAvatarRead.rowSchema.introspect().properties;
        expect(avatar).not.toHaveProperty('passwordHash');
        expect(avatar).not.toHaveProperty('avatarImageBase64');
        type Key = InferType<typeof apiKeyRead.rowSchema>;
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
