import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { ConfigToken, DbToken } from '../../../di/tokens.js';

/** Server-only configuration for the shared dashboard contract. */
export const dashboardScope = implement(api).group('dashboard', {
    inject: { db: DbToken, config: ConfigToken },
    tags: ['dashboard'],
    operations: {
        summary: {
            operationId: 'dashboardSummary',
            description: 'Returns period totals and category distributions.',
            summary: 'Dashboard summary'
        },
        window: {
            operationId: 'dashboardWindow',
            description:
                'Returns adjacent dashboard summaries for smooth navigation.',
            summary: 'Dashboard summary window'
        }
    }
});
