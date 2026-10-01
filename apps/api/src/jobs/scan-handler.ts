import { withSpan } from '@cleverbrush/otel';
import { type JobHandler, NonRetryableJobError } from '@cleverbrush/scheduler';
import { TransactionScanBodySchema } from '@xpenser/contracts';
import {
    BudgetAccessError,
    BudgetNotFoundError,
    BudgetPermissionError,
    requireBudgetPermission,
    resolveBudgetAccess
} from '../application/budgets.js';
import { OpenAIConfigError } from '../application/openai.js';
import {
    scanTransactionsFromImage,
    TransactionScanInputError
} from '../application/transaction-scans.js';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import { TransactionScanJob } from './definitions.js';
import { persistScanResult } from './scan-results.js';

/** Permanent failures must not consume more AI attempts; raw provider errors never persist. */
export function scanJobError(error: unknown): Error {
    if (error instanceof TransactionScanInputError)
        return new NonRetryableJobError(error.message, 'SCAN_INPUT');
    if (error instanceof NonRetryableJobError) return error;
    if (
        error instanceof BudgetAccessError ||
        error instanceof BudgetNotFoundError ||
        error instanceof BudgetPermissionError ||
        error instanceof OpenAIConfigError
    ) {
        return new NonRetryableJobError(
            'Could not scan the image. Try again.',
            'SCAN_UNAVAILABLE'
        );
    }
    return new Error('Could not scan the image. Try again.');
}

/** Handler dependencies are application-owned; definition imports remain producer-safe. */
export function createScanHandler(
    db: AppDb,
    config: Config
): JobHandler<typeof TransactionScanJob> {
    return ({ requestId }, context) =>
        withSpan(
            'job.transaction-scan',
            async () => {
                try {
                    context.signal.throwIfAborted();
                    const request = await db.scanRequests
                        .where(row => row.id, requestId)
                        .first();
                    if (!request || request.runId !== context.runId)
                        throw new NonRetryableJobError(
                            'Scan request is unavailable.'
                        );
                    const access = await resolveBudgetAccess(
                        db,
                        request.userId,
                        request.budgetId
                    );
                    requireBudgetPermission(access, 'canCreateTransactions');
                    // A previous attempt may have committed its result before losing its lease.
                    if (request.scanId != null)
                        return { scanId: request.scanId };
                    if (!request.imageBase64)
                        throw new NonRetryableJobError(
                            'Scan image is unavailable.'
                        );
                    const body = TransactionScanBodySchema.parse({
                        budgetId: request.budgetId,
                        imageBase64: request.imageBase64,
                        mimeType: request.mimeType,
                        ...(request.fileName
                            ? { fileName: request.fileName }
                            : {})
                    });
                    const result = await scanTransactionsFromImage(
                        db,
                        config,
                        request.userId,
                        body,
                        {
                            signal: context.signal,
                            onProgress: stage => context.report({ stage }),
                            persist: save =>
                                persistScanResult(
                                    db,
                                    request,
                                    save,
                                    context.signal
                                )
                        }
                    );
                    return { scanId: result.scanId };
                } catch (error) {
                    throw scanJobError(error);
                }
            },
            {
                attributes: {
                    'job.name': TransactionScanJob.name,
                    'job.run_id': context.runId,
                    'job.attempt': context.attempt
                }
            }
        );
}
