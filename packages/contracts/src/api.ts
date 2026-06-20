import { array, number } from '@cleverbrush/schema';
import { defineApi, endpoint, route } from '@cleverbrush/server/contract';
import {
    ApiKeySchema,
    CategoryListQuerySchema,
    CategorySchema,
    CategoryTrendQuerySchema,
    CategoryTrendResponseSchema,
    ConfirmEmailBodySchema,
    CreateApiKeyBodySchema,
    CreateApiKeyResponseSchema,
    CreateCategoryBodySchema,
    CreateTelegramLinkTokenResponseSchema,
    CreateTransactionBodySchema,
    CreateVendorBodySchema,
    CurrencyConversionQuerySchema,
    CurrencyConversionSchema,
    CurrencySchema,
    DashboardQuerySchema,
    DashboardSummarySchema,
    DashboardWindowQuerySchema,
    DashboardWindowResponseSchema,
    EmailConfirmationMessageResponseSchema,
    EmailConfirmationPendingResponseSchema,
    ErrorResponseSchema,
    GoogleSignInBodySchema,
    LinkTelegramAccountBodySchema,
    LinkTelegramAccountResponseSchema,
    LoginBodySchema,
    McpOAuthAuthorizationQuerySchema,
    McpOAuthAuthorizationRequestSchema,
    McpOAuthAuthorizeBodySchema,
    McpOAuthAuthorizeResponseSchema,
    McpOAuthConnectionSchema,
    MoveAndDeleteCategoryBodySchema,
    PassportExchangeBodySchema,
    PassportResolveUserBodySchema,
    PassportResolveUserResponseSchema,
    PeriodWindowQuerySchema,
    PrincipalSchema,
    RegisterBodySchema,
    ResendEmailConfirmationBodySchema,
    SessionTokenBodySchema,
    StatsOverviewSchema,
    StatsQuerySchema,
    StatsWindowResponseSchema,
    TelegramConnectionStatusSchema,
    TelegramTokenBodySchema,
    TokenResponseSchema,
    TransactionListQuerySchema,
    TransactionListResponseSchema,
    TransactionScanBodySchema,
    TransactionScanDecisionBodySchema,
    TransactionScanImageResponseSchema,
    TransactionScanJobResponseSchema,
    TransactionScanProgressEventSchema,
    TransactionScanProgressQuerySchema,
    TransactionScanResponseSchema,
    TransactionSchema,
    TransactionTagListQuerySchema,
    TransactionTagSchema,
    UpdateCategoryBodySchema,
    UpdateTransactionBodySchema,
    UpdateUserPreferenceBodySchema,
    UpdateVendorBodySchema,
    UserPreferenceSchema,
    VendorCandidateDetailsQuerySchema,
    VendorCandidateSchema,
    VendorCandidateSearchQuerySchema,
    VendorListQuerySchema,
    VendorSchema
} from './schemas.js';

const ById = route({ id: number().coerce() })`/${t => t.id}`;
const CategoryMoveAndDelete = route({ id: number().coerce() })`/${t =>
    t.id}/move-and-delete`;
const VendorEnrich = route({ id: number().coerce() })`/${t => t.id}/enrich`;
const StatsCategoryTrend = route({ id: number().coerce() })`/categories/${t =>
    t.id}/trend`;
const TransactionScanDecision = route({
    scanId: number().coerce(),
    itemId: number().coerce()
})`/${t => t.scanId}/items/${t => t.itemId}/decision`;
const TransactionScanJobs = route`/jobs`;
const TransactionScanImage = route({ id: number().coerce() })`/${t =>
    t.id}/scan-image`;
const categories = endpoint
    .resource('/api/categories')
    .authorize(PrincipalSchema);
const vendors = endpoint.resource('/api/vendors').authorize(PrincipalSchema);
const vendorCandidateSearch = endpoint
    .resource('/api/vendors/candidates')
    .authorize(PrincipalSchema);
const vendorCandidateDetails = endpoint
    .resource('/api/vendors/candidates/details')
    .authorize(PrincipalSchema);
const transactions = endpoint
    .resource('/api/transactions')
    .authorize(PrincipalSchema);
const transactionTags = endpoint
    .resource('/api/transaction-tags')
    .authorize(PrincipalSchema);
const transactionScans = endpoint
    .resource('/api/transaction-scans')
    .authorize(PrincipalSchema);
const stats = endpoint.resource('/api/stats').authorize(PrincipalSchema);
const apiKeys = endpoint
    .resource('/api/users/me/api-keys')
    .authorize(PrincipalSchema);
const mcpConnections = endpoint
    .resource('/api/users/me/mcp-connections')
    .authorize(PrincipalSchema);

/**
 * Public xpenser HTTP API contract.
 *
 * This is the single contract shared by the API server and typed clients. The
 * server enriches these endpoint builders with DI, summaries, and operation IDs
 * in `apps/api/src/api/endpoints.ts`, while consumers import this contract to
 * get request, response, route-parameter, cache-tag, and authorization metadata
 * without code generation.
 */
export const api = defineApi({
    auth: {
        register: endpoint
            .post('/api/auth/register')
            .body(RegisterBodySchema)
            .responses({
                201: EmailConfirmationPendingResponseSchema,
                400: ErrorResponseSchema
            }),
        login: endpoint
            .post('/api/auth/login')
            .body(LoginBodySchema)
            .responses({
                200: TokenResponseSchema,
                401: ErrorResponseSchema,
                403: ErrorResponseSchema
            }),
        confirmEmail: endpoint
            .post('/api/auth/email/confirm')
            .body(ConfirmEmailBodySchema)
            .responses({
                200: TokenResponseSchema,
                400: ErrorResponseSchema
            }),
        resendEmailConfirmation: endpoint
            .post('/api/auth/email/resend')
            .body(ResendEmailConfirmationBodySchema)
            .responses({
                200: EmailConfirmationMessageResponseSchema,
                400: ErrorResponseSchema
            }),
        passportResolveUser: endpoint
            .post('/api/auth/passport/resolve-user')
            .body(PassportResolveUserBodySchema)
            .responses({
                200: PassportResolveUserResponseSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema
            }),
        passportExchange: endpoint
            .post('/api/auth/passport/exchange')
            .body(PassportExchangeBodySchema)
            .responses({
                200: TokenResponseSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema
            }),
        googleSignIn: endpoint
            .post('/api/auth/google/sign-in')
            .body(GoogleSignInBodySchema)
            .responses({
                200: TokenResponseSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema
            }),
        sessionToken: endpoint
            .post('/api/auth/session-token')
            .body(SessionTokenBodySchema)
            .responses({ 200: TokenResponseSchema, 401: ErrorResponseSchema }),
        me: endpoint
            .get('/api/auth/me')
            .authorize(PrincipalSchema)
            .cacheTag('user-profile')
            .responses({ 200: UserPreferenceSchema, 401: ErrorResponseSchema })
    },
    users: {
        updatePreferences: endpoint
            .put('/api/users/me/preferences')
            .authorize(PrincipalSchema)
            .body(UpdateUserPreferenceBodySchema)
            .clearsCacheTag('user-profile')
            .clearsCacheTag('dashboard')
            .clearsCacheTag('transactions')
            .clearsCacheTag('stats')
            .responses({
                200: UserPreferenceSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema
            }),
        telegramStatus: endpoint
            .get('/api/users/me/telegram')
            .authorize(PrincipalSchema)
            .cacheTag('user-profile')
            .responses({
                200: TelegramConnectionStatusSchema,
                401: ErrorResponseSchema
            }),
        createTelegramLinkToken: endpoint
            .post('/api/users/me/telegram/link-token')
            .authorize(PrincipalSchema)
            .clearsCacheTag('user-profile')
            .responses({
                201: CreateTelegramLinkTokenResponseSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema
            }),
        disconnectTelegram: endpoint
            .delete('/api/users/me/telegram')
            .authorize(PrincipalSchema)
            .clearsCacheTag('user-profile')
            .responses({
                204: null,
                401: ErrorResponseSchema
            }),
        listApiKeys: apiKeys
            .get()
            .cacheTag('api-keys')
            .responses({
                200: array(ApiKeySchema),
                401: ErrorResponseSchema
            }),
        createApiKey: apiKeys
            .post()
            .body(CreateApiKeyBodySchema)
            .clearsCacheTag('api-keys')
            .responses({
                201: CreateApiKeyResponseSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema
            }),
        revokeApiKey: apiKeys
            .delete(ById)
            .clearsCacheTag('api-keys')
            .responses({
                204: null,
                401: ErrorResponseSchema,
                404: ErrorResponseSchema
            }),
        listMcpOAuthConnections: mcpConnections
            .get()
            .cacheTag('mcp-connections')
            .responses({
                200: array(McpOAuthConnectionSchema),
                401: ErrorResponseSchema
            }),
        revokeMcpOAuthConnection: mcpConnections
            .delete(ById)
            .clearsCacheTag('mcp-connections')
            .responses({
                204: null,
                401: ErrorResponseSchema,
                404: ErrorResponseSchema
            })
    },
    oauth: {
        authorizationRequest: endpoint
            .get('/api/oauth/authorize-request')
            .authorize(PrincipalSchema)
            .query(McpOAuthAuthorizationQuerySchema)
            .responses({
                200: McpOAuthAuthorizationRequestSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema
            }),
        authorize: endpoint
            .post('/api/oauth/authorize')
            .authorize(PrincipalSchema)
            .body(McpOAuthAuthorizeBodySchema)
            .responses({
                200: McpOAuthAuthorizeResponseSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema
            })
    },
    telegram: {
        link: endpoint
            .post('/api/telegram/link')
            .body(LinkTelegramAccountBodySchema)
            .responses({
                200: LinkTelegramAccountResponseSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema,
                409: ErrorResponseSchema
            }),
        token: endpoint
            .post('/api/telegram/token')
            .body(TelegramTokenBodySchema)
            .responses({
                200: TokenResponseSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema
            })
    },
    currencies: {
        list: endpoint
            .get('/api/currencies')
            .cacheTag('currencies')
            .responses({ 200: array(CurrencySchema) }),
        convert: endpoint
            .get('/api/currencies/convert')
            .authorize(PrincipalSchema)
            .query(CurrencyConversionQuerySchema)
            .cacheTag('currency-conversion', request => ({
                amount: request.query.amount,
                currency: request.query.currency,
                occurredAt: request.query.occurredAt
            }))
            .responses({
                200: CurrencyConversionSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema
            })
    },
    categories: {
        list: categories
            .get()
            .query(CategoryListQuerySchema)
            .cacheTag('categories')
            .responses({ 200: array(CategorySchema) }),
        create: categories
            .post()
            .body(CreateCategoryBodySchema)
            .clearsCacheTag('categories')
            .clearsCacheTag('user-profile')
            .clearsCacheTag('stats')
            .responses({ 201: CategorySchema, 400: ErrorResponseSchema }),
        update: categories
            .patch(ById)
            .body(UpdateCategoryBodySchema)
            .clearsCacheTag('categories')
            .clearsCacheTag('dashboard')
            .clearsCacheTag('stats')
            .responses({
                200: CategorySchema,
                400: ErrorResponseSchema,
                404: ErrorResponseSchema
            }),
        delete: categories
            .delete(ById)
            .clearsCacheTag('categories')
            .clearsCacheTag('user-profile')
            .clearsCacheTag('stats')
            .responses({
                204: null,
                400: ErrorResponseSchema,
                404: ErrorResponseSchema
            }),
        moveAndDelete: categories
            .post(CategoryMoveAndDelete)
            .body(MoveAndDeleteCategoryBodySchema)
            .clearsCacheTag('categories')
            .clearsCacheTag('transactions')
            .clearsCacheTag('user-profile')
            .clearsCacheTag('dashboard')
            .clearsCacheTag('stats')
            .responses({
                204: null,
                400: ErrorResponseSchema,
                404: ErrorResponseSchema
            })
    },
    vendors: {
        searchCandidates: vendorCandidateSearch
            .get()
            .query(VendorCandidateSearchQuerySchema)
            .responses({ 200: array(VendorCandidateSchema) }),
        candidateDetails: vendorCandidateDetails
            .get()
            .query(VendorCandidateDetailsQuerySchema)
            .responses({
                200: VendorCandidateSchema,
                404: ErrorResponseSchema
            }),
        list: vendors
            .get()
            .query(VendorListQuerySchema)
            .cacheTag('vendors')
            .responses({ 200: array(VendorSchema) }),
        get: vendors.get(ById).cacheTag('vendors').responses({
            200: VendorSchema,
            404: ErrorResponseSchema
        }),
        create: vendors
            .post()
            .body(CreateVendorBodySchema)
            .clearsCacheTag('vendors')
            .responses({ 201: VendorSchema, 400: ErrorResponseSchema }),
        update: vendors
            .patch(ById)
            .body(UpdateVendorBodySchema)
            .clearsCacheTag('vendors')
            .clearsCacheTag('transactions')
            .responses({
                200: VendorSchema,
                400: ErrorResponseSchema,
                404: ErrorResponseSchema
            }),
        enrich: vendors
            .post(VendorEnrich)
            .clearsCacheTag('vendors')
            .clearsCacheTag('transactions')
            .responses({
                200: VendorSchema,
                404: ErrorResponseSchema
            })
    },
    transactions: {
        list: transactions
            .get()
            .query(TransactionListQuerySchema)
            .cacheTag('transactions')
            .responses({ 200: TransactionListResponseSchema }),
        create: transactions
            .post()
            .body(CreateTransactionBodySchema)
            .clearsCacheTag('categories')
            .clearsCacheTag('vendors')
            .clearsCacheTag('transaction-tags')
            .clearsCacheTag('transactions')
            .clearsCacheTag('user-profile')
            .clearsCacheTag('dashboard')
            .clearsCacheTag('stats')
            .responses({ 201: TransactionSchema, 400: ErrorResponseSchema }),
        update: transactions
            .patch(ById)
            .body(UpdateTransactionBodySchema)
            .clearsCacheTag('categories')
            .clearsCacheTag('vendors')
            .clearsCacheTag('transaction-tags')
            .clearsCacheTag('transactions')
            .clearsCacheTag('user-profile')
            .clearsCacheTag('dashboard')
            .clearsCacheTag('stats')
            .responses({
                200: TransactionSchema,
                400: ErrorResponseSchema,
                404: ErrorResponseSchema
            }),
        delete: transactions
            .delete(ById)
            .clearsCacheTag('categories')
            .clearsCacheTag('vendors')
            .clearsCacheTag('transaction-tags')
            .clearsCacheTag('transactions')
            .clearsCacheTag('user-profile')
            .clearsCacheTag('dashboard')
            .clearsCacheTag('stats')
            .responses({ 204: null, 404: ErrorResponseSchema }),
        scanImage: transactions.get(TransactionScanImage).responses({
            200: TransactionScanImageResponseSchema,
            404: ErrorResponseSchema
        })
    },
    transactionTags: {
        list: transactionTags
            .get()
            .query(TransactionTagListQuerySchema)
            .cacheTag('transaction-tags')
            .responses({ 200: array(TransactionTagSchema) })
    },
    transactionScans: {
        create: transactionScans
            .post()
            .body(TransactionScanBodySchema)
            .responses({
                201: TransactionScanResponseSchema,
                400: ErrorResponseSchema
            }),
        start: transactionScans
            .post(TransactionScanJobs)
            .body(TransactionScanBodySchema)
            .responses({
                202: TransactionScanJobResponseSchema,
                400: ErrorResponseSchema,
                401: ErrorResponseSchema
            }),
        progress: endpoint
            .subscription('/api/transaction-scans/jobs/progress')
            .public()
            .query(TransactionScanProgressQuerySchema)
            .outgoing(TransactionScanProgressEventSchema),
        decide: transactionScans
            .post(TransactionScanDecision)
            .body(TransactionScanDecisionBodySchema)
            .responses({
                204: null,
                400: ErrorResponseSchema,
                404: ErrorResponseSchema
            })
    },
    dashboard: {
        summary: endpoint
            .get('/api/dashboard')
            .authorize(PrincipalSchema)
            .query(DashboardQuerySchema)
            .cacheTag('dashboard', request => ({
                date: request.query.date,
                vendorLimit: request.query.vendorLimit,
                period: request.query.period
            }))
            .responses({ 200: DashboardSummarySchema }),
        window: endpoint
            .get('/api/dashboard/window')
            .authorize(PrincipalSchema)
            .query(DashboardWindowQuerySchema)
            .cacheTag('dashboard', request => ({
                after: request.query.after,
                before: request.query.before,
                date: request.query.date,
                vendorLimit: request.query.vendorLimit,
                period: request.query.period
            }))
            .responses({ 200: DashboardWindowResponseSchema })
    },
    stats: {
        overview: endpoint
            .get('/api/stats')
            .authorize(PrincipalSchema)
            .query(StatsQuerySchema)
            .cacheTag('stats', request => ({
                date: request.query.date,
                from: request.query.from,
                groupBy: request.query.groupBy,
                period: request.query.period,
                timeframe: request.query.timeframe,
                to: request.query.to
            }))
            .responses({ 200: StatsOverviewSchema }),
        window: endpoint
            .get('/api/stats/window')
            .authorize(PrincipalSchema)
            .query(PeriodWindowQuerySchema)
            .cacheTag('stats', request => ({
                after: request.query.after,
                before: request.query.before,
                date: request.query.date,
                period: request.query.period
            }))
            .responses({ 200: StatsWindowResponseSchema }),
        categoryTrend: stats
            .get(StatsCategoryTrend)
            .query(CategoryTrendQuerySchema)
            .cacheTag('stats', request => ({
                categoryId: request.params.id,
                from: request.query.from,
                groupBy: request.query.groupBy,
                range: request.query.range,
                to: request.query.to
            }))
            .responses({
                200: CategoryTrendResponseSchema,
                400: ErrorResponseSchema
            })
    }
});

export type XpenserApi = typeof api;
