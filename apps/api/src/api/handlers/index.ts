import {
    createApiKeyHandler,
    listApiKeysHandler,
    revokeApiKeyHandler
} from './api-keys.js';
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
    createTelegramLinkTokenHandler,
    disconnectTelegramHandler,
    linkTelegramHandler,
    telegramStatusHandler,
    telegramTokenHandler
} from './telegram.js';
import {
    createTransactionHandler,
    dashboardSummaryHandler,
    deleteTransactionHandler,
    listTransactionsHandler,
    statsOverviewHandler,
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
        updatePreferences: updatePreferencesHandler,
        telegramStatus: telegramStatusHandler,
        createTelegramLinkToken: createTelegramLinkTokenHandler,
        disconnectTelegram: disconnectTelegramHandler,
        listApiKeys: listApiKeysHandler,
        createApiKey: createApiKeyHandler,
        revokeApiKey: revokeApiKeyHandler
    },
    telegram: {
        link: linkTelegramHandler,
        token: telegramTokenHandler
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
    },
    stats: {
        overview: statsOverviewHandler
    }
};
