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
beforeAll(() => seedBudgetOwners(knex));

describe('budget access on PostgreSQL', () => {
    it('reuses templates but isolates concurrent budget/user bindings', async () => {
        expect(budgetAccessReads(knex)).toBe(budgetAccessReads(knex));
        const reads = budgetAccessReads(knex);
        expect(reads.member.toSQL(1, 1).bindings).toEqual([1, 1, 1]);
        expect(reads.member.toSQL(2, 2).bindings).toEqual([2, 2, 1]);
        const rows = await Promise.all([
            reads.member(1, 1),
            reads.member(2, 2),
            reads.member(1, 2)
        ]);
        expect(rows.map(items => items.map(row => row.userId))).toEqual([
            [1],
            [2],
            []
        ]);
        expect(
            (await budgetMembersRead(knex)(1)).map(row => row.userId)
        ).toEqual([1]);
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
                // A derivative of the already-compiled template uses the same transaction.
                expect(
                    await budgetAccessReads(knex).member.transacting(
                        transaction.knex as Knex.Transaction
                    )(1, 1)
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
