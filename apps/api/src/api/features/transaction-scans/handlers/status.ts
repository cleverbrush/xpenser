import { ActionResult, type Handler } from '@cleverbrush/server';
import type { transactionScansScope } from '../scope.js';

/** Transaction image scan job status. */
export const transactionScanJobStatusHandler: Handler<
    typeof transactionScansScope.endpoints.status
> = async ({ query }, { jobs }) => {
    return ActionResult.ok(await jobs.status(query));
};
