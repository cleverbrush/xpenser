import { api, PrincipalSchema } from '@xpenser/contracts';
import { ConfigToken, DbToken, LoggerToken } from '../di/tokens.js';

export const RegisterEndpoint = api.auth.register
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Register')
    .description(
        'Creates a local account and sends an email confirmation magic link.'
    )
    .tags('auth')
    .operationId('register');

export const LoginEndpoint = api.auth.login
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Login')
    .description('Authenticates a local account and returns an API JWT.')
    .tags('auth')
    .operationId('login');

export const ConfirmEmailEndpoint = api.auth.confirmEmail
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Confirm email')
    .description(
        'Consumes an email confirmation magic link and returns an API JWT.'
    )
    .tags('auth')
    .operationId('confirmEmail');

export const ResendEmailConfirmationEndpoint = api.auth.resendEmailConfirmation
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Resend email confirmation')
    .description('Sends a fresh email confirmation magic link when needed.')
    .tags('auth')
    .operationId('resendEmailConfirmation');

export const PassportResolveUserEndpoint = api.auth.passportResolveUser
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Passport user resolution')
    .description('Maps a Passport Google identity to a local xpenser user.')
    .tags('auth')
    .operationId('passportResolveUser');

export const PassportExchangeEndpoint = api.auth.passportExchange
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Passport code exchange')
    .description(
        'Exchanges a Passport authorization code for an xpenser API JWT.'
    )
    .tags('auth')
    .operationId('passportExchange');

export const SessionTokenEndpoint = api.auth.sessionToken
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Web session token')
    .description(
        'Issues a fresh xpenser API JWT for a trusted authenticated web session.'
    )
    .tags('auth')
    .operationId('sessionToken');

export const GetMeEndpoint = api.auth.me
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Current user')
    .description(
        'Returns preferences and transaction currency ordering for the authenticated user.'
    )
    .tags('users')
    .operationId('getCurrentUser');

export const UpdatePreferencesEndpoint = api.users.updatePreferences
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Update preferences')
    .description(
        'Updates the current user default currency, favorite currencies, and timezone.'
    )
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

export const ListApiKeysEndpoint = api.users.listApiKeys
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('List API keys')
    .description('Lists active API keys for the current user.')
    .tags('api-keys')
    .operationId('listApiKeys');

export const CreateApiKeyEndpoint = api.users.createApiKey
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Create API key')
    .description(
        'Creates a user API key and returns its plaintext secret once.'
    )
    .tags('api-keys')
    .operationId('createApiKey');

export const RevokeApiKeyEndpoint = api.users.revokeApiKey
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Revoke API key')
    .description('Revokes an API key owned by the current user.')
    .tags('api-keys')
    .operationId('revokeApiKey');

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
    .inject({ config: ConfigToken, logger: LoggerToken })
    .summary('List currencies')
    .description(
        'Returns the live Frankfurter currency list, or a bundled full fallback catalog when Frankfurter is unavailable.'
    )
    .tags('currencies')
    .operationId('listCurrencies');

export const ConvertCurrencyEndpoint = api.currencies.convert
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Convert currency')
    .description(
        'Converts an entered amount to the authenticated user default currency.'
    )
    .tags('currencies')
    .operationId('convertCurrency');

export const ListCategoriesEndpoint = api.categories.list
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('List categories')
    .description(
        'Lists categories owned by the authenticated user, optionally ordered by recent transaction count.'
    )
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

export const MoveAndDeleteCategoryEndpoint = api.categories.moveAndDelete
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Move transactions and delete category')
    .description(
        'Moves transactions from a leaf category into another same-type category, then deletes the source category.'
    )
    .tags('categories')
    .operationId('moveAndDeleteCategory');

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
    .description('Returns period totals and category distributions.')
    .tags('dashboard')
    .operationId('dashboardSummary');

export const DashboardWindowEndpoint = api.dashboard.window
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Dashboard summary window')
    .description('Returns adjacent dashboard summaries for smooth navigation.')
    .tags('dashboard')
    .operationId('dashboardWindow');

export const StatsOverviewEndpoint = api.stats.overview
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Stats overview')
    .description('Returns expense and income stats for charts.')
    .tags('stats')
    .operationId('statsOverview');

export const StatsWindowEndpoint = api.stats.window
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Stats overview window')
    .description('Returns adjacent stats overviews for smooth navigation.')
    .tags('stats')
    .operationId('statsWindow');

export const CategoryTrendEndpoint = api.stats.categoryTrend
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Category trend')
    .description('Returns one category total across configurable time buckets.')
    .tags('stats')
    .operationId('categoryTrend');

export const endpoints = {
    auth: {
        register: RegisterEndpoint,
        login: LoginEndpoint,
        confirmEmail: ConfirmEmailEndpoint,
        resendEmailConfirmation: ResendEmailConfirmationEndpoint,
        passportResolveUser: PassportResolveUserEndpoint,
        passportExchange: PassportExchangeEndpoint,
        sessionToken: SessionTokenEndpoint,
        me: GetMeEndpoint
    },
    users: {
        updatePreferences: UpdatePreferencesEndpoint,
        telegramStatus: TelegramStatusEndpoint,
        createTelegramLinkToken: CreateTelegramLinkTokenEndpoint,
        disconnectTelegram: DisconnectTelegramEndpoint,
        listApiKeys: ListApiKeysEndpoint,
        createApiKey: CreateApiKeyEndpoint,
        revokeApiKey: RevokeApiKeyEndpoint
    },
    telegram: {
        link: LinkTelegramEndpoint,
        token: TelegramTokenEndpoint
    },
    currencies: {
        list: ListCurrenciesEndpoint,
        convert: ConvertCurrencyEndpoint
    },
    categories: {
        list: ListCategoriesEndpoint,
        create: CreateCategoryEndpoint,
        update: UpdateCategoryEndpoint,
        delete: DeleteCategoryEndpoint,
        moveAndDelete: MoveAndDeleteCategoryEndpoint
    },
    transactions: {
        list: ListTransactionsEndpoint,
        create: CreateTransactionEndpoint,
        update: UpdateTransactionEndpoint,
        delete: DeleteTransactionEndpoint
    },
    dashboard: {
        summary: DashboardSummaryEndpoint,
        window: DashboardWindowEndpoint
    },
    stats: {
        overview: StatsOverviewEndpoint,
        window: StatsWindowEndpoint,
        categoryTrend: CategoryTrendEndpoint
    }
};
