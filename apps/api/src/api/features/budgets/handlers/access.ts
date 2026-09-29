import type { Handler } from '@cleverbrush/server';
import { listBudgetAccess } from '../../../../application/budgets.js';
import type { budgetsScope } from '../scope.js';

/** List budget access. */
export const listBudgetAccessHandler: Handler<
    typeof budgetsScope.endpoints.access
> = async ({ params, principal }, { db }) => {
    return await listBudgetAccess(db, principal.userId, params.id);
};
