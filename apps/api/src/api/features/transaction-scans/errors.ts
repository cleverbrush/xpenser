import { ActionResult } from '@cleverbrush/server';
import {
    TransactionScanInputError,
    TransactionScanNotFoundError
} from '../../../application/transaction-scans.js';
import { budgetAccessErrors } from '../../errors/budget-access.js';

/** Preserve the expected errors handled by transactionScans.create. */
export const createErrors = budgetAccessErrors.on(
    TransactionScanInputError,
    err => ActionResult.badRequest({ message: err.message })
);

/** Preserve the expected errors handled by transactionScans.decide. */
export const decideErrors = budgetAccessErrors
    .on(TransactionScanInputError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(TransactionScanNotFoundError, err =>
        ActionResult.notFound({ message: err.message })
    );
