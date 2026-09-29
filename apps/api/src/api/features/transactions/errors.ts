import { ActionResult } from '@cleverbrush/server';
import { TransactionTagError } from '../../../application/transaction-tags.js';
import {
    TransactionCategoryError,
    TransactionExportError,
    TransactionNotFoundError
} from '../../../application/transactions.js';
import { budgetAccessErrors } from '../../errors/budget-access.js';

/** Preserve the expected errors handled by transactions.exportCsv. */
export const exportCsvErrors = budgetAccessErrors.on(
    TransactionExportError,
    err => ActionResult.badRequest({ message: err.message })
);

/** Preserve the expected errors handled by transactions.create. */
export const createErrors = budgetAccessErrors
    .on(TransactionTagError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(TransactionCategoryError, err =>
        ActionResult.badRequest({ message: err.message })
    );

/** Preserve the expected errors handled by transactions.update. */
export const updateErrors = budgetAccessErrors
    .on(TransactionNotFoundError, err =>
        ActionResult.notFound({ message: err.message })
    )
    .on(TransactionCategoryError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(TransactionTagError, err =>
        ActionResult.badRequest({ message: err.message })
    );

/** Preserve the expected errors handled by transactions.delete. */
export const deleteErrors = budgetAccessErrors.on(
    TransactionNotFoundError,
    err => ActionResult.notFound({ message: err.message })
);
