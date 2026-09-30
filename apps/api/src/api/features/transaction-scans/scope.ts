import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { ConfigToken, DbToken } from '../../../di/tokens.js';

/** Server-only configuration for the shared transactionScans contract. */
export const transactionScansScope = implement(api).group('transactionScans', {
    tags: ['transaction-scans'],
    operations: {
        create: {
            operationId: 'createTransactionScan',
            description:
                'Extracts draft transactions from an uploaded receipt, invoice, bank app screenshot, or statement image.',
            summary: 'Scan transaction image',
            inject: { db: DbToken, config: ConfigToken }
        },
        start: {
            operationId: 'startTransactionScanJob',
            description:
                'Starts an asynchronous multimodal scan job and returns a short-lived progress token.',
            summary: 'Start transaction image scan',
            inject: { db: DbToken, config: ConfigToken }
        },
        progress: {
            operationId: 'transactionScanProgress',
            description:
                'Streams progress and the final scan result for a short-lived scan job token.',
            summary: 'Transaction image scan progress'
        },
        status: {
            operationId: 'transactionScanJobStatus',
            description:
                'Returns the latest progress event for a short-lived scan job token.',
            summary: 'Transaction image scan job status'
        },
        decide: {
            operationId: 'decideTransactionScanItem',
            description:
                'Records whether a scanned draft was confirmed or discarded, including user corrections for future scans.',
            summary: 'Record transaction scan decision',
            inject: { db: DbToken }
        }
    }
});
