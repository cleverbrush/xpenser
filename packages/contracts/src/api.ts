import { array, number } from '@cleverbrush/schema';
import { defineApi, endpoint, route } from '@cleverbrush/server/contract';
import {
    CategorySchema,
    CreateCategoryBodySchema,
    CreateTransactionBodySchema,
    CurrencySchema,
    DashboardQuerySchema,
    DashboardSummarySchema,
    ErrorResponseSchema,
    GoogleAuthBodySchema,
    LoginBodySchema,
    PrincipalSchema,
    RegisterBodySchema,
    StatsOverviewSchema,
    StatsQuerySchema,
    TokenResponseSchema,
    TransactionListQuerySchema,
    TransactionListResponseSchema,
    TransactionSchema,
    UpdateCategoryBodySchema,
    UpdateTransactionBodySchema,
    UpdateUserPreferenceBodySchema,
    UserPreferenceSchema
} from './schemas.js';

const ById = route({ id: number().coerce() })`/${t => t.id}`;
const categories = endpoint
    .resource('/api/categories')
    .authorize(PrincipalSchema);
const transactions = endpoint
    .resource('/api/transactions')
    .authorize(PrincipalSchema);

export const api = defineApi({
    auth: {
        register: endpoint
            .post('/api/auth/register')
            .body(RegisterBodySchema)
            .responses({ 201: TokenResponseSchema, 400: ErrorResponseSchema }),
        login: endpoint
            .post('/api/auth/login')
            .body(LoginBodySchema)
            .responses({ 200: TokenResponseSchema, 401: ErrorResponseSchema }),
        google: endpoint
            .post('/api/auth/google')
            .body(GoogleAuthBodySchema)
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
            })
    },
    currencies: {
        list: endpoint
            .get('/api/currencies')
            .cacheTag('currencies')
            .responses({ 200: array(CurrencySchema) })
    },
    categories: {
        list: categories
            .get()
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
            .responses({ 200: CategorySchema, 404: ErrorResponseSchema }),
        delete: categories
            .delete(ById)
            .clearsCacheTag('categories')
            .clearsCacheTag('user-profile')
            .clearsCacheTag('stats')
            .responses({
                204: null,
                400: ErrorResponseSchema,
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
            .clearsCacheTag('transactions')
            .clearsCacheTag('dashboard')
            .clearsCacheTag('stats')
            .responses({ 201: TransactionSchema, 400: ErrorResponseSchema }),
        update: transactions
            .patch(ById)
            .body(UpdateTransactionBodySchema)
            .clearsCacheTag('transactions')
            .clearsCacheTag('dashboard')
            .clearsCacheTag('stats')
            .responses({
                200: TransactionSchema,
                400: ErrorResponseSchema,
                404: ErrorResponseSchema
            }),
        delete: transactions
            .delete(ById)
            .clearsCacheTag('transactions')
            .clearsCacheTag('dashboard')
            .clearsCacheTag('stats')
            .responses({ 204: null, 404: ErrorResponseSchema })
    },
    dashboard: {
        summary: endpoint
            .get('/api/dashboard')
            .authorize(PrincipalSchema)
            .query(DashboardQuerySchema)
            .cacheTag('dashboard')
            .responses({ 200: DashboardSummarySchema })
    },
    stats: {
        overview: endpoint
            .get('/api/stats')
            .authorize(PrincipalSchema)
            .query(StatsQuerySchema)
            .cacheTag('stats')
            .responses({ 200: StatsOverviewSchema })
    }
});

export type XpenserApi = typeof api;
