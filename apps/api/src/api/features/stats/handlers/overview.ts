import type { Handler } from '@cleverbrush/server';
import { statsOverview } from '../../../../application/transactions.js';
import type { statsScope } from '../scope.js';

/** Stats overview. */
export const statsOverviewHandler: Handler<
    typeof statsScope.endpoints.overview
> = async ({ query, principal }, { db }) => {
    return await statsOverview(db, principal.userId, query);
};
