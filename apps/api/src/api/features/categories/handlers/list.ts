import type { Handler } from '@cleverbrush/server';
import { listCategories } from '../../../../application/categories.js';
import type { categoriesScope } from '../scope.js';

/** List categories. */
export const listCategoriesHandler: Handler<
    typeof categoriesScope.endpoints.list
> = async ({ principal, query }, { db }) => {
    return await listCategories(db, principal.userId, query);
};
