import { jwtScheme } from '@cleverbrush/auth';
import type { Logger } from '@cleverbrush/log';
import { createServer, type Middleware } from '@cleverbrush/server';
import { tracingMiddleware } from '@cleverbrush/otel';
import { generateOpenApiSpec } from '@cleverbrush/server-openapi';
import type { Config } from './config.js';
import { configureDI } from './di/setup.js';
import { LoggerToken } from './di/tokens.js';
import {
  RegisterEndpoint,
  LoginEndpoint,
  GoogleLoginEndpoint,
  GetProfileEndpoint,
  UpdateProfileEndpoint,
  ListCategoriesEndpoint,
  CreateCategoryEndpoint,
  UpdateCategoryEndpoint,
  DeleteCategoryEndpoint,
  ListTransactionsEndpoint,
  GetTransactionEndpoint,
  CreateTransactionEndpoint,
  UpdateTransactionEndpoint,
  DeleteTransactionEndpoint,
  GetDashboardSummaryEndpoint,
  ListCurrenciesEndpoint,
  ConvertCurrencyEndpoint,
} from './api/endpoints.js';
import {
  registerHandler,
  loginHandler,
  googleLoginHandler,
  listCategoriesHandler,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
  listTransactionsHandler,
  getTransactionHandler,
  createTransactionHandler,
  updateTransactionHandler,
  deleteTransactionHandler,
  getProfileHandler,
  updateProfileHandler,
  listCurrenciesHandler,
  convertCurrencyHandler,
  getDashboardSummaryHandler,
} from './api/handlers/index.js';

function createCorsMiddleware(): Middleware {
  return async (ctx, next) => {
    ctx.response.setHeader('Access-Control-Allow-Origin', '*');
    ctx.response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    ctx.response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    ctx.response.setHeader('Access-Control-Expose-Headers', 'X-Trace-Id, X-Response-Time');
    if (ctx.method === 'OPTIONS') {
      ctx.response.writeHead(204);
      ctx.response.end();
      return;
    }
    await next();
  };
}

function timingMiddleware(): Middleware {
  return async (ctx, next) => {
    const start = Date.now();
    await next();
    ctx.response.setHeader('X-Response-Time', `${Date.now() - start}ms`);
  };
}

export function buildServer(config: Config, logger: Logger) {
  const server = createServer();

  server
    .use(tracingMiddleware({ excludePaths: ['/health'] }))
    .use(createCorsMiddleware())
    .use(timingMiddleware());

  server.useAuthentication({
    defaultScheme: 'jwt',
    schemes: [
      jwtScheme({
        secret: config.jwt.secret,
        mapClaims: (claims) => ({
          sub: claims.sub as string,
          role: (claims as { role?: string }).role ?? 'user',
        }),
      }),
    ],
  });

  server.useAuthorization();

  server.services((svc) => configureDI(svc, config, logger));

  server.handle(RegisterEndpoint, registerHandler);
  server.handle(LoginEndpoint, loginHandler);
  server.handle(GoogleLoginEndpoint, googleLoginHandler);
  server.handle(GetProfileEndpoint, getProfileHandler);
  server.handle(UpdateProfileEndpoint, updateProfileHandler);
  server.handle(ListCategoriesEndpoint, listCategoriesHandler);
  server.handle(CreateCategoryEndpoint, createCategoryHandler);
  server.handle(UpdateCategoryEndpoint, updateCategoryHandler);
  server.handle(DeleteCategoryEndpoint, deleteCategoryHandler);
  server.handle(ListTransactionsEndpoint, listTransactionsHandler);
  server.handle(GetTransactionEndpoint, getTransactionHandler);
  server.handle(CreateTransactionEndpoint, createTransactionHandler);
  server.handle(UpdateTransactionEndpoint, updateTransactionHandler);
  server.handle(DeleteTransactionEndpoint, deleteTransactionHandler);
  server.handle(GetDashboardSummaryEndpoint, getDashboardSummaryHandler);
  server.handle(ListCurrenciesEndpoint, listCurrenciesHandler);
  server.handle(ConvertCurrencyEndpoint, convertCurrencyHandler);

  server.route({
    method: 'GET',
    path: '/health',
    handle: async () => ({ status: 200, body: { status: 'ok' } }),
  });

  const openApiDoc = generateOpenApiSpec(server, {
    title: 'Xpenser API',
    version: '1.0.0',
    description: 'Personal income and expense tracker API built on Cleverbrush Framework.',
    contact: { name: 'Xpenser Team', email: 'support@xpenser.cleverbrush.com' },
  });

  server.route({
    method: 'GET',
    path: '/openapi.json',
    handle: async () => ({
      status: 200,
      body: openApiDoc,
      headers: { 'Content-Type': 'application/json' },
    }),
  });

  return server;
}
