import {
    createApiKeyHandler,
    listApiKeysHandler,
    revokeApiKeyHandler
} from './api-keys.js';
import {
    confirmEmailHandler,
    getMeHandler,
    googleSignInHandler,
    loginHandler,
    passportExchangeHandler,
    passportResolveUserHandler,
    registerHandler,
    resendEmailConfirmationHandler,
    sessionTokenHandler,
    singleUserSessionTokenHandler,
    updatePreferencesHandler
} from './auth.js';
import {
    acceptBudgetInvitationHandler,
    createBudgetHandler,
    deleteBudgetHandler,
    inviteBudgetMemberHandler,
    listBudgetMembersHandler,
    listBudgetsHandler,
    removeBudgetMemberHandler,
    updateBudgetHandler,
    updateBudgetMemberHandler
} from './budgets.js';
import {
    createCategoryHandler,
    deleteCategoryHandler,
    listCategoriesHandler,
    moveAndDeleteCategoryHandler,
    updateCategoryHandler
} from './categories.js';
import { convertCurrencyHandler, listCurrenciesHandler } from './currencies.js';
import {
    listMcpOAuthConnectionsHandler,
    mcpOAuthAuthorizationRequestHandler,
    mcpOAuthAuthorizeHandler,
    revokeMcpOAuthConnectionHandler
} from './mcp-oauth.js';
import {
    createTelegramLinkTokenHandler,
    disconnectTelegramHandler,
    linkTelegramHandler,
    telegramStatusHandler,
    telegramTokenHandler
} from './telegram.js';
import {
    createTransactionScanHandler,
    decideTransactionScanItemHandler,
    startTransactionScanJobHandler,
    transactionScanJobStatusHandler,
    transactionScanProgressHandler
} from './transaction-scans.js';
import { listTransactionTagsHandler } from './transaction-tags.js';
import {
    categoryTrendHandler,
    createTransactionHandler,
    dashboardSummaryHandler,
    dashboardWindowHandler,
    deleteTransactionHandler,
    exportTransactionsCsvHandler,
    getTransactionScanImageHandler,
    listTransactionsHandler,
    statsOverviewHandler,
    statsTagReportHandler,
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
        googleSignIn: googleSignInHandler,
        sessionToken: sessionTokenHandler,
        singleUserSessionToken: singleUserSessionTokenHandler,
        me: getMeHandler
    },
    users: {
        updatePreferences: updatePreferencesHandler,
        telegramStatus: telegramStatusHandler,
        createTelegramLinkToken: createTelegramLinkTokenHandler,
        disconnectTelegram: disconnectTelegramHandler,
        listApiKeys: listApiKeysHandler,
        createApiKey: createApiKeyHandler,
        revokeApiKey: revokeApiKeyHandler,
        listMcpOAuthConnections: listMcpOAuthConnectionsHandler,
        revokeMcpOAuthConnection: revokeMcpOAuthConnectionHandler
    },
    budgets: {
        list: listBudgetsHandler,
        create: createBudgetHandler,
        update: updateBudgetHandler,
        delete: deleteBudgetHandler,
        members: listBudgetMembersHandler,
        invite: inviteBudgetMemberHandler,
        updateMember: updateBudgetMemberHandler,
        removeMember: removeBudgetMemberHandler,
        acceptInvitation: acceptBudgetInvitationHandler
    },
    oauth: {
        authorizationRequest: mcpOAuthAuthorizationRequestHandler,
        authorize: mcpOAuthAuthorizeHandler
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
        exportCsv: exportTransactionsCsvHandler,
        create: createTransactionHandler,
        update: updateTransactionHandler,
        delete: deleteTransactionHandler,
        scanImage: getTransactionScanImageHandler
    },
    transactionTags: {
        list: listTransactionTagsHandler
    },
    transactionScans: {
        create: createTransactionScanHandler,
        start: startTransactionScanJobHandler,
        progress: transactionScanProgressHandler,
        status: transactionScanJobStatusHandler,
        decide: decideTransactionScanItemHandler
    },
    dashboard: {
        summary: dashboardSummaryHandler,
        window: dashboardWindowHandler
    },
    stats: {
        overview: statsOverviewHandler,
        window: statsWindowHandler,
        tags: statsTagReportHandler,
        categoryTrend: categoryTrendHandler
    }
};
