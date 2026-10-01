import type { SubscriptionHandler } from '@cleverbrush/server';
import type { transactionScansScope } from '../scope.js';

/** Transaction image scan progress. */
export const transactionScanProgressHandler: SubscriptionHandler<
    typeof transactionScansScope.endpoints.progress
> = async function* ({ query, signal }, { jobs }) {
    yield* jobs.subscribe(query, signal);
};
