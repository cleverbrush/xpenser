import { parameter, query } from '@cleverbrush/knex-schema';
import {
    type AppDb,
    BudgetDbSchema,
    BudgetMemberDbSchema
} from '../db/schemas.js';
import { perConnection } from './read-models.js';

/** Cache query plans, never membership or permission results. */
export const budgetAccessReads = perConnection(knex => ({
    budget: query(knex, BudgetDbSchema)
        .where(row => row.id, parameter('budgetId'))
        .limit(1),
    member: query(knex, BudgetMemberDbSchema.omit(['budget', 'user']))
        .where(row => row.budgetId, parameter('budgetId'))
        .where(row => row.userId, parameter('userId'))
        .limit(1)
}));

export async function readBudgetAccess(
    db: AppDb,
    budgetId: number,
    userId: number
) {
    const reads = budgetAccessReads(db.knex);
    const [[budget], [member]] = await Promise.all([
        reads.budget(budgetId),
        reads.member(budgetId, userId)
    ]);
    return { budget, member };
}
