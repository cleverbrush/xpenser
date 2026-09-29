import { budgetAccessErrors } from '../../errors/budget-access.js';
import { dashboardSummaryHandler } from './handlers/summary.js';
import { dashboardWindowHandler } from './handlers/window.js';
import { dashboardScope } from './scope.js';

/** Bind dashboard handlers once; the root verifies complete contract coverage. */
export const dashboardModule = dashboardScope.withHandlers({
    summary: { handler: dashboardSummaryHandler, errors: budgetAccessErrors },
    window: { handler: dashboardWindowHandler, errors: budgetAccessErrors }
});
