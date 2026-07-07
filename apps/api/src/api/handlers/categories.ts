import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    BudgetAccessError,
    BudgetPermissionError
} from '../../application/budgets.js';
import {
    CategoryHierarchyError,
    CategoryInUseError,
    CategoryNotFoundError,
    createCategory,
    deleteCategory,
    LastCategoryError,
    listCategories,
    moveAndDeleteCategory,
    updateCategory
} from '../../application/categories.js';
import type {
    CreateCategoryEndpoint,
    DeleteCategoryEndpoint,
    ListCategoriesEndpoint,
    MoveAndDeleteCategoryEndpoint,
    UpdateCategoryEndpoint
} from '../endpoints.js';

function budgetResult(err: unknown) {
    if (err instanceof BudgetPermissionError) {
        return ActionResult.forbidden({ message: err.message });
    }
    if (err instanceof BudgetAccessError) {
        return ActionResult.notFound({ message: err.message });
    }
    return undefined;
}

export const listCategoriesHandler: Handler<
    typeof ListCategoriesEndpoint
> = async ({ principal, query }, { db }) => {
    try {
        return await listCategories(db, principal.userId, query);
    } catch (err) {
        const result = budgetResult(err);
        if (result) {
            return result;
        }
        throw err;
    }
};

export const createCategoryHandler: Handler<
    typeof CreateCategoryEndpoint
> = async ({ body, principal }, { db }) => {
    try {
        return ActionResult.created(
            await createCategory(db, principal.userId, body)
        );
    } catch (err) {
        const result = budgetResult(err);
        if (result) {
            return result;
        }
        if (err instanceof CategoryHierarchyError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const updateCategoryHandler: Handler<
    typeof UpdateCategoryEndpoint
> = async ({ body, params, principal }, { db }) => {
    try {
        return await updateCategory(db, principal.userId, params.id, body);
    } catch (err) {
        const result = budgetResult(err);
        if (result) {
            return result;
        }
        if (err instanceof CategoryNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        if (
            err instanceof CategoryHierarchyError ||
            err instanceof CategoryInUseError
        ) {
            return ActionResult.badRequest({ message: err.message });
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
        const result = budgetResult(err);
        if (result) {
            return result;
        }
        if (err instanceof CategoryNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        if (err instanceof CategoryInUseError) {
            return ActionResult.badRequest({ message: err.message });
        }
        if (err instanceof CategoryHierarchyError) {
            return ActionResult.badRequest({ message: err.message });
        }
        if (err instanceof LastCategoryError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const moveAndDeleteCategoryHandler: Handler<
    typeof MoveAndDeleteCategoryEndpoint
> = async ({ body, params, principal }, { db }) => {
    try {
        await moveAndDeleteCategory(
            db,
            principal.userId,
            params.id,
            body.replacementCategoryId
        );
        return ActionResult.noContent();
    } catch (err) {
        const result = budgetResult(err);
        if (result) {
            return result;
        }
        if (err instanceof CategoryNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        if (
            err instanceof CategoryHierarchyError ||
            err instanceof CategoryInUseError ||
            err instanceof LastCategoryError
        ) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};
