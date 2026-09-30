import type { Handler } from '@cleverbrush/server';
import { inviteBudgetMember } from '../../../../application/budgets.js';
import type { budgetsScope } from '../scope.js';

/** Invite budget member. */
export const inviteBudgetMemberHandler: Handler<
    typeof budgetsScope.endpoints.invite
> = async ({ body, params, principal }, { db, config }) => {
    return await inviteBudgetMember(
        db,
        config,
        principal.userId,
        params.id,
        body
    );
};
