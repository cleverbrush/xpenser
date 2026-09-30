import type { Handler } from '@cleverbrush/server';
import { updateBudgetMember } from '../../../../application/budgets.js';
import type { budgetsScope } from '../scope.js';

/** Update budget member. */
export const updateBudgetMemberHandler: Handler<
    typeof budgetsScope.endpoints.updateMember
> = async ({ body, params, principal }, { db }) => {
    return await updateBudgetMember(
        db,
        principal.userId,
        params.budgetId,
        params.userId,
        body
    );
};
