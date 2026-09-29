import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import {
    ConfigToken,
    DbToken,
    KnexToken,
    LoggerToken
} from '../../../di/tokens.js';

/** Server-only configuration for the shared transactions contract. */
export const transactionsScope = implement(api).group('transactions', {
    inject: { db: DbToken },
    tags: ['transactions'],
    operations: {
        list: {
            operationId: 'listTransactions',
            description: 'Lists transactions owned by the authenticated user.',
            summary: 'List transactions',
            inject: { knex: KnexToken }
        },
        exportCsv: {
            operationId: 'exportTransactionsCsv',
            description:
                'Exports matching transactions to CSV with selected currency amount columns.',
            summary: 'Export transactions CSV',
            inject: { config: ConfigToken, knex: KnexToken }
        },
        create: {
            operationId: 'createTransaction',
            description:
                'Creates a transaction and stores its historical exchange rate.',
            summary: 'Create transaction',
            inject: { config: ConfigToken, logger: LoggerToken }
        },
        update: {
            operationId: 'updateTransaction',
            description:
                'Updates a transaction and recalculates converted values.',
            summary: 'Update transaction',
            inject: { config: ConfigToken }
        },
        delete: {
            operationId: 'deleteTransaction',
            description:
                'Deletes a transaction owned by the authenticated user.',
            summary: 'Delete transaction'
        },
        scanImage: {
            operationId: 'getTransactionScanImage',
            description:
                'Returns the original scanner image attached to a confirmed transaction.',
            summary: 'Get scanned transaction image',
            inject: { knex: KnexToken }
        }
    }
});
