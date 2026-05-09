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
> = async ({ principal }, { knex }) => {
    return listCategories(knex, principal.userId);
};

export const createCategoryHandler: Handler<
    typeof CreateCategoryEndpoint
> = async ({ body, principal }, { knex }) => {
    return ActionResult.created(
        await createCategory(knex, principal.userId, body)
    );
};

export const updateCategoryHandler: Handler<
    typeof UpdateCategoryEndpoint
> = async ({ body, params, principal }, { knex }) => {
    try {
        return await updateCategory(knex, principal.userId, params.id, body);
    } catch (err) {
        if (err instanceof CategoryNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        throw err;
    }
};

export const deleteCategoryHandler: Handler<
    typeof DeleteCategoryEndpoint
> = async ({ params, principal }, { knex }) => {
    try {
        await deleteCategory(knex, principal.userId, params.id);
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
