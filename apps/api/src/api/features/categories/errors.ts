import { ActionResult } from '@cleverbrush/server';
import {
    CategoryHierarchyError,
    CategoryInUseError,
    CategoryNotFoundError,
    LastCategoryError
} from '../../../application/categories.js';
import { budgetAccessErrors } from '../../errors/budget-access.js';

/** Preserve the expected errors handled by categories.create. */
export const createErrors = budgetAccessErrors.on(CategoryHierarchyError, err =>
    ActionResult.badRequest({ message: err.message })
);

/** Preserve the expected errors handled by categories.update. */
export const updateErrors = budgetAccessErrors
    .on(CategoryNotFoundError, err =>
        ActionResult.notFound({ message: err.message })
    )
    .on(CategoryHierarchyError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(CategoryInUseError, err =>
        ActionResult.badRequest({ message: err.message })
    );

/** Preserve the expected errors handled by categories.delete. */
export const deleteErrors = budgetAccessErrors
    .on(CategoryNotFoundError, err =>
        ActionResult.notFound({ message: err.message })
    )
    .on(CategoryInUseError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(CategoryHierarchyError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(LastCategoryError, err =>
        ActionResult.badRequest({ message: err.message })
    );

/** Preserve the expected errors handled by categories.moveAndDelete. */
export const moveAndDeleteErrors = budgetAccessErrors
    .on(CategoryNotFoundError, err =>
        ActionResult.notFound({ message: err.message })
    )
    .on(CategoryHierarchyError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(CategoryInUseError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(LastCategoryError, err =>
        ActionResult.badRequest({ message: err.message })
    );
