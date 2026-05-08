import { defineApi, endpoint, route } from '@cleverbrush/server/contract';
import { number, array } from '@cleverbrush/schema';

// ── Route templates ──────────────────────────────────────────────────────────
const ById = route({ id: number().coerce() })`/${(t: { id: number }) => t.id}`;

// ── Resource factories ───────────────────────────────────────────────────────
const authResource = endpoint.resource('/api/auth');
const usersResource = endpoint.resource('/api/users');
const categoriesResource = endpoint.resource('/api/categories');
const transactionsResource = endpoint.resource('/api/transactions');
const dashboardResource = endpoint.resource('/api/dashboard');
const currenciesResource = endpoint.resource('/api/currencies');

import {
  RegisterBodySchema,
  LoginBodySchema,
  GoogleAuthBodySchema,
  TokenResponseSchema,
} from './schemas/auth';
import { UserResponseSchema } from './schemas/user';
import {
  CategorySchema,
  CreateCategoryBodySchema,
  UpdateCategoryBodySchema,
} from './schemas/category';
import {
  TransactionSchema,
  CreateTransactionBodySchema,
  UpdateTransactionBodySchema,
  TransactionListQuerySchema,
} from './schemas/transaction';
import { DashboardQuerySchema, DashboardSummarySchema } from './schemas/dashboard';
import { UpdatePreferencesBodySchema } from './schemas/preferences';
import { ErrorResponseSchema } from './schemas/common';

/** Typed API contract — single source of truth for both backend and frontend. */
export const api = defineApi({
  auth: {
    register: authResource
      .post('/register')
      .body(RegisterBodySchema)
      .responses({ 201: UserResponseSchema, 400: ErrorResponseSchema }),

    login: authResource
      .post('/login')
      .body(LoginBodySchema)
      .responses({ 200: TokenResponseSchema, 401: ErrorResponseSchema }),

    googleLogin: authResource
      .post('/google')
      .body(GoogleAuthBodySchema)
      .responses({ 200: TokenResponseSchema, 400: ErrorResponseSchema }),
  },

  users: {
    getProfile: usersResource
      .get('/me')
      .responses({ 200: UserResponseSchema }),

    updateProfile: usersResource
      .patch('/me')
      .body(UpdatePreferencesBodySchema)
      .responses({ 200: UserResponseSchema }),
  },

  categories: {
    list: categoriesResource
      .get('/')
      .responses({ 200: array(CategorySchema) }),

    create: categoriesResource
      .post('/')
      .body(CreateCategoryBodySchema)
      .responses({ 201: CategorySchema }),

    update: categoriesResource
      .patch(ById)
      .body(UpdateCategoryBodySchema)
      .responses({ 200: CategorySchema }),

    delete: categoriesResource
      .delete(ById)
      .responses({ 204: null, 409: ErrorResponseSchema }),
  },

  transactions: {
    list: transactionsResource
      .get('/')
      .query(TransactionListQuerySchema)
      .responses({ 200: array(TransactionSchema) }),

    get: transactionsResource
      .get(ById)
      .responses({ 200: TransactionSchema }),

    create: transactionsResource
      .post('/')
      .body(CreateTransactionBodySchema)
      .responses({ 201: TransactionSchema }),

    update: transactionsResource
      .patch(ById)
      .body(UpdateTransactionBodySchema)
      .responses({ 200: TransactionSchema }),

    delete: transactionsResource
      .delete(ById)
      .responses({ 204: null }),
  },

  dashboard: {
    getSummary: dashboardResource
      .get('/summary')
      .query(DashboardQuerySchema)
      .responses({ 200: DashboardSummarySchema }),
  },

  currencies: {
    list: currenciesResource
      .get('/')
      .responses({ 200: null }),

    convert: currenciesResource
      .get('/convert')
      .query({ from: null, to: null, amount: null })
      .responses({ 200: null }),
  },
});
