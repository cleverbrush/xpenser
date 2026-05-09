import { date, defineEntity, number, object, string } from '@cleverbrush/orm';

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
}).hasTableName('user_favorite_currencies');

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
    amount: number(),
    currency: string(),
    defaultCurrencyAmount: number().hasColumnName('default_currency_amount'),
    defaultCurrency: string().hasColumnName('default_currency'),
    exchangeRate: number().hasColumnName('exchange_rate'),
    exchangeRateDate: string().hasColumnName('exchange_rate_date'),
    occurredAt: date().hasColumnName('occurred_at'),
    note: string().optional(),
    createdAt: date().hasColumnName('created_at').defaultTo('now'),
    updatedAt: date().hasColumnName('updated_at').defaultTo('now')
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
export const CategoryEntity = defineEntity(CategoryDbSchema);
export const TransactionEntity = defineEntity(TransactionDbSchema);
export const ExchangeRateEntity = defineEntity(ExchangeRateDbSchema);

export const entityMap = {
    users: UserEntity,
    favoriteCurrencies: FavoriteCurrencyEntity,
    categories: CategoryEntity,
    transactions: TransactionEntity,
    exchangeRates: ExchangeRateEntity
};

export type AppEntityMap = typeof entityMap;

export type UserRow = {
    readonly id: number;
    readonly email: string;
    readonly password_hash?: string | null;
    readonly role: string;
    readonly auth_provider: string;
    readonly default_currency: string;
    readonly created_at: Date;
    readonly updated_at: Date;
};

export type CategoryRow = {
    readonly id: number;
    readonly user_id: number;
    readonly name: string;
    readonly type: 'expense' | 'income';
    readonly created_at: Date;
    readonly updated_at: Date;
};

export type TransactionRow = {
    readonly id: number;
    readonly user_id: number;
    readonly category_id: number;
    readonly category_name: string;
    readonly type: 'expense' | 'income';
    readonly amount: string | number;
    readonly currency: string;
    readonly default_currency_amount: string | number;
    readonly default_currency: string;
    readonly exchange_rate: string | number;
    readonly exchange_rate_date: string;
    readonly occurred_at: Date;
    readonly note?: string | null;
    readonly created_at: Date;
    readonly updated_at: Date;
};
