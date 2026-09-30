import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { ConfigToken, DbToken, LoggerToken } from '../../../di/tokens.js';

/** Server-only configuration for the shared vendors contract. */
export const vendorsScope = implement(api).group('vendors', {
    tags: ['vendors'],
    operations: {
        searchCandidates: {
            operationId: 'searchVendorCandidates',
            description: 'Searches Brandfetch for vendor candidates.',
            summary: 'Search vendors',
            inject: { config: ConfigToken }
        },
        candidateDetails: {
            operationId: 'getVendorCandidateDetails',
            description:
                'Gets Brandfetch details for a selected vendor candidate.',
            summary: 'Get vendor candidate details',
            inject: { config: ConfigToken }
        },
        list: {
            operationId: 'listVendors',
            description: 'Lists vendors owned by the authenticated user.',
            summary: 'List vendors',
            inject: { db: DbToken }
        },
        get: {
            operationId: 'getVendor',
            description: 'Gets one vendor owned by the authenticated user.',
            summary: 'Get vendor',
            inject: { db: DbToken }
        },
        create: {
            operationId: 'createVendor',
            description: 'Creates or reuses a user-owned vendor.',
            summary: 'Create vendor',
            inject: { db: DbToken, config: ConfigToken }
        },
        update: {
            operationId: 'updateVendor',
            description: 'Updates editable vendor metadata.',
            summary: 'Update vendor',
            inject: { db: DbToken, logger: LoggerToken }
        },
        enrich: {
            operationId: 'enrichVendor',
            description: 'Retries vendor enrichment for a user-owned vendor.',
            summary: 'Retry vendor enrichment',
            inject: { db: DbToken, config: ConfigToken }
        }
    }
});
