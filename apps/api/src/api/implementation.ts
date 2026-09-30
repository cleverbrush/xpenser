import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { authModule } from './features/auth/index.js';
import { budgetsModule } from './features/budgets/index.js';
import { categoriesModule } from './features/categories/index.js';
import { currenciesModule } from './features/currencies/index.js';
import { dashboardModule } from './features/dashboard/index.js';
import { oauthModule } from './features/oauth/index.js';
import { statsModule } from './features/stats/index.js';
import { telegramModule } from './features/telegram/index.js';
import { transactionScansModule } from './features/transaction-scans/index.js';
import { transactionTagsModule } from './features/transaction-tags/index.js';
import { transactionsModule } from './features/transactions/index.js';
import { usersModule } from './features/users/index.js';
import { vendorsModule } from './features/vendors/index.js';

/** Complete application implementation; wire contracts remain in @xpenser/contracts. */
export const apiImplementation = implement(api).use(
    authModule,
    usersModule,
    budgetsModule,
    oauthModule,
    telegramModule,
    currenciesModule,
    categoriesModule,
    vendorsModule,
    transactionsModule,
    transactionTagsModule,
    transactionScansModule,
    dashboardModule,
    statsModule
);
