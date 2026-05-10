import { api, PrincipalSchema } from '@xpenser/contracts';
import { ConfigToken, KnexToken, LoggerToken } from '../di/tokens.js';

export const RegisterEndpoint = api.auth.register
    .inject({ knex: KnexToken, config: ConfigToken })
    .summary('Register')
    .description('Creates a local account and returns an API JWT.')
    .tags('auth')
    .operationId('register');

export const LoginEndpoint = api.auth.login
    .inject({ knex: KnexToken, config: ConfigToken })
    .summary('Login')
    .description('Authenticates a local account and returns an API JWT.')
    .tags('auth')
    .operationId('login');

export const GoogleAuthEndpoint = api.auth.google
    .inject({ knex: KnexToken, config: ConfigToken })
    .summary('Google authentication')
    .description('Verifies a Google token and returns an API JWT.')
    .tags('auth')
    .operationId('googleAuth');

export const GetMeEndpoint = api.auth.me
    .authorize(PrincipalSchema)
    .inject({ knex: KnexToken })
    .summary('Current user')
    .description('Returns preferences for the authenticated user.')
    .tags('users')
    .operationId('getCurrentUser');

export const UpdatePreferencesEndpoint = api.users.updatePreferences
    .authorize(PrincipalSchema)
    .inject({ knex: KnexToken })
    .summary('Update preferences')
    .description('Updates the current user default and favorite currencies.')
    .tags('users')
    .operationId('updateUserPreferences');

export const ListCurrenciesEndpoint = api.currencies.list
    .inject({ config: ConfigToken })
    .summary('List currencies')
    .description('Returns active currencies available from Frankfurter.')
    .tags('currencies')
    .operationId('listCurrencies');

export const ListCategoriesEndpoint = api.categories.list
    .authorize(PrincipalSchema)
    .inject({ knex: KnexToken })
    .summary('List categories')
    .description('Lists categories owned by the authenticated user.')
    .tags('categories')
    .operationId('listCategories');

export const CreateCategoryEndpoint = api.categories.create
    .authorize(PrincipalSchema)
    .inject({ knex: KnexToken })
    .summary('Create category')
    .description('Creates a user-owned income or expense category.')
    .tags('categories')
    .operationId('createCategory');

export const UpdateCategoryEndpoint = api.categories.update
    .authorize(PrincipalSchema)
    .inject({ knex: KnexToken })
    .summary('Update category')
    .description('Updates a user-owned category.')
    .tags('categories')
    .operationId('updateCategory');

export const DeleteCategoryEndpoint = api.categories.delete
    .authorize(PrincipalSchema)
    .inject({ knex: KnexToken })
    .summary('Delete category')
    .description('Deletes an unused user-owned category.')
    .tags('categories')
    .operationId('deleteCategory');

export const ListTransactionsEndpoint = api.transactions.list
    .authorize(PrincipalSchema)
    .inject({ knex: KnexToken })
    .summary('List transactions')
    .description('Lists transactions owned by the authenticated user.')
    .tags('transactions')
    .operationId('listTransactions');

export const CreateTransactionEndpoint = api.transactions.create
    .authorize(PrincipalSchema)
    .inject({ knex: KnexToken, config: ConfigToken, logger: LoggerToken })
    .summary('Create transaction')
    .description(
        'Creates a transaction and stores its historical exchange rate.'
    )
    .tags('transactions')
    .operationId('createTransaction');

export const UpdateTransactionEndpoint = api.transactions.update
    .authorize(PrincipalSchema)
    .inject({ knex: KnexToken, config: ConfigToken })
    .summary('Update transaction')
    .description('Updates a transaction and recalculates converted values.')
    .tags('transactions')
    .operationId('updateTransaction');

export const DeleteTransactionEndpoint = api.transactions.delete
    .authorize(PrincipalSchema)
    .inject({ knex: KnexToken })
    .summary('Delete transaction')
    .description('Deletes a transaction owned by the authenticated user.')
    .tags('transactions')
    .operationId('deleteTransaction');

export const DashboardSummaryEndpoint = api.dashboard.summary
    .authorize(PrincipalSchema)
    .inject({ knex: KnexToken })
    .summary('Dashboard summary')
    .description('Returns period totals and latest transactions.')
    .tags('dashboard')
    .operationId('dashboardSummary');

export const StatsOverviewEndpoint = api.stats.overview
    .authorize(PrincipalSchema)
    .inject({ knex: KnexToken })
    .summary('Stats overview')
    .description('Returns expense and income stats for charts.')
    .tags('stats')
    .operationId('statsOverview');

export const endpoints = {
    auth: {
        register: RegisterEndpoint,
        login: LoginEndpoint,
        google: GoogleAuthEndpoint,
        me: GetMeEndpoint
    },
    users: {
        updatePreferences: UpdatePreferencesEndpoint
    },
    currencies: {
        list: ListCurrenciesEndpoint
    },
    categories: {
        list: ListCategoriesEndpoint,
        create: CreateCategoryEndpoint,
        update: UpdateCategoryEndpoint,
        delete: DeleteCategoryEndpoint
    },
    transactions: {
        list: ListTransactionsEndpoint,
        create: CreateTransactionEndpoint,
        update: UpdateTransactionEndpoint,
        delete: DeleteTransactionEndpoint
    },
    dashboard: {
        summary: DashboardSummaryEndpoint
    },
    stats: {
        overview: StatsOverviewEndpoint
    }
};
