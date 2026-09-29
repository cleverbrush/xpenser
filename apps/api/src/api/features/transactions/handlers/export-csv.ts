import { ActionResult, type Handler } from '@cleverbrush/server';
import { exportTransactionsCsv } from '../../../../application/transactions.js';
import type { transactionsScope } from '../scope.js';

/** Export transactions CSV. */
export const exportTransactionsCsvHandler: Handler<
    typeof transactionsScope.endpoints.exportCsv
> = async ({ query, principal }, { db, config, knex }) => {
    const exportFile = await exportTransactionsCsv(
        db,
        config,
        principal.userId,
        query,
        knex
    );
    return ActionResult.file(
        Buffer.from(exportFile.csv, 'utf8'),
        exportFile.fileName,
        'text/csv; charset=utf-8'
    );
};
