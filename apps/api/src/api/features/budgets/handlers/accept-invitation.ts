import type { Handler } from '@cleverbrush/server';
import { acceptBudgetInvitation } from '../../../../application/budgets.js';
import type { budgetsScope } from '../scope.js';

/** Accept budget invitation. */
export const acceptBudgetInvitationHandler: Handler<
    typeof budgetsScope.endpoints.acceptInvitation
> = async ({ body, principal }, { db }) => {
    return await acceptBudgetInvitation(
        db,
        principal.userId,
        body.token,
        body.name
    );
};
