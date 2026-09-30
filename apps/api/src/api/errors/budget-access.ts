import { ActionResult, errorMap } from '@cleverbrush/server';
import {
    BudgetAccessError,
    BudgetPermissionError
} from '../../application/budgets.js';

/** Existing, application-owned budget access responses shared across features. */
export const budgetAccessErrors = errorMap()
    .on(BudgetPermissionError, err =>
        ActionResult.forbidden({ message: err.message })
    )
    .on(BudgetAccessError, err =>
        ActionResult.notFound({ message: err.message })
    );
