import { ActionResult, type Handler } from '@cleverbrush/server';
import { deleteBudget } from '../../../../application/budgets.js';
import type { budgetsScope } from '../scope.js';

/** Delete budget. */
export const deleteBudgetHandler: Handler<
    typeof budgetsScope.endpoints.delete
> = async ({ params, principal }, { db }) => {
    await deleteBudget(db, principal.userId, params.id);
    return ActionResult.noContent();
};
