import { api, PrincipalSchema } from '@xpenser/contracts';
import { ConfigToken, DbToken, LoggerToken } from '../di/tokens.js';

export const RegisterEndpoint = api.auth.register
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Register')
    .description('Creates a local account and returns an API JWT.')
    .tags('auth')
    .operationId('register');

export const LoginEndpoint = api.auth.login
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Login')
    .description('Authenticates a local account and returns an API JWT.')
    .tags('auth')
    .operationId('login');

export const GoogleAuthEndpoint = api.auth.google
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Google authentication')
    .description('Verifies a Google token and returns an API JWT.')
    .tags('auth')
    .operationId('googleAuth');

export const GetMeEndpoint = api.auth.me
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Current user')
    .description('Returns preferences for the authenticated user.')
    .tags('users')
    .operationId('getCurrentUser');

export const UpdatePreferencesEndpoint = api.users.updatePreferences
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Update preferences')
    .description('Updates the current user default and favorite currencies.')
    .tags('users')
    .operationId('updateUserPreferences');

export const TelegramStatusEndpoint = api.users.telegramStatus
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Telegram connection status')
    .description('Returns Telegram linking status for the current user.')
    .tags('users')
    .operationId('telegramConnectionStatus');

export const CreateTelegramLinkTokenEndpoint = api.users.createTelegramLinkToken
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Create Telegram link token')
    .description(
        'Creates a short-lived Telegram deep link for the current user.'
    )
    .tags('users')
    .operationId('createTelegramLinkToken');

export const DisconnectTelegramEndpoint = api.users.disconnectTelegram
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Disconnect Telegram')
    .description('Disconnects Telegram from the current user.')
    .tags('users')
    .operationId('disconnectTelegram');

export const LinkTelegramEndpoint = api.telegram.link
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Link Telegram account')
    .description('Consumes a Telegram deep link token from the bot service.')
    .tags('telegram')
    .operationId('linkTelegramAccount');

export const TelegramTokenEndpoint = api.telegram.token
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Telegram token exchange')
    .description('Exchanges a linked Telegram user for a short-lived API JWT.')
    .tags('telegram')
    .operationId('telegramToken');

export const ListCurrenciesEndpoint = api.currencies.list
    .inject({ config: ConfigToken })
    .summary('List currencies')
    .description('Returns active currencies available from Frankfurter.')
    .tags('currencies')
    .operationId('listCurrencies');

export const ListCategoriesEndpoint = api.categories.list
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('List categories')
    .description('Lists categories owned by the authenticated user.')
    .tags('categories')
    .operationId('listCategories');

export const CreateCategoryEndpoint = api.categories.create
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Create category')
    .description('Creates a user-owned income or expense category.')
    .tags('categories')
    .operationId('createCategory');

export const UpdateCategoryEndpoint = api.categories.update
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Update category')
    .description('Updates a user-owned category.')
    .tags('categories')
    .operationId('updateCategory');

export const DeleteCategoryEndpoint = api.categories.delete
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Delete category')
    .description('Deletes an unused user-owned category.')
    .tags('categories')
    .operationId('deleteCategory');

export const ListTransactionsEndpoint = api.transactions.list
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('List transactions')
    .description('Lists transactions owned by the authenticated user.')
    .tags('transactions')
    .operationId('listTransactions');

export const CreateTransactionEndpoint = api.transactions.create
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, config: ConfigToken, logger: LoggerToken })
    .summary('Create transaction')
    .description(
        'Creates a transaction and stores its historical exchange rate.'
    )
    .tags('transactions')
    .operationId('createTransaction');

export const UpdateTransactionEndpoint = api.transactions.update
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Update transaction')
    .description('Updates a transaction and recalculates converted values.')
    .tags('transactions')
    .operationId('updateTransaction');

export const DeleteTransactionEndpoint = api.transactions.delete
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Delete transaction')
    .description('Deletes a transaction owned by the authenticated user.')
    .tags('transactions')
    .operationId('deleteTransaction');

export const DashboardSummaryEndpoint = api.dashboard.summary
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Dashboard summary')
    .description('Returns period totals and latest transactions.')
    .tags('dashboard')
    .operationId('dashboardSummary');

export const StatsOverviewEndpoint = api.stats.overview
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
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
        updatePreferences: UpdatePreferencesEndpoint,
        telegramStatus: TelegramStatusEndpoint,
        createTelegramLinkToken: CreateTelegramLinkTokenEndpoint,
        disconnectTelegram: DisconnectTelegramEndpoint
    },
    telegram: {
        link: LinkTelegramEndpoint,
        token: TelegramTokenEndpoint
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
