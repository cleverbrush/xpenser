import { query } from '@cleverbrush/knex-schema';
import { NonRetryableJobError } from '@cleverbrush/scheduler';
import {
    type TransactionScanResponse,
    TransactionScanResponseSchema
} from '@xpenser/contracts';
import {
    requireBudgetPermission,
    resolveBudgetAccess
} from '../application/budgets.js';
import { ScanRequestDbSchema } from '../db/scan-request-schema.js';
import type { AppDb } from '../db/schemas.js';
import { scanReads } from './scan-reads.js';
import { publicScanDraft } from './scan-result-mapping.js';

/** Serialize retries and atomically commit the header, drafts, and durable result link. */
export function persistScanResult(
    db: AppDb,
    request: { id: string; budgetId: number; userId: number },
    save: (transaction: AppDb) => Promise<TransactionScanResponse>,
    signal: AbortSignal
): Promise<TransactionScanResponse> {
    return db.transaction(async transaction => {
        // Knex escape hatches are confined to database timeouts and row ownership.
        await transaction.knex.raw("set local lock_timeout = '5s'");
        await transaction.knex.raw("set local statement_timeout = '15s'");
        await query(transaction.knex, ScanRequestDbSchema)
            .select(row => ({ id: row.id }))
            .where(row => row.id, request.id)
            .toKnexQuery()
            .forUpdate();
        signal.throwIfAborted();
        const locked = await transaction.scanRequests
            .where(row => row.id, request.id)
            .first();
        if (!locked)
            throw new NonRetryableJobError('Scan request is unavailable.');
        if (locked.scanId != null)
            return loadScanResult(transaction, locked.scanId, request.budgetId);
        requireBudgetPermission(
            await resolveBudgetAccess(
                transaction,
                request.userId,
                request.budgetId
            ),
            'canCreateTransactions'
        );
        const scan = await save(transaction);
        signal.throwIfAborted();
        await transaction.scanRequests
            .where(row => row.id, request.id)
            .update({ scanId: scan.scanId, imageBase64: null });
        return scan;
    });
}

/** Rehydrate the public DTO (including dates) outside the scheduler JSON boundary. */
export async function loadScanResult(
    db: AppDb,
    scanId: number,
    budgetId: number
) {
    const reads = scanReads(db.knex);
    const [scan] = await reads.result(scanId, budgetId);
    if (!scan) throw new Error('Scan result is unavailable.');
    const items = await reads.items(scanId, budgetId);
    return TransactionScanResponseSchema.parse({
        scanId,
        documentKind: scan.documentKind,
        warnings: JSON.parse(scan.warningsJson),
        drafts: items.map(item => ({
            ...publicScanDraft(item.draft),
            id: item.id
        }))
    });
}
