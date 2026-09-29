import type { Handler } from '@cleverbrush/server';
import { dashboardSummary } from '../../../../application/transactions.js';
import type { dashboardScope } from '../scope.js';

/** Dashboard summary. */
export const dashboardSummaryHandler: Handler<
    typeof dashboardScope.endpoints.summary
> = async ({ query, principal }, { db, config }) => {
    return await dashboardSummary(
        db,
        config,
        principal.userId,
        query.period ?? 'day',
        query.date,
        query.vendorLimit,
        query.currency,
        query.budgetId
    );
};
