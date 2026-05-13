import {
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
    role: string(),
    authProvider: string().hasColumnName('auth_provider'),
    defaultCurrency: string().hasColumnName('default_currency'),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
})
    .hasTableName('users')
    .projection(
        'public',
        'id',
        'email',
        'role',
        'authProvider',
        'defaultCurrency',
        'createdAt',
        'updatedAt'
    )
    .projection(
        'auth',
        'id',
        'email',
        'passwordHash',
        'role',
        'authProvider',
        'defaultCurrency'
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

export const CategoryDbSchema = object({
    id: number().primaryKey(),
    userId: number()
        .hasColumnName('user_id')
        .references('users', 'id')
        .onDelete('CASCADE')
        .index('idx_categories_user_id'),
    name: string(),
    type: string(),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
}).hasTableName('categories');

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
    type: string(),
    effect: string().defaultTo('normal'),
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
export const CategoryEntity = defineEntity(CategoryDbSchema);
export const TransactionEntity = defineEntity(TransactionDbSchema).belongsTo(
    t => t.category,
    l => l.categoryId,
    r => r.id
);
export const ExchangeRateEntity = defineEntity(ExchangeRateDbSchema);

export const entityMap = {
    users: UserEntity,
    favoriteCurrencies: FavoriteCurrencyEntity,
    externalIdentities: ExternalIdentityEntity,
    telegramAccounts: TelegramAccountEntity,
    telegramLinkTokens: TelegramLinkTokenEntity,
    apiKeys: ApiKeyEntity,
    categories: CategoryEntity,
    transactions: TransactionEntity,
    exchangeRates: ExchangeRateEntity
};

export type AppEntityMap = typeof entityMap;
export type AppDb = DbContext<AppEntityMap>;

export type UserDb = {
    readonly id: number;
    readonly email: string;
    readonly passwordHash?: string | null;
    readonly role: string;
    readonly authProvider: string;
    readonly defaultCurrency: string;
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
    readonly name: string;
    readonly type: 'expense' | 'income';
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

export type TransactionDb = {
    readonly id: number;
    readonly userId: number;
    readonly categoryId: number;
    readonly category?: CategoryDb | null;
    readonly type: 'expense' | 'income';
    readonly effect: 'normal' | 'reversal';
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
