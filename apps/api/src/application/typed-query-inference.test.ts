import { createDb } from '@cleverbrush/orm';
import type { Knex } from 'knex';
import knexFactory from 'knex';
import { expectTypeOf, it } from 'vitest';
import { entityMap } from '../db/schemas.js';
import { budgetAccessReads } from './budget-access-reads.js';
import type { budgetMembersQuery } from './budget-queries.js';
import { apiKeyRead } from './entity-reads.js';
import type {
    scanAttachmentsQuery,
    transactionListCountQuery,
    transactionListPageQuery,
    transactionTagCountsQuery
} from './transaction-queries.js';
import type { transactionTagListQuery } from './transaction-tags.js';

it('requires a connection at execution while retaining parameter and row types', () => {
    expectTypeOf(budgetAccessReads.member).parameters.toEqualTypeOf<
        [Knex, number, number]
    >();
    expectTypeOf(apiKeyRead).parameters.toEqualTypeOf<[Knex]>();
    type Key = Awaited<ReturnType<typeof apiKeyRead>>[number];
    expectTypeOf<Key['lastUsedAt']>().toEqualTypeOf<Date | null>();
    expectTypeOf<Key>().not.toBeAny();
    const invalidCalls = (knex: Knex) => {
        // @ts-expect-error Definitions require an explicit connection.
        budgetAccessReads.member(1, 2);
        // @ts-expect-error User IDs remain numeric after late binding.
        budgetAccessReads.member(knex, 1, '2');
        // @ts-expect-error Binding requires every declared parameter.
        budgetAccessReads.member.query(knex, 1);
    };
    expectTypeOf(invalidCalls).toBeFunction();
});

it('preserves projected fields, nullable joins and decoded counts', () => {
    type Row = Awaited<ReturnType<typeof transactionListPageQuery>>[number];
    expectTypeOf<Row>().not.toBeAny();
    expectTypeOf<Row['vendorName']>().toEqualTypeOf<string | null>();
    expectTypeOf<Row['categoryParentName']>().toEqualTypeOf<string | null>();
    expectTypeOf<
        Awaited<ReturnType<typeof transactionListCountQuery>>[number]['total']
    >().toEqualTypeOf<number>();
    expectTypeOf<
        Awaited<
            ReturnType<typeof transactionTagCountsQuery>
        >[number]['transactionCount']
    >().toEqualTypeOf<number>();
    type Member = Awaited<ReturnType<typeof budgetMembersQuery>>[number];
    type Attachment = Awaited<ReturnType<typeof scanAttachmentsQuery>>[number];
    expectTypeOf<
        Awaited<
            ReturnType<typeof transactionTagListQuery>
        >[number]['transactionCount']
    >().toEqualTypeOf<number>();
    // @ts-expect-error Sensitive user fields are not selected.
    expectTypeOf<Member['passwordHash']>();
    // @ts-expect-error List attachments deliberately exclude stored images.
    expectTypeOf<Attachment['imageBase64']>();
    expectTypeOf<Member['email']>().toEqualTypeOf<string>();
});

it('retains the related schema in include customization callbacks', async () => {
    const knex = knexFactory({ client: 'pg' });
    const db = createDb(knex, entityMap);
    const query = db.transactions.include(
        t => t.category,
        related => {
            // Check only the type, without executing the invalid selector.
            const invalid = () => {
                // @ts-expect-error Relation callbacks no longer accept arbitrary fields.
                related.where(category => category.misspelledName, 'Meals');
            };
            expectTypeOf(invalid).toBeFunction();
            return related.where(category => category.name, 'Meals');
        }
    );
    expectTypeOf(query).not.toBeAny();
    await knex.destroy();
});
