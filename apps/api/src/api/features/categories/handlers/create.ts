import { ActionResult, type Handler } from '@cleverbrush/server';
import { createCategory } from '../../../../application/categories.js';
import type { categoriesScope } from '../scope.js';

/** Create category. */
export const createCategoryHandler: Handler<
    typeof categoriesScope.endpoints.create
> = async ({ body, principal }, { db }) => {
    return ActionResult.created(
        await createCategory(db, principal.userId, body)
    );
};
