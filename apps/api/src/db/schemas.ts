import {
  array,
  boolean,
  date,
  defineEntity,
  number,
  object,
  string,
} from '@cleverbrush/orm';

// ── Users ──────────────────────────────────────────────────────────────────────

export const UserDbSchema = object({
  id: number().primaryKey(),
  email: string(),
  passwordHash: string().optional().hasColumnName('password_hash'),
  role: string(),
  authProvider: string().hasColumnName('auth_provider'),
  defaultCurrency: string().hasColumnName('default_currency').length(3),
  favoriteCurrencies: array(string()).hasColumnName('favorite_currencies'),
  createdAt: date().hasColumnName('created_at').defaultTo('now'),
})
  .hasTableName('users')
  .projection('public', 'id', 'email', 'role', 'authProvider', 'defaultCurrency', 'favoriteCurrencies', 'createdAt')
  .projection('auth', 'id', 'email', 'role', 'passwordHash', 'authProvider');

export const UserEntity = defineEntity(UserDbSchema);

// ── Categories ─────────────────────────────────────────────────────────────────

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
}).hasTableName('categories');

export const CategoryEntity = defineEntity(CategoryDbSchema);

// ── Transactions ───────────────────────────────────────────────────────────────

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
  amount: number(),
  currency: string().length(3),
  description: string().optional(),
  transactionDate: date().hasColumnName('transaction_date'),
  createdAt: date().hasColumnName('created_at').defaultTo('now'),
}).hasTableName('transactions');

export const TransactionEntity = defineEntity(TransactionDbSchema);

// ── Exchange Rates ─────────────────────────────────────────────────────────────

export const ExchangeRateDbSchema = object({
  id: number().primaryKey(),
  baseCurrency: string().hasColumnName('base_currency').length(3),
  targetCurrency: string().hasColumnName('target_currency').length(3),
  rate: number(),
  updatedAt: date().hasColumnName('updated_at').defaultTo('now'),
}).hasTableName('exchange_rates');

export const ExchangeRateEntity = defineEntity(ExchangeRateDbSchema);

// ── Relationships ──────────────────────────────────────────────────────────────

export const UserEntityWithRels = UserEntity
  .hasMany((t) => t.categories, CategoryEntity, 'userId')
  .hasMany((t) => t.transactions, TransactionEntity, 'userId');

export const CategoryEntityWithRels = CategoryEntity
  .belongsTo((t) => t.user, 'userId');

export const TransactionEntityWithRels = TransactionEntity
  .belongsTo((t) => t.category, 'categoryId')
  .belongsTo((t) => t.user, 'userId');

// ── Entity Map ─────────────────────────────────────────────────────────────────

export const entityMap = {
  users: UserEntity,
  categories: CategoryEntity,
  transactions: TransactionEntity,
  exchangeRates: ExchangeRateEntity,
};

export type AppEntityMap = typeof entityMap;
