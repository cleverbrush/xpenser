import type { Handler } from '@cleverbrush/server';
import { categoryTrend } from '../../../../application/transactions.js';
import type { statsScope } from '../scope.js';

/** Category trend. */
export const categoryTrendHandler: Handler<
    typeof statsScope.endpoints.categoryTrend
> = async ({ params, query, principal }, { db }) => {
    return await categoryTrend(db, principal.userId, params.id, query);
};
