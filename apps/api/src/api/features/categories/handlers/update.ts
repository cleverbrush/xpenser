import type { Handler } from '@cleverbrush/server';
import { updateCategory } from '../../../../application/categories.js';
import type { categoriesScope } from '../scope.js';

/** Update category. */
export const updateCategoryHandler: Handler<
    typeof categoriesScope.endpoints.update
> = async ({ body, params, principal }, { db }) => {
    return await updateCategory(db, principal.userId, params.id, body);
};
