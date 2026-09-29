import { ActionResult, type Handler } from '@cleverbrush/server';
import { getTransactionScanJobStatus } from '../../../../application/transaction-scan-jobs.js';
import type { transactionScansScope } from '../scope.js';

/** Transaction image scan job status. */
export const transactionScanJobStatusHandler: Handler<
    typeof transactionScansScope.endpoints.status
> = async ({ query }) => {
    return ActionResult.ok(getTransactionScanJobStatus(query));
};
