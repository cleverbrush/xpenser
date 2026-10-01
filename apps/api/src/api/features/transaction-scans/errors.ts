import { ActionResult } from '@cleverbrush/server';
import { OpenAIConfigError } from '../../../application/openai.js';
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

/** Reject unavailable scans before persisting acceptance, without exposing config details. */
export const startErrors = createErrors.on(OpenAIConfigError, () =>
    ActionResult.badRequest({ message: 'Image scanning is not configured.' })
);

/** Preserve the expected errors handled by transactionScans.decide. */
export const decideErrors = budgetAccessErrors
    .on(TransactionScanInputError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(TransactionScanNotFoundError, err =>
        ActionResult.notFound({ message: err.message })
    );
