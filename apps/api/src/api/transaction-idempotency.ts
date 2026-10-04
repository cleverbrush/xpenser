import { idempotency, type Middleware } from '@cleverbrush/server';
import {
    type CreateTransactionBody,
    CreateTransactionBodySchema,
    TransactionIdempotencyHeadersSchema
} from '@xpenser/contracts';
import {
    BudgetAccessError,
    BudgetPermissionError,
    requireBudgetPermission,
    resolveBudgetAccess
} from '../application/budgets.js';
import type { AppDb } from '../db/schemas.js';

export const transactionBudgetItem = 'xpenser.transaction-create.budget';
const scopeItem = 'xpenser.transaction-create.replay-scope';

/** One bounded Framework replay store per server, after fresh domain authorization. */
export function transactionIdempotency(
    db: AppDb,
    limits: {
        ttl?: number;
        maxEntries?: number;
        maxResponseBytes?: number;
    } = {}
): Middleware {
    const replay = idempotency({
        ...limits,
        scope: context => context.items.get(scopeItem) as string | undefined
    });
    return async (context, next) => {
        if (
            context.method !== 'POST' ||
            context.url.pathname.replace(/\/$/, '') !== '/api/transactions' ||
            context.headers['x-idempotency-key'] === undefined
        )
            return next();
        // Let the ordinary contract pipeline report malformed headers/bodies.
        if (
            !TransactionIdempotencyHeadersSchema.validate({
                'x-idempotency-key': context.headers['x-idempotency-key']
            }).valid
        )
            return next();
        if (
            !/^application\/json(?:\s*;|$)/i.test(
                context.headers['content-type'] ?? ''
            )
        )
            return next();
        let input: unknown;
        try {
            input = await context.json();
        } catch {
            return next();
        }
        const result = CreateTransactionBodySchema.validate(
            input as CreateTransactionBody
        );
        if (!result.valid || !result.object) return next();
        const principal = context.principal as { userId: number } | undefined;
        if (!principal || !Number.isSafeInteger(principal.userId))
            return next();
        try {
            const access = await resolveBudgetAccess(
                db,
                principal.userId,
                result.object.budgetId
            );
            requireBudgetPermission(access, 'canCreateTransactions');
            if ((result.object.tags?.length ?? 0) > 0)
                requireBudgetPermission(access, 'canManageTags');
            context.items.set(transactionBudgetItem, access.budget.id);
            context.items.set(
                scopeItem,
                JSON.stringify([principal.userId, access.budget.id])
            );
        } catch (error) {
            const status =
                error instanceof BudgetPermissionError
                    ? 403
                    : error instanceof BudgetAccessError
                      ? 404
                      : undefined;
            if (!status) throw error;
            context.response.writeHead(status, {
                'content-type': 'application/json'
            });
            context.response.end(
                JSON.stringify({ message: (error as Error).message })
            );
            context.responded = true;
            return;
        }
        await replay(context, next);
    };
}
