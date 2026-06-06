import {
    boolean,
    type DbContext,
    date,
    defineEntity,
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
        'weeklyEmailReportEnabled',
        'monthlyEmailReportEnabled'
    );

export const FavoriteCurrencyDbSchema = object({
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE'),
    currency: string()
})
    .hasTableName('user_favorite_currencies')
    .hasPrimaryKey(['userId', 'currency'] as const);

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

export const TransactionScanDbSchema = object({
    id: number().primaryKey(),
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
export const FavoriteCurrencyEntity = defineEntity(FavoriteCurrencyDbSchema);

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
    favoriteCurrencies: FavoriteCurrencyEntity,
    externalIdentities: ExternalIdentityEntity,
    telegramAccounts: TelegramAccountEntity,
    telegramLinkTokens: TelegramLinkTokenEntity,
    apiKeys: ApiKeyEntity,
    mcpOAuthClients: McpOAuthClientEntity,
    mcpOAuthGrants: McpOAuthGrantEntity,
    mcpOAuthAuthorizationCodes: McpOAuthAuthorizationCodeEntity,
    mcpOAuthRefreshTokens: McpOAuthRefreshTokenEntity,
    categories: CategoryEntity,
    vendors: VendorEntity,
    transactions: TransactionEntity,
    transactionScans: TransactionScanEntity,
    transactionScanItems: TransactionScanItemEntity,
    transactionScanImages: TransactionScanImageEntity,
    exchangeRates: ExchangeRateEntity
};

export type AppEntityMap = typeof entityMap;
export type AppDb = DbContext<AppEntityMap>;

export type UserDb = {
    readonly id: number;
    readonly email: string;
    readonly passwordHash?: string | null;
    readonly emailVerified: boolean;
    readonly emailVerificationTokenHash?: string | null;
    readonly emailVerificationExpiresAt?: Date | null;
    readonly role: string;
    readonly authProvider: string;
    readonly defaultCurrency: string;
    readonly countryCode: string;
    readonly timezone: string;
    readonly weeklyEmailReportEnabled: boolean;
    readonly monthlyEmailReportEnabled: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
};

export type ExternalIdentityDb = {
    readonly provider: string;
    readonly providerSubject: string;
    readonly userId: number;
    readonly email: string;
    readonly createdAt: Date;
};

export type CategoryDb = {
    readonly id: number;
    readonly userId: number;
    readonly parentId?: number | null;
    readonly name: string;
    readonly type: 'expense' | 'income';
    readonly kind: 'normal' | 'offset';
    readonly archivedAt?: Date | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
};

export type VendorDb = {
    readonly id: number;
    readonly userId: number;
    readonly name: string;
    readonly normalizedName: string;
    readonly resolvedName?: string | null;
    readonly domain?: string | null;
    readonly description?: string | null;
    readonly logoUrl?: string | null;
    readonly primaryColor?: string | null;
    readonly enrichmentProvider?: string | null;
    readonly enrichmentStatus?: string | null;
    readonly enrichedAt?: Date | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
};

export type TelegramAccountDb = {
    readonly userId: number;
    readonly telegramUserId: string;
    readonly telegramUsername?: string | null;
    readonly telegramFirstName?: string | null;
    readonly telegramLastName?: string | null;
    readonly linkedAt: Date;
    readonly updatedAt: Date;
};

export type TelegramLinkTokenDb = {
    readonly id: number;
    readonly userId: number;
    readonly tokenHash: string;
    readonly expiresAt: Date;
    readonly consumedAt?: Date | null;
    readonly createdAt: Date;
};

export type ApiKeyDb = {
    readonly id: number;
    readonly userId: number;
    readonly name: string;
    readonly keyId: string;
    readonly keyPrefix: string;
    readonly secretHash: string;
    readonly createdAt: Date;
    readonly lastUsedAt?: Date | null;
    readonly revokedAt?: Date | null;
};

export type McpOAuthClientDb = {
    readonly id: number;
    readonly clientId: string;
    readonly clientName: string;
    readonly redirectUrisJson: string;
    readonly scope: string;
    readonly createdAt: Date;
};

export type McpOAuthGrantDb = {
    readonly id: number;
    readonly userId: number;
    readonly clientId: number;
    readonly scope: string;
    readonly createdAt: Date;
    readonly lastUsedAt?: Date | null;
    readonly revokedAt?: Date | null;
};

export type McpOAuthAuthorizationCodeDb = {
    readonly id: number;
    readonly codeHash: string;
    readonly userId: number;
    readonly clientId: number;
    readonly grantId: number;
    readonly redirectUri: string;
    readonly codeChallenge: string;
    readonly codeChallengeMethod: string;
    readonly scope: string;
    readonly expiresAt: Date;
    readonly consumedAt?: Date | null;
    readonly createdAt: Date;
};

export type McpOAuthRefreshTokenDb = {
    readonly id: number;
    readonly tokenHash: string;
    readonly userId: number;
    readonly clientId: number;
    readonly grantId: number;
    readonly expiresAt: Date;
    readonly createdAt: Date;
    readonly lastUsedAt?: Date | null;
    readonly revokedAt?: Date | null;
};

export type TransactionDb = {
    readonly id: number;
    readonly userId: number;
    readonly categoryId: number;
    readonly vendorId?: number | null;
    readonly category?: CategoryDb | null;
    readonly type: 'expense' | 'income';
    readonly amount: string | number;
    readonly currency: string;
    readonly defaultCurrencyAmount: string | number;
    readonly defaultCurrency: string;
    readonly exchangeRate: string | number;
    readonly exchangeRateDate: string;
    readonly occurredAt: Date;
    readonly note?: string | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
};

export type TransactionScanDb = {
    readonly id: number;
    readonly userId: number;
    readonly documentKind: string;
    readonly imageHash: string;
    readonly model: string;
    readonly warningsJson: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
};

export type TransactionScanItemDb = {
    readonly id: number;
    readonly scanId: number;
    readonly userId: number;
    readonly draftJson: string;
    readonly decision?: string | null;
    readonly correctedJson?: string | null;
    readonly transactionId?: number | null;
    readonly createdCategoryId?: number | null;
    readonly createdVendorId?: number | null;
    readonly decidedAt?: Date | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
};

export type TransactionScanImageDb = {
    readonly id: number;
    readonly scanId: number;
    readonly userId: number;
    readonly imageHash: string;
    readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    readonly fileName?: string | null;
    readonly sizeBytes: number;
    readonly imageBase64: string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
};
