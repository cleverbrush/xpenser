import { api, PrincipalSchema } from '@xpenser/contracts';
import { ConfigToken, DbToken, KnexToken, LoggerToken } from '../di/tokens.js';

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

export const GoogleSignInEndpoint = api.auth.googleSignIn
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Direct Google sign-in')
    .description(
        'Maps an Auth.js Google identity to a local xpenser user and issues an API JWT.'
    )
    .tags('auth')
    .operationId('googleSignIn');

export const SessionTokenEndpoint = api.auth.sessionToken
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Web session token')
    .description(
        'Issues a fresh xpenser API JWT for a trusted authenticated web session.'
    )
    .tags('auth')
    .operationId('sessionToken');

export const SingleUserSessionTokenEndpoint = api.auth.singleUserSessionToken
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Single-user web session token')
    .description(
        'Issues an API JWT for the configured single-user self-hosted deployment.'
    )
    .tags('auth')
    .operationId('singleUserSessionToken');

export const GetMeEndpoint = api.auth.me
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Current user')
    .description(
        'Returns preferences, accessible budgets, and derived transaction currency ordering for the authenticated user.'
    )
    .tags('users')
    .operationId('getCurrentUser');

export const UpdatePreferencesEndpoint = api.users.updatePreferences
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Update preferences')
    .description(
        'Updates the current user country, timezone, and email report preferences.'
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

export const UpdateUserAvatarEndpoint = api.users.updateAvatar
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Update user avatar')
    .description('Stores a manually uploaded avatar for the current user.')
    .tags('users')
    .operationId('updateUserAvatar');

export const DeleteUserAvatarEndpoint = api.users.deleteAvatar
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Delete user avatar')
    .description('Removes the current user manually uploaded avatar.')
    .tags('users')
    .operationId('deleteUserAvatar');

export const UserAvatarImageEndpoint = api.users.avatarImage
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('User avatar image')
    .description('Streams a stored avatar image visible to the current user.')
    .tags('users')
    .operationId('userAvatarImage');

export const ListBudgetsEndpoint = api.budgets.list
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('List budgets')
    .description('Lists budgets accessible to the authenticated user.')
    .tags('budgets')
    .operationId('listBudgets');

export const CreateBudgetEndpoint = api.budgets.create
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Create budget')
    .description('Creates a new budget with the current user as admin.')
    .tags('budgets')
    .operationId('createBudget');

export const UpdateBudgetEndpoint = api.budgets.update
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Update budget')
    .description('Updates budget name, defaults, or archive state.')
    .tags('budgets')
    .operationId('updateBudget');

export const DeleteBudgetEndpoint = api.budgets.delete
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Delete budget')
    .description('Permanently deletes an archived non-main budget.')
    .tags('budgets')
    .operationId('deleteBudget');

export const ListBudgetMembersEndpoint = api.budgets.members
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('List budget members')
    .description('Lists members for a budget the current user can manage.')
    .tags('budgets')
    .operationId('listBudgetMembers');

export const ListBudgetAccessEndpoint = api.budgets.access
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('List budget access')
    .description(
        'Lists active members and invitation statuses for a budget the current user can manage.'
    )
    .tags('budgets')
    .operationId('listBudgetAccess');

export const InviteBudgetMemberEndpoint = api.budgets.invite
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Invite budget member')
    .description('Sends a magic link invitation for an existing user.')
    .tags('budgets')
    .operationId('inviteBudgetMember');

export const UpdateBudgetMemberEndpoint = api.budgets.updateMember
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Update budget member')
    .description('Updates budget member role and permissions.')
    .tags('budgets')
    .operationId('updateBudgetMember');

export const RemoveBudgetMemberEndpoint = api.budgets.removeMember
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Remove budget member')
    .description('Removes a user from a shared budget.')
    .tags('budgets')
    .operationId('removeBudgetMember');

export const AcceptBudgetInvitationEndpoint = api.budgets.acceptInvitation
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Accept budget invitation')
    .description('Consumes a budget invitation magic link.')
    .tags('budgets')
    .operationId('acceptBudgetInvitation');

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

export const ListMcpOAuthConnectionsEndpoint = api.users.listMcpOAuthConnections
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('List MCP connections')
    .description('Lists active MCP OAuth connections for the current user.')
    .tags('mcp')
    .operationId('listMcpOAuthConnections');

export const RevokeMcpOAuthConnectionEndpoint =
    api.users.revokeMcpOAuthConnection
        .authorize(PrincipalSchema)
        .inject({ db: DbToken })
        .summary('Revoke MCP connection')
        .description(
            'Revokes an MCP OAuth connection owned by the current user.'
        )
        .tags('mcp')
        .operationId('revokeMcpOAuthConnection');

export const McpOAuthAuthorizationRequestEndpoint =
    api.oauth.authorizationRequest
        .authorize(PrincipalSchema)
        .inject({ db: DbToken })
        .summary('MCP OAuth authorization request')
        .description(
            'Validates an MCP OAuth authorization request before user approval.'
        )
        .tags('mcp')
        .operationId('mcpOAuthAuthorizationRequest');

export const McpOAuthAuthorizeEndpoint = api.oauth.authorize
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Approve MCP OAuth')
    .description('Approves an MCP OAuth authorization request for the user.')
    .tags('mcp')
    .operationId('mcpOAuthAuthorize');

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
        'Converts an entered amount to the selected budget default currency.'
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

export const ListVendorsEndpoint = api.vendors.list
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('List vendors')
    .description('Lists vendors owned by the authenticated user.')
    .tags('vendors')
    .operationId('listVendors');

export const SearchVendorCandidatesEndpoint = api.vendors.searchCandidates
    .authorize(PrincipalSchema)
    .inject({ config: ConfigToken })
    .summary('Search vendors')
    .description('Searches Brandfetch for vendor candidates.')
    .tags('vendors')
    .operationId('searchVendorCandidates');

export const VendorCandidateDetailsEndpoint = api.vendors.candidateDetails
    .authorize(PrincipalSchema)
    .inject({ config: ConfigToken })
    .summary('Get vendor candidate details')
    .description('Gets Brandfetch details for a selected vendor candidate.')
    .tags('vendors')
    .operationId('getVendorCandidateDetails');

export const GetVendorEndpoint = api.vendors.get
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Get vendor')
    .description('Gets one vendor owned by the authenticated user.')
    .tags('vendors')
    .operationId('getVendor');

export const CreateVendorEndpoint = api.vendors.create
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Create vendor')
    .description('Creates or reuses a user-owned vendor.')
    .tags('vendors')
    .operationId('createVendor');

export const UpdateVendorEndpoint = api.vendors.update
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, logger: LoggerToken })
    .summary('Update vendor')
    .description('Updates editable vendor metadata.')
    .tags('vendors')
    .operationId('updateVendor');

export const EnrichVendorEndpoint = api.vendors.enrich
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Retry vendor enrichment')
    .description('Retries vendor enrichment for a user-owned vendor.')
    .tags('vendors')
    .operationId('enrichVendor');

export const ListTransactionsEndpoint = api.transactions.list
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, knex: KnexToken })
    .summary('List transactions')
    .description('Lists transactions owned by the authenticated user.')
    .tags('transactions')
    .operationId('listTransactions');

export const ExportTransactionsCsvEndpoint = api.transactions.exportCsv
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, config: ConfigToken, knex: KnexToken })
    .summary('Export transactions CSV')
    .description(
        'Exports matching transactions to CSV with selected currency amount columns.'
    )
    .tags('transactions')
    .operationId('exportTransactionsCsv');

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

export const ListTransactionTagsEndpoint = api.transactionTags.list
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('List transaction tags')
    .description('Lists transaction tags owned by the authenticated user.')
    .tags('transaction-tags')
    .operationId('listTransactionTags');

export const DeleteTransactionEndpoint = api.transactions.delete
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Delete transaction')
    .description('Deletes a transaction owned by the authenticated user.')
    .tags('transactions')
    .operationId('deleteTransaction');

export const GetTransactionScanImageEndpoint = api.transactions.scanImage
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, knex: KnexToken })
    .summary('Get scanned transaction image')
    .description(
        'Returns the original scanner image attached to a confirmed transaction.'
    )
    .tags('transactions')
    .operationId('getTransactionScanImage');

export const CreateTransactionScanEndpoint = api.transactionScans.create
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Scan transaction image')
    .description(
        'Extracts draft transactions from an uploaded receipt, invoice, bank app screenshot, or statement image.'
    )
    .tags('transaction-scans')
    .operationId('createTransactionScan');

export const StartTransactionScanJobEndpoint = api.transactionScans.start
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Start transaction image scan')
    .description(
        'Starts an asynchronous multimodal scan job and returns a short-lived progress token.'
    )
    .tags('transaction-scans')
    .operationId('startTransactionScanJob');

export const TransactionScanProgressEndpoint = api.transactionScans.progress
    .summary('Transaction image scan progress')
    .description(
        'Streams progress and the final scan result for a short-lived scan job token.'
    )
    .tags('transaction-scans')
    .operationId('transactionScanProgress');

export const TransactionScanJobStatusEndpoint = api.transactionScans.status
    .summary('Transaction image scan job status')
    .description(
        'Returns the latest progress event for a short-lived scan job token.'
    )
    .tags('transaction-scans')
    .operationId('transactionScanJobStatus');

export const DecideTransactionScanItemEndpoint = api.transactionScans.decide
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Record transaction scan decision')
    .description(
        'Records whether a scanned draft was confirmed or discarded, including user corrections for future scans.'
    )
    .tags('transaction-scans')
    .operationId('decideTransactionScanItem');

export const DashboardSummaryEndpoint = api.dashboard.summary
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, config: ConfigToken })
    .summary('Dashboard summary')
    .description('Returns period totals and category distributions.')
    .tags('dashboard')
    .operationId('dashboardSummary');

export const DashboardWindowEndpoint = api.dashboard.window
    .authorize(PrincipalSchema)
    .inject({ db: DbToken, config: ConfigToken })
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

export const StatsTagReportEndpoint = api.stats.tags
    .authorize(PrincipalSchema)
    .inject({ db: DbToken })
    .summary('Tag report')
    .description('Returns expense tag distribution and selected tag detail.')
    .tags('stats')
    .operationId('statsTagReport');

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
        googleSignIn: GoogleSignInEndpoint,
        sessionToken: SessionTokenEndpoint,
        singleUserSessionToken: SingleUserSessionTokenEndpoint,
        me: GetMeEndpoint
    },
    users: {
        updatePreferences: UpdatePreferencesEndpoint,
        telegramStatus: TelegramStatusEndpoint,
        createTelegramLinkToken: CreateTelegramLinkTokenEndpoint,
        disconnectTelegram: DisconnectTelegramEndpoint,
        updateAvatar: UpdateUserAvatarEndpoint,
        deleteAvatar: DeleteUserAvatarEndpoint,
        avatarImage: UserAvatarImageEndpoint,
        listApiKeys: ListApiKeysEndpoint,
        createApiKey: CreateApiKeyEndpoint,
        revokeApiKey: RevokeApiKeyEndpoint,
        listMcpOAuthConnections: ListMcpOAuthConnectionsEndpoint,
        revokeMcpOAuthConnection: RevokeMcpOAuthConnectionEndpoint
    },
    budgets: {
        list: ListBudgetsEndpoint,
        create: CreateBudgetEndpoint,
        update: UpdateBudgetEndpoint,
        delete: DeleteBudgetEndpoint,
        members: ListBudgetMembersEndpoint,
        access: ListBudgetAccessEndpoint,
        invite: InviteBudgetMemberEndpoint,
        updateMember: UpdateBudgetMemberEndpoint,
        removeMember: RemoveBudgetMemberEndpoint,
        acceptInvitation: AcceptBudgetInvitationEndpoint
    },
    oauth: {
        authorizationRequest: McpOAuthAuthorizationRequestEndpoint,
        authorize: McpOAuthAuthorizeEndpoint
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
    vendors: {
        searchCandidates: SearchVendorCandidatesEndpoint,
        candidateDetails: VendorCandidateDetailsEndpoint,
        list: ListVendorsEndpoint,
        get: GetVendorEndpoint,
        create: CreateVendorEndpoint,
        update: UpdateVendorEndpoint,
        enrich: EnrichVendorEndpoint
    },
    transactions: {
        list: ListTransactionsEndpoint,
        exportCsv: ExportTransactionsCsvEndpoint,
        create: CreateTransactionEndpoint,
        update: UpdateTransactionEndpoint,
        delete: DeleteTransactionEndpoint,
        scanImage: GetTransactionScanImageEndpoint
    },
    transactionTags: {
        list: ListTransactionTagsEndpoint
    },
    transactionScans: {
        create: CreateTransactionScanEndpoint,
        start: StartTransactionScanJobEndpoint,
        progress: TransactionScanProgressEndpoint,
        status: TransactionScanJobStatusEndpoint,
        decide: DecideTransactionScanItemEndpoint
    },
    dashboard: {
        summary: DashboardSummaryEndpoint,
        window: DashboardWindowEndpoint
    },
    stats: {
        overview: StatsOverviewEndpoint,
        window: StatsWindowEndpoint,
        tags: StatsTagReportEndpoint,
        categoryTrend: CategoryTrendEndpoint
    }
};
