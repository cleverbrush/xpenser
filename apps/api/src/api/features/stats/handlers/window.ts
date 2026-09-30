import type { Handler } from '@cleverbrush/server';
import { statsWindow } from '../../../../application/transactions.js';
import type { statsScope } from '../scope.js';

/** Stats overview window. */
export const statsWindowHandler: Handler<
    typeof statsScope.endpoints.window
> = async ({ query, principal }, { db }) => {
    return await statsWindow(db, principal.userId, {
        after: query.after,
        before: query.before,
        budgetId: query.budgetId,
        date: query.date,
        period: query.period ?? 'day'
    });
};
