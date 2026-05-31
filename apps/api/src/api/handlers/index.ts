import {
    createApiKeyHandler,
    listApiKeysHandler,
    revokeApiKeyHandler
} from './api-keys.js';
import {
    getMeHandler,
    loginHandler,
    passportExchangeHandler,
    passportResolveUserHandler,
    registerHandler,
    sessionTokenHandler,
    updatePreferencesHandler
} from './auth.js';
import {
    createCategoryHandler,
    deleteCategoryHandler,
    listCategoriesHandler,
    updateCategoryHandler
} from './categories.js';
import { convertCurrencyHandler, listCurrenciesHandler } from './currencies.js';
import {
    createTelegramLinkTokenHandler,
    disconnectTelegramHandler,
    linkTelegramHandler,
    telegramStatusHandler,
    telegramTokenHandler
} from './telegram.js';
import {
    categoryTrendHandler,
    createTransactionHandler,
    dashboardSummaryHandler,
    dashboardWindowHandler,
    deleteTransactionHandler,
    listTransactionsHandler,
    statsOverviewHandler,
    statsWindowHandler,
    updateTransactionHandler
} from './transactions.js';

export const handlers = {
    auth: {
        register: registerHandler,
        login: loginHandler,
        passportResolveUser: passportResolveUserHandler,
        passportExchange: passportExchangeHandler,
        sessionToken: sessionTokenHandler,
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
        list: listCurrenciesHandler,
        convert: convertCurrencyHandler
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
        summary: dashboardSummaryHandler,
        window: dashboardWindowHandler
    },
    stats: {
        overview: statsOverviewHandler,
        window: statsWindowHandler,
        categoryTrend: categoryTrendHandler
    }
};
