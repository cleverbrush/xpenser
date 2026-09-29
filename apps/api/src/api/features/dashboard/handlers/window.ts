import type { Handler } from '@cleverbrush/server';
import { dashboardWindow } from '../../../../application/transactions.js';
import type { dashboardScope } from '../scope.js';

/** Dashboard summary window. */
export const dashboardWindowHandler: Handler<
    typeof dashboardScope.endpoints.window
> = async ({ query, principal }, { db, config }) => {
    return await dashboardWindow(db, config, principal.userId, {
        after: query.after,
        before: query.before,
        budgetId: query.budgetId,
        currency: query.currency,
        date: query.date,
        vendorLimit: query.vendorLimit,
        period: query.period ?? 'day'
    });
};
