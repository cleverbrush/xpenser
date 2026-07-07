import {
    boolean,
    type DbContext,
    date,
    defineEntity,
    type InferDatabaseRow,
    number,
    object,
    string
} from '@cleverbrush/orm';

export const UserDbSchema = object({
    id: number().primaryKey(),
    email: string(),
    passwordHash: string().optional().hasColumnName('password_hash'),
    emailVerified: boolean().hasColumnName('email_verified').defaultTo(false),
    emailVerificationTokenHash: string()
        .optional()
        .hasColumnName('email_verification_token_hash'),
    emailVerificationExpiresAt: date()
        .optional()
        .hasColumnName('email_verification_expires_at'),
    role: string(),
    authProvider: string().hasColumnName('auth_provider'),
    defaultCurrency: string().hasColumnName('default_currency'),
    countryCode: string().hasColumnName('country_code').defaultTo('US'),
    timezone: string().defaultTo('UTC'),
    mainBudgetId: number()
        .hasColumnName('main_budget_id')
        .references('budgets', 'id')
        .onDelete('SET NULL')
        .optional(),
    weeklyEmailReportEnabled: boolean()
        .hasColumnName('weekly_email_report_enabled')
        .defaultTo(true),
    monthlyEmailReportEnabled: boolean()
        .hasColumnName('monthly_email_report_enabled')
        .defaultTo(true),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
})
    .hasTableName('users')
    .projection(
        'public',
        'id',
        'email',
        'emailVerified',
        'role',
        'authProvider',
        'defaultCurrency',
        'countryCode',
        'timezone',
        'mainBudgetId',
        'weeklyEmailReportEnabled',
        'monthlyEmailReportEnabled',
        'createdAt',
        'updatedAt'
    )
    .projection(
        'auth',
        'id',
        'email',
        'passwordHash',
        'emailVerified',
        'emailVerificationTokenHash',
        'emailVerificationExpiresAt',
        'role',
        'authProvider',
        'defaultCurrency',
        'countryCode',
        'timezone',
        'mainBudgetId',
        'weeklyEmailReportEnabled',
        'monthlyEmailReportEnabled'
    );

export const BudgetFavoriteCurrencyDbSchema = object({
    budgetId: number()
        .hasColumnName('budget_id')
        .references('budgets', 'id')
        .onDelete('CASCADE'),
    currency: string()
})
    .hasTableName('budget_favorite_currencies')
    .hasPrimaryKey(['budgetId', 'currency'] as const);

export const TelegramAccountDbSchema = object({
    userId: number()
        .primaryKey()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE'),
    telegramUserId: string().hasColumnName('telegram_user_id'),
    telegramUsername: string().optional().hasColumnName('telegram_username'),
    telegramFirstName: string().optional().hasColumnName('telegram_first_name'),
    telegramLastName: string().optional().hasColumnName('telegram_last_name'),
    linkedAt: date().hasColumnName('linked_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
}).hasTableName('telegram_accounts');

export const TelegramLinkTokenDbSchema = object({
    id: number().primaryKey(),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE')
        .index('idx_telegram_link_tokens_user_id'),
    tokenHash: string().hasColumnName('token_hash'),
    expiresAt: date().hasColumnName('expires_at'),
    consumedAt: date().optional().hasColumnName('consumed_at'),
    createdAt: date().hasColumnName('created_at').defaultTo('now')
}).hasTableName('telegram_link_tokens');

export const BudgetDbSchema = object({
    id: number().primaryKey(),
    name: string(),
    defaultCurrency: string().hasColumnName('default_currency'),
    countryCode: string().hasColumnName('country_code').defaultTo('US'),
    createdByUserId: number()
        .hasColumnName('created_by_user_id')
        .references('users', 'id')
        .onDelete('SET NULL')
        .optional(),
    archivedAt: date().optional().hasColumnName('archived_at'),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
}).hasTableName('budgets');

export const BudgetMemberDbSchema = object({
    budgetId: number()
        .hasColumnName('budget_id')
        .references('budgets', 'id')
        .onDelete('CASCADE'),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE')
        .index('idx_budget_members_user_id'),
    displayName: string().hasColumnName('display_name'),
    role: string(),
    canCreateTransactions: boolean()
        .hasColumnName('can_create_transactions')
        .defaultTo(true),
    canUpdateTransactions: boolean()
        .hasColumnName('can_update_transactions')
        .defaultTo(false),
    canDeleteTransactions: boolean()
        .hasColumnName('can_delete_transactions')
        .defaultTo(false),
    canManageCategories: boolean()
        .hasColumnName('can_manage_categories')
        .defaultTo(false),
    canManageVendors: boolean()
        .hasColumnName('can_manage_vendors')
        .defaultTo(false),
    canManageTags: boolean().hasColumnName('can_manage_tags').defaultTo(false),
    canManageMembers: boolean()
        .hasColumnName('can_manage_members')
        .defaultTo(false),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
})
    .hasTableName('budget_members')
    .hasPrimaryKey(['budgetId', 'userId'] as const);

export const BudgetInvitationDbSchema = object({
    id: number().primaryKey(),
    budgetId: number()
        .hasColumnName('budget_id')
        .references('budgets', 'id')
        .onDelete('CASCADE')
        .index('idx_budget_invitations_budget_id'),
    invitedByUserId: number()
        .hasColumnName('invited_by_user_id')
        .references('users', 'id')
        .onDelete('CASCADE'),
    email: string(),
    role: string(),
    canCreateTransactions: boolean()
        .hasColumnName('can_create_transactions')
        .defaultTo(true),
    canUpdateTransactions: boolean()
        .hasColumnName('can_update_transactions')
        .defaultTo(false),
    canDeleteTransactions: boolean()
        .hasColumnName('can_delete_transactions')
        .defaultTo(false),
    canManageCategories: boolean()
        .hasColumnName('can_manage_categories')
        .defaultTo(false),
    canManageVendors: boolean()
        .hasColumnName('can_manage_vendors')
        .defaultTo(false),
    canManageTags: boolean().hasColumnName('can_manage_tags').defaultTo(false),
    canManageMembers: boolean()
        .hasColumnName('can_manage_members')
        .defaultTo(false),
    tokenHash: string()
        .hasColumnName('token_hash')
        .index('idx_budget_invitations_token_hash'),
    expiresAt: date().hasColumnName('expires_at'),
    consumedAt: date().optional().hasColumnName('consumed_at'),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
}).hasTableName('budget_invitations');

export const ApiKeyDbSchema = object({
    id: number().primaryKey(),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE')
        .index('idx_api_keys_user_id'),
    name: string(),
    keyId: string().hasColumnName('key_id').index('idx_api_keys_key_id'),
    keyPrefix: string().hasColumnName('key_prefix'),
    secretHash: string().hasColumnName('secret_hash'),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    lastUsedAt: date().optional().hasColumnName('last_used_at'),
    revokedAt: date().optional().hasColumnName('revoked_at')
}).hasTableName('api_keys');

export const McpOAuthClientDbSchema = object({
    id: number().primaryKey(),
    clientId: string()
        .hasColumnName('client_id')
        .index('idx_mcp_oauth_clients_client_id'),
    clientName: string().hasColumnName('client_name'),
    redirectUrisJson: string().hasColumnName('redirect_uris_json'),
    scope: string().defaultTo('mcp'),
    createdAt: date().hasColumnName('created_at').defaultTo('now')
}).hasTableName('mcp_oauth_clients');

export const McpOAuthGrantDbSchema = object({
    id: number().primaryKey(),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE')
        .index('idx_mcp_oauth_grants_user_id'),
    clientId: number()
        .hasColumnName('client_id')
        .references('mcp_oauth_clients', 'id')
        .onDelete('CASCADE')
        .index('idx_mcp_oauth_grants_client_id'),
    scope: string().defaultTo('mcp'),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    lastUsedAt: date().optional().hasColumnName('last_used_at'),
    revokedAt: date().optional().hasColumnName('revoked_at')
}).hasTableName('mcp_oauth_grants');

export const McpOAuthAuthorizationCodeDbSchema = object({
    id: number().primaryKey(),
    codeHash: string()
        .hasColumnName('code_hash')
        .index('idx_mcp_oauth_authorization_codes_code_hash'),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE'),
    clientId: number()
        .hasColumnName('client_id')
        .references('mcp_oauth_clients', 'id')
        .onDelete('CASCADE'),
    grantId: number()
        .hasColumnName('grant_id')
        .references('mcp_oauth_grants', 'id')
        .onDelete('CASCADE'),
    redirectUri: string().hasColumnName('redirect_uri'),
    codeChallenge: string().hasColumnName('code_challenge'),
    codeChallengeMethod: string().hasColumnName('code_challenge_method'),
    scope: string().defaultTo('mcp'),
    expiresAt: date().hasColumnName('expires_at'),
    consumedAt: date().optional().hasColumnName('consumed_at'),
    createdAt: date().hasColumnName('created_at').defaultTo('now')
}).hasTableName('mcp_oauth_authorization_codes');

export const McpOAuthRefreshTokenDbSchema = object({
    id: number().primaryKey(),
    tokenHash: string()
        .hasColumnName('token_hash')
        .index('idx_mcp_oauth_refresh_tokens_token_hash'),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE'),
    clientId: number()
        .hasColumnName('client_id')
        .references('mcp_oauth_clients', 'id')
        .onDelete('CASCADE'),
    grantId: number()
        .hasColumnName('grant_id')
        .references('mcp_oauth_grants', 'id')
        .onDelete('CASCADE')
        .index('idx_mcp_oauth_refresh_tokens_grant_id'),
    expiresAt: date().hasColumnName('expires_at'),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    lastUsedAt: date().optional().hasColumnName('last_used_at'),
    revokedAt: date().optional().hasColumnName('revoked_at')
}).hasTableName('mcp_oauth_refresh_tokens');

export const CategoryDbSchema = object({
    id: number().primaryKey(),
    budgetId: number()
        .hasColumnName('budget_id')
        .references('budgets', 'id')
        .onDelete('CASCADE')
        .index('idx_categories_budget_id'),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE')
        .index('idx_categories_user_id'),
    parentId: number()
        .hasColumnName('parent_id')
        .references('categories', 'id')
        .onDelete('RESTRICT')
        .index('idx_categories_parent_id')
        .optional(),
    name: string(),
    type: string(),
    kind: string().defaultTo('normal'),
    archivedAt: date().optional().hasColumnName('archived_at'),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
}).hasTableName('categories');

export const VendorDbSchema = object({
    id: number().primaryKey(),
    budgetId: number()
        .hasColumnName('budget_id')
        .references('budgets', 'id')
        .onDelete('CASCADE')
        .index('idx_vendors_budget_id'),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE')
        .index('idx_vendors_user_id'),
    name: string(),
    normalizedName: string()
        .hasColumnName('normalized_name')
        .index('idx_vendors_user_normalized_name'),
    resolvedName: string().optional().hasColumnName('resolved_name'),
    domain: string().optional(),
    description: string().optional(),
    logoUrl: string().optional().hasColumnName('logo_url'),
    primaryColor: string().optional().hasColumnName('primary_color'),
    enrichmentProvider: string()
        .optional()
        .hasColumnName('enrichment_provider'),
    enrichmentStatus: string().optional().hasColumnName('enrichment_status'),
    enrichedAt: date().optional().hasColumnName('enriched_at'),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
}).hasTableName('vendors');

export const TransactionDbSchema = object({
    id: number().primaryKey(),
    budgetId: number()
        .hasColumnName('budget_id')
        .references('budgets', 'id')
        .onDelete('CASCADE')
        .index('idx_transactions_budget_id'),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE')
        .index('idx_transactions_user_id'),
    categoryId: number()
        .hasColumnName('category_id')
        .references('categories', 'id')
        .onDelete('RESTRICT')
        .index('idx_transactions_category_id'),
    vendorId: number()
        .hasColumnName('vendor_id')
        .references('vendors', 'id')
        .onDelete('SET NULL')
        .index('idx_transactions_vendor_id')
        .optional(),
    type: string(),
    amount: number(),
    currency: string(),
    defaultCurrencyAmount: number().hasColumnName('default_currency_amount'),
    defaultCurrency: string().hasColumnName('default_currency'),
    exchangeRate: number().hasColumnName('exchange_rate'),
    exchangeRateDate: string().hasColumnName('exchange_rate_date'),
    occurredAt: date().hasColumnName('occurred_at'),
    note: string().optional(),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now'),
    category: CategoryDbSchema.optional()
}).hasTableName('transactions');

export const TransactionTagDbSchema = object({
    id: number().primaryKey(),
    budgetId: number()
        .hasColumnName('budget_id')
        .references('budgets', 'id')
        .onDelete('CASCADE')
        .index('idx_transaction_tags_budget_id'),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE')
        .index('idx_transaction_tags_user_id'),
    name: string(),
    normalizedName: string().hasColumnName('normalized_name'),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
}).hasTableName('transaction_tags');

export const TransactionTagLinkDbSchema = object({
    transactionId: number()
        .hasColumnName('transaction_id')
        .references('transactions', 'id')
        .onDelete('CASCADE'),
    tagId: number()
        .hasColumnName('tag_id')
        .references('transaction_tags', 'id')
        .onDelete('CASCADE'),
    createdAt: date().hasColumnName('created_at').defaultTo('now')
})
    .hasTableName('transaction_tag_links')
    .hasPrimaryKey(['transactionId', 'tagId'] as const);

export const TransactionScanDbSchema = object({
    id: number().primaryKey(),
    budgetId: number()
        .hasColumnName('budget_id')
        .references('budgets', 'id')
        .onDelete('CASCADE')
        .index('idx_transaction_scans_budget_id'),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE')
        .index('idx_transaction_scans_user_id'),
    documentKind: string().hasColumnName('document_kind'),
    imageHash: string().hasColumnName('image_hash'),
    model: string(),
    warningsJson: string().hasColumnName('warnings_json'),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
}).hasTableName('transaction_scans');

export const TransactionScanItemDbSchema = object({
    id: number().primaryKey(),
    budgetId: number()
        .hasColumnName('budget_id')
        .references('budgets', 'id')
        .onDelete('CASCADE')
        .index('idx_transaction_scan_items_budget_id'),
    scanId: number()
        .hasColumnName('scan_id')
        .references('transaction_scans', 'id')
        .onDelete('CASCADE')
        .index('idx_transaction_scan_items_scan_id'),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE')
        .index('idx_transaction_scan_items_user_id'),
    draftJson: string().hasColumnName('draft_json'),
    decision: string().optional(),
    correctedJson: string().hasColumnName('corrected_json').optional(),
    transactionId: number()
        .hasColumnName('transaction_id')
        .references('transactions', 'id')
        .onDelete('SET NULL')
        .optional(),
    createdCategoryId: number()
        .hasColumnName('created_category_id')
        .references('categories', 'id')
        .onDelete('SET NULL')
        .optional(),
    createdVendorId: number()
        .hasColumnName('created_vendor_id')
        .references('vendors', 'id')
        .onDelete('SET NULL')
        .optional(),
    decidedAt: date().hasColumnName('decided_at').optional(),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
}).hasTableName('transaction_scan_items');

export const TransactionScanImageDbSchema = object({
    id: number().primaryKey(),
    budgetId: number()
        .hasColumnName('budget_id')
        .references('budgets', 'id')
        .onDelete('CASCADE')
        .index('idx_transaction_scan_images_budget_id'),
    scanId: number()
        .hasColumnName('scan_id')
        .references('transaction_scans', 'id')
        .onDelete('CASCADE')
        .index('idx_transaction_scan_images_scan_id'),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE')
        .index('idx_transaction_scan_images_user_id'),
    imageHash: string().hasColumnName('image_hash'),
    mimeType: string().hasColumnName('mime_type'),
    fileName: string().hasColumnName('file_name').optional(),
    sizeBytes: number().hasColumnName('size_bytes'),
    imageBase64: string().hasColumnName('image_base64'),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
}).hasTableName('transaction_scan_images');

export const ExchangeRateDbSchema = object({
    id: number().primaryKey(),
    baseCurrency: string().hasColumnName('base_currency'),
    quoteCurrency: string().hasColumnName('quote_currency'),
    rateDate: string().hasColumnName('rate_date'),
    rate: number(),
    createdAt: date().hasColumnName('created_at').defaultTo('now')
}).hasTableName('exchange_rates');

export const UserEntity = defineEntity(UserDbSchema);
export const BudgetFavoriteCurrencyEntity = defineEntity(
    BudgetFavoriteCurrencyDbSchema
);

export const ExternalIdentityDbSchema = object({
    provider: string(),
    providerSubject: string().hasColumnName('provider_subject'),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE'),
    email: string(),
    createdAt: date().hasColumnName('created_at').defaultTo('now')
})
    .hasTableName('external_identities')
    .hasPrimaryKey(['provider', 'providerSubject'] as const);

export const ExternalIdentityEntity = defineEntity(ExternalIdentityDbSchema);
export const TelegramAccountEntity = defineEntity(TelegramAccountDbSchema);
export const TelegramLinkTokenEntity = defineEntity(TelegramLinkTokenDbSchema);
export const BudgetEntity = defineEntity(BudgetDbSchema);
export const BudgetMemberEntity = defineEntity(BudgetMemberDbSchema);
export const BudgetInvitationEntity = defineEntity(BudgetInvitationDbSchema);
export const ApiKeyEntity = defineEntity(ApiKeyDbSchema);
export const McpOAuthClientEntity = defineEntity(McpOAuthClientDbSchema);
export const McpOAuthGrantEntity = defineEntity(McpOAuthGrantDbSchema);
export const McpOAuthAuthorizationCodeEntity = defineEntity(
    McpOAuthAuthorizationCodeDbSchema
);
export const McpOAuthRefreshTokenEntity = defineEntity(
    McpOAuthRefreshTokenDbSchema
);
export const CategoryEntity = defineEntity(CategoryDbSchema);
export const VendorEntity = defineEntity(VendorDbSchema);
export const TransactionEntity = defineEntity(TransactionDbSchema).belongsTo(
    t => t.category,
    l => l.categoryId,
    r => r.id
);
export const TransactionTagEntity = defineEntity(TransactionTagDbSchema);
export const TransactionTagLinkEntity = defineEntity(
    TransactionTagLinkDbSchema
);
export const TransactionScanEntity = defineEntity(TransactionScanDbSchema);
export const TransactionScanItemEntity = defineEntity(
    TransactionScanItemDbSchema
);
export const TransactionScanImageEntity = defineEntity(
    TransactionScanImageDbSchema
);
export const ExchangeRateEntity = defineEntity(ExchangeRateDbSchema);

export const entityMap = {
    users: UserEntity,
    budgetFavoriteCurrencies: BudgetFavoriteCurrencyEntity,
    externalIdentities: ExternalIdentityEntity,
    telegramAccounts: TelegramAccountEntity,
    telegramLinkTokens: TelegramLinkTokenEntity,
    budgets: BudgetEntity,
    budgetMembers: BudgetMemberEntity,
    budgetInvitations: BudgetInvitationEntity,
    apiKeys: ApiKeyEntity,
    mcpOAuthClients: McpOAuthClientEntity,
    mcpOAuthGrants: McpOAuthGrantEntity,
    mcpOAuthAuthorizationCodes: McpOAuthAuthorizationCodeEntity,
    mcpOAuthRefreshTokens: McpOAuthRefreshTokenEntity,
    categories: CategoryEntity,
    vendors: VendorEntity,
    transactions: TransactionEntity,
    transactionTags: TransactionTagEntity,
    transactionTagLinks: TransactionTagLinkEntity,
    transactionScans: TransactionScanEntity,
    transactionScanItems: TransactionScanItemEntity,
    transactionScanImages: TransactionScanImageEntity,
    exchangeRates: ExchangeRateEntity
};

export type AppEntityMap = typeof entityMap;
export type AppDb = DbContext<AppEntityMap>;

type DbRow<T extends Parameters<typeof defineEntity>[0]> = Readonly<
    InferDatabaseRow<T>
>;

export type UserDb = DbRow<typeof UserDbSchema>;
export type ExternalIdentityDb = DbRow<typeof ExternalIdentityDbSchema>;
export type BudgetDb = DbRow<typeof BudgetDbSchema>;
export type BudgetMemberDb = DbRow<typeof BudgetMemberDbSchema>;
export type BudgetInvitationDb = DbRow<typeof BudgetInvitationDbSchema>;
export type VendorDb = DbRow<typeof VendorDbSchema>;
export type TelegramAccountDb = DbRow<typeof TelegramAccountDbSchema>;
export type TelegramLinkTokenDb = DbRow<typeof TelegramLinkTokenDbSchema>;
export type ApiKeyDb = DbRow<typeof ApiKeyDbSchema>;
export type McpOAuthClientDb = DbRow<typeof McpOAuthClientDbSchema>;
export type McpOAuthGrantDb = DbRow<typeof McpOAuthGrantDbSchema>;
export type McpOAuthAuthorizationCodeDb = DbRow<
    typeof McpOAuthAuthorizationCodeDbSchema
>;
export type McpOAuthRefreshTokenDb = DbRow<typeof McpOAuthRefreshTokenDbSchema>;
export type TransactionTagDb = DbRow<typeof TransactionTagDbSchema>;
export type TransactionTagLinkDb = DbRow<typeof TransactionTagLinkDbSchema>;
export type TransactionScanDb = DbRow<typeof TransactionScanDbSchema>;
export type TransactionScanItemDb = DbRow<typeof TransactionScanItemDbSchema>;

export type CategoryDb = Readonly<
    Omit<InferDatabaseRow<typeof CategoryDbSchema>, 'kind' | 'type'> & {
        kind: 'normal' | 'offset';
        type: 'expense' | 'income';
    }
>;

export type TransactionDb = Readonly<
    Omit<
        InferDatabaseRow<typeof TransactionDbSchema>,
        | 'amount'
        | 'category'
        | 'defaultCurrencyAmount'
        | 'exchangeRate'
        | 'type'
    > & {
        amount: string | number;
        category?: CategoryDb | null;
        defaultCurrencyAmount: string | number;
        exchangeRate: string | number;
        type: 'expense' | 'income';
    }
>;

export type TransactionScanImageDb = Readonly<
    Omit<InferDatabaseRow<typeof TransactionScanImageDbSchema>, 'mimeType'> & {
        mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    }
>;
