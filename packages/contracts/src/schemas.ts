import {
    array,
    boolean,
    date,
    enumOf,
    type InferType,
    number,
    object,
    string
} from '@cleverbrush/schema';

export const CurrencyCodeSchema = string()
    .matches(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO 4217 code')
    .describe('ISO 4217 currency code, for example USD or EUR.')
    .schemaName('CurrencyCode');

export const CategoryTypeSchema = enumOf('expense', 'income')
    .describe('Whether a category is used for expenses or income.')
    .schemaName('CategoryType');

export const PeriodSchema = enumOf('week', 'month', 'quarter', 'year')
    .describe('Dashboard reporting period.')
    .schemaName('Period');

export const SortDirectionSchema = enumOf('asc', 'desc')
    .describe('Sort direction.')
    .schemaName('SortDirection');

export const ErrorResponseSchema = object({
    /** Human-readable error message safe to show to the current user. */
    message: string().describe(
        'Human-readable error message safe to show to the current user.'
    )
}).schemaName('ErrorResponse');

export const PrincipalSchema = object({
    /** Authenticated user identifier encoded in the API JWT. */
    userId: number().describe(
        'Authenticated user identifier encoded in the API JWT.'
    ),
    /** Role assigned to the authenticated user. */
    role: string().describe('Role assigned to the authenticated user.')
}).schemaName('Principal');

export const RegisterBodySchema = object({
    /** Email address used to sign in. Must be unique. */
    email: string()
        .email('must be a valid email address')
        .nonempty('email is required')
        .describe('Email address used to sign in. Must be unique.'),
    /** Password for local sign-in. */
    password: string()
        .minLength(8, 'password must be at least 8 characters')
        .describe('Password for local sign-in.'),
    /** Password confirmation entered during registration. */
    confirmPassword: string().describe(
        'Password confirmation entered during registration.'
    ),
    /** Default currency used for dashboards and reports. */
    defaultCurrency: CurrencyCodeSchema.describe(
        'Default currency used for dashboards and reports.'
    ),
    /** Favorite currencies shown first when creating transactions. */
    favoriteCurrencies: array(CurrencyCodeSchema)
        .default([])
        .describe('Favorite currencies shown first when creating transactions.')
}).schemaName('RegisterBody');

export const LoginBodySchema = object({
    /** Email address used to sign in. */
    email: string()
        .email('must be a valid email address')
        .nonempty('email is required')
        .describe('Email address used to sign in.'),
    /** Local account password. */
    password: string()
        .nonempty('password is required')
        .describe('Local account password.')
}).schemaName('LoginBody');

export const GoogleAuthBodySchema = object({
    /** Google ID token or access token returned by NextAuth. */
    idToken: string().describe(
        'Google ID token or access token returned by NextAuth.'
    )
}).schemaName('GoogleAuthBody');

export const TokenResponseSchema = object({
    /** Signed API JWT used as the Bearer token for protected API calls. */
    token: string().describe(
        'Signed API JWT used as the Bearer token for protected API calls.'
    ),
    /** Authenticated user profile. */
    user: object({
        /** Unique user identifier. */
        id: number().describe('Unique user identifier.'),
        /** User email address. */
        email: string().describe('User email address.'),
        /** User role. */
        role: string().describe('User role.'),
        /** Default currency used for reports. */
        defaultCurrency: CurrencyCodeSchema.describe(
            'Default currency used for reports.'
        ),
        /** True when the user has at least one category. */
        hasCategories: boolean().describe(
            'True when the user has at least one category.'
        )
    }).describe('Authenticated user profile.')
}).schemaName('TokenResponse');

export const UserPreferenceSchema = object({
    /** Unique user identifier. */
    id: number().describe('Unique user identifier.'),
    /** User email address. */
    email: string().describe('User email address.'),
    /** Default currency used for reports and new transactions. */
    defaultCurrency: CurrencyCodeSchema.describe(
        'Default currency used for reports and new transactions.'
    ),
    /** Favorite currencies offered when entering transactions. */
    favoriteCurrencies: array(CurrencyCodeSchema).describe(
        'Favorite currencies offered when entering transactions.'
    ),
    /** True when the user has at least one category. */
    hasCategories: boolean().describe(
        'True when the user has at least one category.'
    )
}).schemaName('UserPreference');

export const UpdateUserPreferenceBodySchema = object({
    /** Default currency used for reports and new transactions. */
    defaultCurrency: CurrencyCodeSchema.describe(
        'Default currency used for reports and new transactions.'
    ),
    /** Favorite currencies offered when entering transactions. */
    favoriteCurrencies: array(CurrencyCodeSchema).describe(
        'Favorite currencies offered when entering transactions.'
    )
}).schemaName('UpdateUserPreferenceBody');

export const CurrencySchema = object({
    /** ISO 4217 currency code. */
    code: CurrencyCodeSchema.describe('ISO 4217 currency code.'),
    /** Human-readable currency name. */
    name: string().describe('Human-readable currency name.')
}).schemaName('Currency');

export const CategorySchema = object({
    /** Unique category identifier. */
    id: number().describe('Unique category identifier.'),
    /** Category name shown in transaction forms and reports. */
    name: string().describe(
        'Category name shown in transaction forms and reports.'
    ),
    /** Whether this category is for expenses or income. */
    type: CategoryTypeSchema.describe(
        'Whether this category is for expenses or income.'
    ),
    /** True when one or more transactions reference this category. */
    inUse: boolean().describe(
        'True when one or more transactions reference this category.'
    ),
    /** Creation timestamp. */
    createdAt: date().coerce().describe('Creation timestamp.'),
    /** Last update timestamp. */
    updatedAt: date().coerce().describe('Last update timestamp.')
}).schemaName('Category');

export const CreateCategoryBodySchema = object({
    /** Category name shown in transaction forms and reports. */
    name: string()
        .minLength(1, 'category name is required')
        .maxLength(120, 'category name is too long')
        .describe('Category name shown in transaction forms and reports.'),
    /** Whether this category is for expenses or income. */
    type: CategoryTypeSchema.describe(
        'Whether this category is for expenses or income.'
    )
}).schemaName('CreateCategoryBody');

export const UpdateCategoryBodySchema = object({
    /** Category name shown in transaction forms and reports. */
    name: string()
        .minLength(1, 'category name is required')
        .maxLength(120, 'category name is too long')
        .optional()
        .describe('Category name shown in transaction forms and reports.'),
    /** Whether this category is for expenses or income. */
    type: CategoryTypeSchema.optional().describe(
        'Whether this category is for expenses or income.'
    )
}).schemaName('UpdateCategoryBody');

export const TransactionSchema = object({
    /** Unique transaction identifier. */
    id: number().describe('Unique transaction identifier.'),
    /** Category identifier selected for the transaction. */
    categoryId: number().describe(
        'Category identifier selected for the transaction.'
    ),
    /** Category name at read time. */
    categoryName: string().describe('Category name at read time.'),
    /** Transaction direction. */
    type: CategoryTypeSchema.describe('Transaction direction.'),
    /** Amount entered by the user in the original currency. */
    amount: number().describe(
        'Amount entered by the user in the original currency.'
    ),
    /** Currency used for the entered amount. */
    currency: CurrencyCodeSchema.describe(
        'Currency used for the entered amount.'
    ),
    /** Amount converted to the user default currency at write time. */
    defaultCurrencyAmount: number().describe(
        'Amount converted to the user default currency at write time.'
    ),
    /** User default currency used when the transaction was converted. */
    defaultCurrency: CurrencyCodeSchema.describe(
        'User default currency used when the transaction was converted.'
    ),
    /** Exchange rate used for the default-currency amount. */
    exchangeRate: number().describe(
        'Exchange rate used for the default-currency amount.'
    ),
    /** Date associated with the exchange rate. */
    exchangeRateDate: string().describe(
        'Date associated with the exchange rate.'
    ),
    /** Date and time when the transaction happened. */
    occurredAt: date()
        .coerce()
        .describe('Date and time when the transaction happened.'),
    /** Optional note entered by the user. */
    note: string().optional().describe('Optional note entered by the user.'),
    /** Creation timestamp. */
    createdAt: date().coerce().describe('Creation timestamp.'),
    /** Last update timestamp. */
    updatedAt: date().coerce().describe('Last update timestamp.')
}).schemaName('Transaction');

export const CreateTransactionBodySchema = object({
    /** Category identifier selected for the transaction. */
    categoryId: number().describe(
        'Category identifier selected for the transaction.'
    ),
    /** Amount entered by the user in the original currency. */
    amount: number()
        .positive('amount must be greater than zero')
        .describe('Amount entered by the user in the original currency.'),
    /** Currency used for the entered amount. */
    currency: CurrencyCodeSchema.describe(
        'Currency used for the entered amount.'
    ),
    /** Date and time when the transaction happened. */
    occurredAt: date()
        .coerce()
        .describe('Date and time when the transaction happened.'),
    /** Optional note entered by the user. */
    note: string()
        .maxLength(500)
        .optional()
        .describe('Optional note entered by the user.')
}).schemaName('CreateTransactionBody');

export const UpdateTransactionBodySchema =
    CreateTransactionBodySchema.deepPartial().schemaName(
        'UpdateTransactionBody'
    );

export const TransactionListQuerySchema = object({
    /** Full text search applied to category name and note. */
    search: string()
        .optional()
        .describe('Full text search applied to category name and note.'),
    /** Filter by transaction direction. */
    type: CategoryTypeSchema.optional().describe(
        'Filter by transaction direction.'
    ),
    /** Filter by category identifier. */
    categoryId: number()
        .coerce()
        .optional()
        .describe('Filter by category identifier.'),
    /** Inclusive start date for transaction occurrence. */
    from: date()
        .coerce()
        .optional()
        .describe('Inclusive start date for transaction occurrence.'),
    /** Inclusive end date for transaction occurrence. */
    to: date()
        .coerce()
        .optional()
        .describe('Inclusive end date for transaction occurrence.'),
    /** One-based page number. */
    page: number().coerce().default(1).describe('One-based page number.'),
    /** Number of records per page. */
    limit: number()
        .coerce()
        .default(50)
        .describe('Number of records per page.'),
    /** Sort direction by occurrence date. */
    direction: SortDirectionSchema.default('desc').describe(
        'Sort direction by occurrence date.'
    )
}).schemaName('TransactionListQuery');

export const TransactionListResponseSchema = object({
    /** Current page of transactions. */
    items: array(TransactionSchema).describe('Current page of transactions.'),
    /** Total number of matching transactions. */
    total: number().describe('Total number of matching transactions.'),
    /** One-based page number. */
    page: number().describe('One-based page number.'),
    /** Number of records per page. */
    limit: number().describe('Number of records per page.')
}).schemaName('TransactionListResponse');

export const DashboardQuerySchema = object({
    /** Reporting period. */
    period: PeriodSchema.default('month').describe('Reporting period.')
}).schemaName('DashboardQuery');

export const DashboardCategoryTotalSchema = object({
    /** Category identifier. */
    categoryId: number().describe('Category identifier.'),
    /** Category name. */
    categoryName: string().describe('Category name.'),
    /** Transaction direction. */
    type: CategoryTypeSchema.describe('Transaction direction.'),
    /** Total in the user's default currency. */
    total: number().describe("Total in the user's default currency.")
}).schemaName('DashboardCategoryTotal');

export const DashboardSummarySchema = object({
    /** Reporting period used for the summary. */
    period: PeriodSchema.describe('Reporting period used for the summary.'),
    /** Period start timestamp. */
    from: date().coerce().describe('Period start timestamp.'),
    /** Period end timestamp. */
    to: date().coerce().describe('Period end timestamp.'),
    /** Currency used for totals. */
    currency: CurrencyCodeSchema.describe('Currency used for totals.'),
    /** Total expenses in the default currency. */
    expenseTotal: number().describe('Total expenses in the default currency.'),
    /** Total income in the default currency. */
    incomeTotal: number().describe('Total income in the default currency.'),
    /** Category totals for the selected period. */
    byCategory: array(DashboardCategoryTotalSchema).describe(
        'Category totals for the selected period.'
    ),
    /** Latest transactions for the dashboard table. */
    latestTransactions: array(TransactionSchema).describe(
        'Latest transactions for the dashboard table.'
    )
}).schemaName('DashboardSummary');

export type Principal = InferType<typeof PrincipalSchema>;
export type RegisterBody = InferType<typeof RegisterBodySchema>;
export type LoginBody = InferType<typeof LoginBodySchema>;
export type TokenResponse = InferType<typeof TokenResponseSchema>;
export type UserPreference = InferType<typeof UserPreferenceSchema>;
export type Currency = InferType<typeof CurrencySchema>;
export type Category = InferType<typeof CategorySchema>;
export type CreateCategoryBody = InferType<typeof CreateCategoryBodySchema>;
export type Transaction = InferType<typeof TransactionSchema>;
export type CreateTransactionBody = InferType<
    typeof CreateTransactionBodySchema
>;
export type TransactionListQuery = InferType<typeof TransactionListQuerySchema>;
export type DashboardSummary = InferType<typeof DashboardSummarySchema>;
