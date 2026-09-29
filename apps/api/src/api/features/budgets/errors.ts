import { ActionResult, errorMap } from '@cleverbrush/server';
import {
    BudgetInvitationInvalidError,
    BudgetMemberError,
    BudgetNotFoundError
} from '../../../application/budgets.js';
import { budgetAccessErrors } from '../../errors/budget-access.js';

/** Shared budget-operation policy; invitation acceptance has a separate contract. */
export const budgetOperationErrors = budgetAccessErrors
    .on(BudgetNotFoundError, err =>
        ActionResult.notFound({ message: err.message })
    )
    .on(BudgetMemberError, err =>
        ActionResult.badRequest({ message: err.message })
    );

/** Preserve the expected errors handled by budgets.acceptInvitation. */
export const acceptInvitationErrors = errorMap().on(
    BudgetInvitationInvalidError,
    err => ActionResult.badRequest({ message: err.message })
);
