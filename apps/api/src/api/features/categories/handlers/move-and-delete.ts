import { ActionResult, type Handler } from '@cleverbrush/server';
import { moveAndDeleteCategory } from '../../../../application/categories.js';
import type { categoriesScope } from '../scope.js';

/** Move transactions and delete category. */
export const moveAndDeleteCategoryHandler: Handler<
    typeof categoriesScope.endpoints.moveAndDelete
> = async ({ body, params, principal }, { db }) => {
    await moveAndDeleteCategory(
        db,
        principal.userId,
        params.id,
        body.replacementCategoryId
    );
    return ActionResult.noContent();
};
