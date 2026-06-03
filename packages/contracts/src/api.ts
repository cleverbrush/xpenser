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
    CreateMerchantBodySchema,
    CreateTelegramLinkTokenResponseSchema,
    CreateTransactionBodySchema,
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
    LinkTelegramAccountBodySchema,
    LinkTelegramAccountResponseSchema,
    LoginBodySchema,
    MerchantBrandSearchQuerySchema,
    MerchantBrandSuggestionSchema,
    MerchantListQuerySchema,
    MerchantSchema,
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
    TransactionSchema,
    UpdateCategoryBodySchema,
    UpdateMerchantBodySchema,
    UpdateTransactionBodySchema,
    UpdateUserPreferenceBodySchema,
    UserPreferenceSchema
} from './schemas.js';

const ById = route({ id: number().coerce() })`/${t => t.id}`;
const CategoryMoveAndDelete = route({ id: number().coerce() })`/${t =>
    t.id}/move-and-delete`;
const MerchantEnrich = route({ id: number().coerce() })`/${t => t.id}/enrich`;
const StatsCategoryTrend = route({ id: number().coerce() })`/categories/${t =>
    t.id}/trend`;
const categories = endpoint
    .resource('/api/categories')
    .authorize(PrincipalSchema);
const merchants = endpoint
    .resource('/api/merchants')
    .authorize(PrincipalSchema);
const merchantBrandSearch = endpoint
    .resource('/api/merchants/brand-search')
    .authorize(PrincipalSchema);
const transactions = endpoint
    .resource('/api/transactions')
    .authorize(PrincipalSchema);
const stats = endpoint.resource('/api/stats').authorize(PrincipalSchema);
const apiKeys = endpoint
    .resource('/api/users/me/api-keys')
    .authorize(PrincipalSchema);

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
    merchants: {
        searchBrands: merchantBrandSearch
            .get()
            .query(MerchantBrandSearchQuerySchema)
            .responses({ 200: array(MerchantBrandSuggestionSchema) }),
        list: merchants
            .get()
            .query(MerchantListQuerySchema)
            .cacheTag('merchants')
            .responses({ 200: array(MerchantSchema) }),
        get: merchants.get(ById).cacheTag('merchants').responses({
            200: MerchantSchema,
            404: ErrorResponseSchema
        }),
        create: merchants
            .post()
            .body(CreateMerchantBodySchema)
            .clearsCacheTag('merchants')
            .responses({ 201: MerchantSchema, 400: ErrorResponseSchema }),
        update: merchants
            .patch(ById)
            .body(UpdateMerchantBodySchema)
            .clearsCacheTag('merchants')
            .clearsCacheTag('transactions')
            .responses({
                200: MerchantSchema,
                400: ErrorResponseSchema,
                404: ErrorResponseSchema
            }),
        enrich: merchants
            .post(MerchantEnrich)
            .clearsCacheTag('merchants')
            .clearsCacheTag('transactions')
            .responses({
                200: MerchantSchema,
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
            .clearsCacheTag('merchants')
            .clearsCacheTag('transactions')
            .clearsCacheTag('user-profile')
            .clearsCacheTag('dashboard')
            .clearsCacheTag('stats')
            .responses({ 201: TransactionSchema, 400: ErrorResponseSchema }),
        update: transactions
            .patch(ById)
            .body(UpdateTransactionBodySchema)
            .clearsCacheTag('categories')
            .clearsCacheTag('merchants')
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
            .clearsCacheTag('merchants')
            .clearsCacheTag('transactions')
            .clearsCacheTag('user-profile')
            .clearsCacheTag('dashboard')
            .clearsCacheTag('stats')
            .responses({ 204: null, 404: ErrorResponseSchema })
    },
    dashboard: {
        summary: endpoint
            .get('/api/dashboard')
            .authorize(PrincipalSchema)
            .query(DashboardQuerySchema)
            .cacheTag('dashboard', request => ({
                date: request.query.date,
                merchantLimit: request.query.merchantLimit,
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
                merchantLimit: request.query.merchantLimit,
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
