import type { Handler } from '@cleverbrush/server';
import { getTransactionScanImage } from '../../../../application/transactions.js';
import type { transactionsScope } from '../scope.js';

/** Get scanned transaction image. */
export const getTransactionScanImageHandler: Handler<
    typeof transactionsScope.endpoints.scanImage
> = async ({ params, principal }, { db, knex }) => {
    return await getTransactionScanImage(db, knex, principal.userId, params.id);
};
