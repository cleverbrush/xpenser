import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { DbToken } from '../../../di/tokens.js';

/** Server-only configuration for the shared categories contract. */
export const categoriesScope = implement(api).group('categories', {
    inject: { db: DbToken },
    tags: ['categories'],
    operations: {
        list: {
            operationId: 'listCategories',
            description:
                'Lists categories owned by the authenticated user, optionally ordered by recent transaction count.',
            summary: 'List categories'
        },
        create: {
            operationId: 'createCategory',
            description: 'Creates a user-owned income or expense category.',
            summary: 'Create category'
        },
        update: {
            operationId: 'updateCategory',
            description: 'Updates a user-owned category.',
            summary: 'Update category'
        },
        delete: {
            operationId: 'deleteCategory',
            description: 'Deletes an unused user-owned category.',
            summary: 'Delete category'
        },
        moveAndDelete: {
            operationId: 'moveAndDeleteCategory',
            description:
                'Moves transactions from a leaf category into another same-type category, then deletes the source category.',
            summary: 'Move transactions and delete category'
        }
    }
});
