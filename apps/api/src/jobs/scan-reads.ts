import { parameter, query } from '@cleverbrush/knex-schema';
import { perConnection } from '../application/read-models.js';
import { ScanRequestDbSchema } from '../db/scan-request-schema.js';
import {
    TransactionScanDbSchema,
    TransactionScanItemDbSchema
} from '../db/schemas.js';

/** Progress authorization must never load the source image. */
export const scanReads = perConnection(knex => ({
    request: query(knex, ScanRequestDbSchema)
        .select(row => ({
            id: row.id,
            budgetId: row.budgetId,
            tokenHash: row.tokenHash
        }))
        .where(row => row.runId, parameter('runId'))
        .limit(1),
    result: query(knex, TransactionScanDbSchema)
        .where(row => row.id, parameter('scanId'))
        .where(row => row.budgetId, parameter('budgetId'))
        .limit(1),
    items: query(knex, TransactionScanItemDbSchema)
        .where(row => row.scanId, parameter('scanId'))
        .where(row => row.budgetId, parameter('budgetId'))
        .orderBy(row => row.id)
}));
