import { ActionResult } from '@cleverbrush/server';
import { TransactionCategoryError } from '../../../application/transactions.js';
import { budgetAccessErrors } from '../../errors/budget-access.js';

/** Preserve the expected errors handled by stats.categoryTrend. */
export const categoryTrendErrors = budgetAccessErrors.on(
    TransactionCategoryError,
    err => ActionResult.badRequest({ message: err.message })
);
