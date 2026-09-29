import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { DbToken } from '../../../di/tokens.js';

/** Server-only configuration for the shared stats contract. */
export const statsScope = implement(api).group('stats', {
    inject: { db: DbToken },
    tags: ['stats'],
    operations: {
        overview: {
            operationId: 'statsOverview',
            description: 'Returns expense and income stats for charts.',
            summary: 'Stats overview'
        },
        window: {
            operationId: 'statsWindow',
            description:
                'Returns adjacent stats overviews for smooth navigation.',
            summary: 'Stats overview window'
        },
        tags: {
            operationId: 'statsTagReport',
            description:
                'Returns expense tag distribution and selected tag detail.',
            summary: 'Tag report'
        },
        categoryTrend: {
            operationId: 'categoryTrend',
            description:
                'Returns one category total across configurable time buckets.',
            summary: 'Category trend'
        }
    }
});
