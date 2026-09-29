import { ActionResult, type Handler } from '@cleverbrush/server';
import { deleteCategory } from '../../../../application/categories.js';
import type { categoriesScope } from '../scope.js';

/** Delete category. */
export const deleteCategoryHandler: Handler<
    typeof categoriesScope.endpoints.delete
> = async ({ params, principal }, { db }) => {
    await deleteCategory(db, principal.userId, params.id);
    return ActionResult.noContent();
};
