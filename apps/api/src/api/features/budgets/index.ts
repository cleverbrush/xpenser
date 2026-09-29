import { acceptInvitationErrors, budgetOperationErrors } from './errors.js';
import { acceptBudgetInvitationHandler } from './handlers/accept-invitation.js';
import { listBudgetAccessHandler } from './handlers/access.js';
import { createBudgetHandler } from './handlers/create.js';
import { deleteBudgetHandler } from './handlers/delete.js';
import { inviteBudgetMemberHandler } from './handlers/invite.js';
import { listBudgetsHandler } from './handlers/list.js';
import { listBudgetMembersHandler } from './handlers/members.js';
import { removeBudgetMemberHandler } from './handlers/remove-member.js';
import { updateBudgetHandler } from './handlers/update.js';
import { updateBudgetMemberHandler } from './handlers/update-member.js';
import { budgetsScope } from './scope.js';

/** Bind budgets handlers once; the root verifies complete contract coverage. */
export const budgetsModule = budgetsScope.withHandlers({
    list: listBudgetsHandler,
    create: { handler: createBudgetHandler, errors: budgetOperationErrors },
    update: { handler: updateBudgetHandler, errors: budgetOperationErrors },
    delete: { handler: deleteBudgetHandler, errors: budgetOperationErrors },
    members: {
        handler: listBudgetMembersHandler,
        errors: budgetOperationErrors
    },
    access: { handler: listBudgetAccessHandler, errors: budgetOperationErrors },
    invite: {
        handler: inviteBudgetMemberHandler,
        errors: budgetOperationErrors
    },
    updateMember: {
        handler: updateBudgetMemberHandler,
        errors: budgetOperationErrors
    },
    removeMember: {
        handler: removeBudgetMemberHandler,
        errors: budgetOperationErrors
    },
    acceptInvitation: {
        handler: acceptBudgetInvitationHandler,
        errors: acceptInvitationErrors
    }
});
