import type { Handler } from '@cleverbrush/server';
import { statsTagReport } from '../../../../application/transactions.js';
import type { statsScope } from '../scope.js';

/** Tag report. */
export const statsTagReportHandler: Handler<
    typeof statsScope.endpoints.tags
> = async ({ query, principal }, { db }) => {
    return await statsTagReport(db, principal.userId, query);
};
