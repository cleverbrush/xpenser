import type { Handler } from '@cleverbrush/server';
import { updateBudget } from '../../../../application/budgets.js';
import type { budgetsScope } from '../scope.js';

/** Update budget. */
export const updateBudgetHandler: Handler<
    typeof budgetsScope.endpoints.update
> = async ({ body, params, principal }, { db }) => {
    return await updateBudget(db, principal.userId, params.id, body);
};
