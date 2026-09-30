import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { DbToken } from '../../../di/tokens.js';

/** Server-only configuration for the shared transactionTags contract. */
export const transactionTagsScope = implement(api).group('transactionTags', {
    inject: { db: DbToken },
    tags: ['transaction-tags'],
    operations: {
        list: {
            operationId: 'listTransactionTags',
            description:
                'Lists transaction tags owned by the authenticated user.',
            summary: 'List transaction tags'
        }
    }
});
