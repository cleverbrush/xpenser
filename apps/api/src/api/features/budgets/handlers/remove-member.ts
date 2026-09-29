import { ActionResult, type Handler } from '@cleverbrush/server';
import { removeBudgetMember } from '../../../../application/budgets.js';
import type { budgetsScope } from '../scope.js';

/** Remove budget member. */
export const removeBudgetMemberHandler: Handler<
    typeof budgetsScope.endpoints.removeMember
> = async ({ params, principal }, { db }) => {
    await removeBudgetMember(
        db,
        principal.userId,
        params.budgetId,
        params.userId
    );
    return ActionResult.noContent();
};
