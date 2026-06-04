import {
    createApiKeyHandler,
    listApiKeysHandler,
    revokeApiKeyHandler
} from './api-keys.js';
import {
    confirmEmailHandler,
    getMeHandler,
    loginHandler,
    passportExchangeHandler,
    passportResolveUserHandler,
    registerHandler,
    resendEmailConfirmationHandler,
    sessionTokenHandler,
    updatePreferencesHandler
} from './auth.js';
import {
    createCategoryHandler,
    deleteCategoryHandler,
    listCategoriesHandler,
    moveAndDeleteCategoryHandler,
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
    createTransactionScanHandler,
    decideTransactionScanItemHandler
} from './transaction-scans.js';
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
import {
    createVendorHandler,
    enrichVendorHandler,
    getVendorCandidateDetailsHandler,
    getVendorHandler,
    listVendorsHandler,
    searchVendorCandidatesHandler,
    updateVendorHandler
} from './vendors.js';

export const handlers = {
    auth: {
        register: registerHandler,
        login: loginHandler,
        confirmEmail: confirmEmailHandler,
        resendEmailConfirmation: resendEmailConfirmationHandler,
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
        delete: deleteCategoryHandler,
        moveAndDelete: moveAndDeleteCategoryHandler
    },
    vendors: {
        searchCandidates: searchVendorCandidatesHandler,
        candidateDetails: getVendorCandidateDetailsHandler,
        list: listVendorsHandler,
        get: getVendorHandler,
        create: createVendorHandler,
        update: updateVendorHandler,
        enrich: enrichVendorHandler
    },
    transactions: {
        list: listTransactionsHandler,
        create: createTransactionHandler,
        update: updateTransactionHandler,
        delete: deleteTransactionHandler
    },
    transactionScans: {
        create: createTransactionScanHandler,
        decide: decideTransactionScanItemHandler
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
