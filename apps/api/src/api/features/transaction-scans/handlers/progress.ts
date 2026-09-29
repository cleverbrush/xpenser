import type { SubscriptionHandler } from '@cleverbrush/server';
import { subscribeTransactionScanJob } from '../../../../application/transaction-scan-jobs.js';
import type { transactionScansScope } from '../scope.js';

/** Transaction image scan progress. */
export const transactionScanProgressHandler: SubscriptionHandler<
    typeof transactionScansScope.endpoints.progress
> = async function* ({ query, signal }) {
    yield* subscribeTransactionScanJob(query, signal);
};
