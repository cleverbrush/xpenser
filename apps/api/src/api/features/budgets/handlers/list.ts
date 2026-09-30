import type { Handler } from '@cleverbrush/server';
import { listBudgets } from '../../../../application/budgets.js';
import type { budgetsScope } from '../scope.js';

/** List budgets. */
export const listBudgetsHandler: Handler<
    typeof budgetsScope.endpoints.list
> = async ({ principal, query }, { db }) => {
    return listBudgets(db, principal.userId, query.status);
};
