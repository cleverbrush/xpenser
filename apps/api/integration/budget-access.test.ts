import type { Knex } from 'knex';
import { beforeAll, describe, expect, it } from 'vitest';
import { budgetAccessReads } from '../src/application/budget-access-reads.js';
import { budgetMembersRead } from '../src/application/budget-queries.js';
import {
    BudgetAccessError,
    resolveBudgetAccess
} from '../src/application/budgets.js';
import { postgresFixture, seedBudgetOwners } from './postgres-fixture.js';

const { db, knex } = postgresFixture('budget_access');
const other = postgresFixture('budget_access_other');
beforeAll(() => seedBudgetOwners(knex));
beforeAll(async () => {
    await seedBudgetOwners(other.knex);
    await other.knex('budget_members').where({ budget_id: 1 }).update({
        display_name: 'Other database'
    });
});

describe('budget access on PostgreSQL', () => {
    it('reuses templates but isolates concurrent budget/user bindings', async () => {
        const reads = budgetAccessReads;
        expect(reads.member.toSQL(knex, 1, 1).bindings).toEqual([1, 1, 1]);
        expect(reads.member.toSQL(knex, 2, 2).bindings).toEqual([2, 2, 1]);
        const rows = await Promise.all([
            reads.member(knex, 1, 1),
            reads.member(knex, 2, 2),
            reads.member(knex, 1, 2)
        ]);
        expect(rows.map(items => items.map(row => row.userId))).toEqual([
            [1],
            [2],
            []
        ]);
        expect(
            (await budgetMembersRead(knex, 1)).map(row => row.userId)
        ).toEqual([1]);
    });

    it('executes one definition against independently configured connections', async () => {
        const [first, second, again] = await Promise.all([
            budgetAccessReads.member(knex, 1, 1),
            budgetAccessReads.member(other.knex, 1, 1),
            budgetAccessReads.member(knex, 1, 1)
        ]);
        expect(first[0]?.displayName).toBe('One');
        expect(second[0]?.displayName).toBe('Other database');
        expect(again).toEqual(first);
    });

    it('observes revoked access and respects transaction-local writes and rollback', async () => {
        await resolveBudgetAccess(db, 1, 1);
        const rollback = new Error('rollback test');
        await expect(
            db.transaction(async transaction => {
                await transaction.budgetMembers
                    .where(row => row.budgetId, 1)
                    .where(row => row.userId, 1)
                    .delete();
                await expect(
                    resolveBudgetAccess(transaction, 1, 1)
                ).rejects.toBeInstanceOf(BudgetAccessError);
                // Both execution and a bound derivative use the caller's transaction.
                expect(
                    await budgetAccessReads.member(transaction.knex, 1, 1)
                ).toEqual([]);
                expect(
                    await budgetAccessReads.member
                        .query(knex, 1, 1)
                        .transacting(transaction.knex as Knex.Transaction)
                ).toEqual([]);
                throw rollback;
            })
        ).rejects.toBe(rollback);
        expect((await resolveBudgetAccess(db, 1, 1)).member.userId).toBe(1);
        await expect(resolveBudgetAccess(db, 1, 2)).rejects.toBeInstanceOf(
            BudgetAccessError
        );
    });
});
