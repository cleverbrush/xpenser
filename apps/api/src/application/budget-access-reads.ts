import { parameter, query } from '@cleverbrush/knex-schema';
import {
    type AppDb,
    BudgetDbSchema,
    BudgetMemberDbSchema
} from '../db/schemas.js';

/** Connection-independent plans; membership and permissions are always read fresh. */
export const budgetAccessReads = {
    budget: query(BudgetDbSchema)
        .where(row => row.id, parameter('budgetId'))
        .limit(1),
    member: query(BudgetMemberDbSchema.omit(['budget', 'user']))
        .where(row => row.budgetId, parameter('budgetId'))
        .where(row => row.userId, parameter('userId'))
        .limit(1)
};

export async function readBudgetAccess(
    db: AppDb,
    budgetId: number,
    userId: number
) {
    const [[budget], [member]] = await Promise.all([
        budgetAccessReads.budget(db.knex, budgetId),
        budgetAccessReads.member(db.knex, budgetId, userId)
    ]);
    return { budget, member };
}
