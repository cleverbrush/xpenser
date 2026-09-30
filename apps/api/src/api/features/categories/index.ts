import { budgetAccessErrors } from '../../errors/budget-access.js';
import {
    createErrors,
    deleteErrors,
    moveAndDeleteErrors,
    updateErrors
} from './errors.js';
import { createCategoryHandler } from './handlers/create.js';
import { deleteCategoryHandler } from './handlers/delete.js';
import { listCategoriesHandler } from './handlers/list.js';
import { moveAndDeleteCategoryHandler } from './handlers/move-and-delete.js';
import { updateCategoryHandler } from './handlers/update.js';
import { categoriesScope } from './scope.js';

/** Bind categories handlers once; the root verifies complete contract coverage. */
export const categoriesModule = categoriesScope.withHandlers({
    list: { handler: listCategoriesHandler, errors: budgetAccessErrors },
    create: { handler: createCategoryHandler, errors: createErrors },
    update: { handler: updateCategoryHandler, errors: updateErrors },
    delete: { handler: deleteCategoryHandler, errors: deleteErrors },
    moveAndDelete: {
        handler: moveAndDeleteCategoryHandler,
        errors: moveAndDeleteErrors
    }
});
