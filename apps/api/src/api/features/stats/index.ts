import { budgetAccessErrors } from '../../errors/budget-access.js';
import { categoryTrendErrors } from './errors.js';
import { categoryTrendHandler } from './handlers/category-trend.js';
import { statsOverviewHandler } from './handlers/overview.js';
import { statsTagReportHandler } from './handlers/tags.js';
import { statsWindowHandler } from './handlers/window.js';
import { statsScope } from './scope.js';

/** Bind stats handlers once; the root verifies complete contract coverage. */
export const statsModule = statsScope.withHandlers({
    overview: { handler: statsOverviewHandler, errors: budgetAccessErrors },
    window: { handler: statsWindowHandler, errors: budgetAccessErrors },
    tags: { handler: statsTagReportHandler, errors: budgetAccessErrors },
    categoryTrend: {
        handler: categoryTrendHandler,
        errors: categoryTrendErrors
    }
});
