import {
    getMeHandler,
    googleAuthHandler,
    loginHandler,
    registerHandler,
    updatePreferencesHandler
} from './auth.js';
import {
    createCategoryHandler,
    deleteCategoryHandler,
    listCategoriesHandler,
    updateCategoryHandler
} from './categories.js';
import { listCurrenciesHandler } from './currencies.js';
import {
    createTransactionHandler,
    dashboardSummaryHandler,
    deleteTransactionHandler,
    listTransactionsHandler,
    updateTransactionHandler
} from './transactions.js';

export const handlers = {
    auth: {
        register: registerHandler,
        login: loginHandler,
        google: googleAuthHandler,
        me: getMeHandler
    },
    users: {
        updatePreferences: updatePreferencesHandler
    },
    currencies: {
        list: listCurrenciesHandler
    },
    categories: {
        list: listCategoriesHandler,
        create: createCategoryHandler,
        update: updateCategoryHandler,
        delete: deleteCategoryHandler
    },
    transactions: {
        list: listTransactionsHandler,
        create: createTransactionHandler,
        update: updateTransactionHandler,
        delete: deleteTransactionHandler
    },
    dashboard: {
        summary: dashboardSummaryHandler
    }
};
