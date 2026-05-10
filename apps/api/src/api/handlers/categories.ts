import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    CategoryInUseError,
    CategoryNotFoundError,
    createCategory,
    deleteCategory,
    listCategories,
    updateCategory
} from '../../application/categories.js';
import type {
    CreateCategoryEndpoint,
    DeleteCategoryEndpoint,
    ListCategoriesEndpoint,
    UpdateCategoryEndpoint
} from '../endpoints.js';

export const listCategoriesHandler: Handler<
    typeof ListCategoriesEndpoint
> = async ({ principal }, { db }) => {
    return listCategories(db, principal.userId);
};

export const createCategoryHandler: Handler<
    typeof CreateCategoryEndpoint
> = async ({ body, principal }, { db }) => {
    return ActionResult.created(
        await createCategory(db, principal.userId, body)
    );
};

export const updateCategoryHandler: Handler<
    typeof UpdateCategoryEndpoint
> = async ({ body, params, principal }, { db }) => {
    try {
        return await updateCategory(db, principal.userId, params.id, body);
    } catch (err) {
        if (err instanceof CategoryNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        throw err;
    }
};

export const deleteCategoryHandler: Handler<
    typeof DeleteCategoryEndpoint
> = async ({ params, principal }, { db }) => {
    try {
        await deleteCategory(db, principal.userId, params.id);
        return ActionResult.noContent();
    } catch (err) {
        if (err instanceof CategoryNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        if (err instanceof CategoryInUseError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};
