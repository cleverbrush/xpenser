import { ActionResult, type Handler } from '@cleverbrush/server';
import { createBudget } from '../../../../application/budgets.js';
import type { budgetsScope } from '../scope.js';

/** Create budget. */
export const createBudgetHandler: Handler<
    typeof budgetsScope.endpoints.create
> = async ({ body, principal }, { db }) => {
    return ActionResult.created(await createBudget(db, principal.userId, body));
};
