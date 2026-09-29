import type { Handler } from '@cleverbrush/server';
import { listBudgetMembers } from '../../../../application/budgets.js';
import type { budgetsScope } from '../scope.js';

/** List budget members. */
export const listBudgetMembersHandler: Handler<
    typeof budgetsScope.endpoints.members
> = async ({ params, principal }, { db }) => {
    return await listBudgetMembers(db, principal.userId, params.id);
};
