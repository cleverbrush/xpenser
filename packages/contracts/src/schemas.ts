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
    .required('currency is required')
    .nonempty('currency is required')
    .matches(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO 4217 code')
    .describe('ISO 4217 currency code, for example USD or EUR.')
    .schemaName('CurrencyCode');

export const TimeZoneSchema = string()
    .required('timezone is required')
    .nonempty('timezone is required')
    .addValidator(value => {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: value });
            return { valid: true };
        } catch {
            return {
                valid: false,
                errors: [{ message: 'timezone must be a valid IANA time zone' }]
            };
        }
    })
    .describe('IANA time zone identifier, for example UTC or America/New_York.')
    .schemaName('TimeZone');

export const CategoryTypeSchema = enumOf('expense', 'income')
    .required('category type is required')
    .describe('Whether a category is used for expenses or income.')
    .schemaName('CategoryType');

export const TransactionEffectSchema = enumOf('normal', 'reversal')
    .describe(
        'Whether the transaction increases its category total or reverses it.'
    )
    .schemaName('TransactionEffect');

export const PeriodSchema = enumOf('day', 'week', 'month', 'quarter', 'year')
    .describe('Dashboard reporting period.')
    .schemaName('Period');

export const StatsGroupBySchema = enumOf('hour', 'day', 'week', 'month')
    .describe('Stats trend grouping.')
    .schemaName('StatsGroupBy');

export const CategoryTrendGroupBySchema = enumOf('day', 'week', 'month', 'year')
    .describe('Category trend grouping.')
    .schemaName('CategoryTrendGroupBy');

export const CategoryTrendRangeSchema = enumOf(
    'last-30-days',
    'last-90-days',
    'this-year',
    'last-12-months',
    'all-time',
    'custom'
)
    .describe('Category trend timeframe.')
    .schemaName('CategoryTrendRange');

export const StatsTimeframeSchema = enumOf(
    'this-week',
    'last-7-days',
    'this-month',
    'last-month',
    'last-30-days',
    'custom'
)
    .describe('Stats reporting timeframe.')
    .schemaName('StatsTimeframe');

export const SortDirectionSchema = enumOf('asc', 'desc')
    .describe('Sort direction.')
    .schemaName('SortDirection');

const decimalNumber = () => number().clearIsInteger();

function hasAtMostTwoDecimalPlaces(value: number): boolean {
    const scaled = value * 100;
    const nearestCent = Math.round(scaled);
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
    return Math.abs(scaled - nearestCent) <= tolerance;
}

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
    role: string().describe('Role assigned to the authenticated user.'),
    /** Credential type used for the request. */
    authType: string()
        .optional()
        .describe('Credential type used for the request.'),
    /** API key identifier when the request used a durable API key. */
    apiKeyId: number()
        .optional()
        .describe('API key identifier when the request used a durable API key.')
}).schemaName('Principal');

export const RegisterBodySchema = object({
    /** Email address used to sign in. Must be unique. */
    email: string()
        .required('email is required')
        .nonempty('email is required')
        .email('must be a valid email address')
        .describe('Email address used to sign in. Must be unique.'),
    /** Password for local sign-in. */
    password: string()
        .required('password is required')
        .nonempty('password is required')
        .minLength(8, 'password must be at least 8 characters')
        .describe('Password for local sign-in.'),
    /** Password confirmation entered during registration. */
    confirmPassword: string()
        .required('password confirmation is required')
        .nonempty('password confirmation is required')
        .minLength(8, 'password confirmation must be at least 8 characters')
        .describe('Password confirmation entered during registration.'),
    /** Default currency used for dashboards and reports. */
    defaultCurrency: CurrencyCodeSchema.describe(
        'Default currency used for dashboards and reports.'
    ),
    /** Favorite currencies shown first when creating transactions. */
    favoriteCurrencies: array(CurrencyCodeSchema)
        .default([])
        .describe(
            'Favorite currencies shown first when creating transactions.'
        ),
    /** Time zone used for transaction display and reporting periods. */
    timezone: TimeZoneSchema.default('UTC').describe(
        'Time zone used for transaction display and reporting periods.'
    )
})
    .addValidator(value => {
        if (value.password !== value.confirmPassword) {
            return {
                valid: false,
                errors: [
                    {
                        message: 'passwords do not match',
                        property: field => field.confirmPassword
                    }
                ]
            };
        }

        return { valid: true };
    })
    .schemaName('RegisterBody');

export const LoginBodySchema = object({
    /** Email address used to sign in. */
    email: string()
        .required('email is required')
        .nonempty('email is required')
        .email('must be a valid email address')
        .describe('Email address used to sign in.'),
    /** Local account password. */
    password: string()
        .required('password is required')
        .nonempty('password is required')
        .describe('Local account password.')
}).schemaName('LoginBody');

export const PassportResolveUserBodySchema = object({
    /** Identity provider resolved by Passport. */
    provider: string()
        .required('provider is required')
        .nonempty('provider is required')
        .describe('Identity provider resolved by Passport.'),
    /** Provider-specific subject identifier. */
    provider_subject: string()
        .required('provider subject is required')
        .nonempty('provider subject is required')
        .describe('Provider-specific subject identifier.'),
    /** Verified email address returned by the provider. */
    email: string()
        .required('email is required')
        .nonempty('email is required')
        .email('must be a valid email address')
        .describe('Verified email address returned by the provider.'),
    /** Whether the provider verified the email address. */
    email_verified: boolean()
        .required('email verification is required')
        .describe('Whether the provider verified the email address.'),
    /** Display name returned by the provider. */
    name: string()
        .optional()
        .describe('Display name returned by the provider.'),
    /** Avatar URL returned by the provider. */
    avatar_url: string()
        .optional()
        .describe('Avatar URL returned by the provider.')
}).schemaName('PassportResolveUserBody');

export const PassportResolveUserResponseSchema = object({
    /** Stable xpenser user identifier returned to Passport. */
    service_user_id: string().describe(
        'Stable xpenser user identifier returned to Passport.'
    ),
    /** Roles Passport should embed in its issued access token. */
    roles: array(string()).describe(
        'Roles Passport should embed in its issued access token.'
    )
}).schemaName('PassportResolveUserResponse');

export const PassportExchangeBodySchema = object({
    /** One-time authorization code returned by Passport. */
    code: string()
        .required('authorization code is required')
        .nonempty('authorization code is required')
        .describe('One-time authorization code returned by Passport.'),
    /** PKCE code verifier generated before redirecting to Passport. */
    codeVerifier: string()
        .required('PKCE code verifier is required')
        .nonempty('PKCE code verifier is required')
        .matches(/^[A-Za-z0-9._~-]{43,128}$/, 'PKCE code verifier is invalid')
        .describe(
            'PKCE code verifier generated before redirecting to Passport.'
        )
}).schemaName('PassportExchangeBody');

export const SessionTokenBodySchema = object({
    /** Authenticated user identifier stored in the trusted web session. */
    userId: number().describe(
        'Authenticated user identifier stored in the trusted web session.'
    )
}).schemaName('SessionTokenBody');

export const TokenResponseSchema = object({
    /** Signed API JWT used as the Bearer token for protected API calls. */
    token: string().describe(
        'Signed API JWT used as the Bearer token for protected API calls.'
    ),
    /** Date and time when the API JWT expires. */
    expiresAt: date()
        .coerce()
        .describe('Date and time when the API JWT expires.'),
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
        /** Time zone used for transaction display and reporting periods. */
        timezone: TimeZoneSchema.describe(
            'Time zone used for transaction display and reporting periods.'
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
    /** Transaction entry currencies ordered by recent usage popularity. */
    transactionCurrencies: array(CurrencyCodeSchema).describe(
        'Transaction entry currencies ordered by recent usage popularity.'
    ),
    /** Time zone used for transaction display and reporting periods. */
    timezone: TimeZoneSchema.describe(
        'Time zone used for transaction display and reporting periods.'
    ),
    /** True when the user has at least one category. */
    hasCategories: boolean().describe(
        'True when the user has at least one category.'
    ),
    /** True when weekly email reports are enabled. */
    weeklyEmailReportEnabled: boolean().describe(
        'True when weekly email reports are enabled.'
    ),
    /** True when monthly email reports are enabled. */
    monthlyEmailReportEnabled: boolean().describe(
        'True when monthly email reports are enabled.'
    )
}).schemaName('UserPreference');

export const ApiKeySchema = object({
    /** Unique API key identifier. */
    id: number().describe('Unique API key identifier.'),
    /** User-provided name used to recognize this key. */
    name: string().describe('User-provided name used to recognize this key.'),
    /** Non-sensitive prefix shown in settings. */
    keyPrefix: string().describe('Non-sensitive prefix shown in settings.'),
    /** Creation timestamp. */
    createdAt: date().coerce().describe('Creation timestamp.'),
    /** Last time this key authenticated a request, when available. */
    lastUsedAt: date()
        .coerce()
        .optional()
        .describe('Last time this key authenticated a request, when available.')
}).schemaName('ApiKey');

export const CreateApiKeyBodySchema = object({
    /** User-provided name used to recognize this key. */
    name: string()
        .required('API key name is required')
        .nonempty('API key name is required')
        .maxLength(120, 'API key name is too long')
        .describe('User-provided name used to recognize this key.')
})
    .addValidator(value => {
        if (typeof value.name !== 'string' || value.name.trim() === '') {
            return {
                valid: false,
                errors: [
                    {
                        message: 'API key name is required',
                        property: field => field.name
                    }
                ]
            };
        }

        return { valid: true };
    })
    .schemaName('CreateApiKeyBody');

export const CreateApiKeyResponseSchema = object({
    /** Plaintext API key. It is returned only when the key is created. */
    key: string().describe(
        'Plaintext API key. It is returned only when the key is created.'
    ),
    /** Persisted API key metadata. */
    apiKey: ApiKeySchema.describe('Persisted API key metadata.')
}).schemaName('CreateApiKeyResponse');

export const UpdateUserPreferenceBodySchema = object({
    /** Default currency used for reports and new transactions. */
    defaultCurrency: CurrencyCodeSchema.describe(
        'Default currency used for reports and new transactions.'
    ),
    /** Favorite currencies offered when entering transactions. */
    favoriteCurrencies: array(CurrencyCodeSchema).describe(
        'Favorite currencies offered when entering transactions.'
    ),
    /** Time zone used for transaction display and reporting periods. */
    timezone: TimeZoneSchema.optional().describe(
        'Time zone used for transaction display and reporting periods.'
    ),
    /** True when weekly email reports are enabled. */
    weeklyEmailReportEnabled: boolean()
        .default(true)
        .describe('True when weekly email reports are enabled.'),
    /** True when monthly email reports are enabled. */
    monthlyEmailReportEnabled: boolean()
        .default(true)
        .describe('True when monthly email reports are enabled.')
}).schemaName('UpdateUserPreferenceBody');

export const TelegramConnectionStatusSchema = object({
    /** True when the current xpenser account is connected to Telegram. */
    linked: boolean().describe(
        'True when the current xpenser account is connected to Telegram.'
    ),
    /** Telegram username at the time the account was linked, when available. */
    telegramUsername: string()
        .optional()
        .describe(
            'Telegram username at the time the account was linked, when available.'
        ),
    /** Telegram first name at the time the account was linked, when available. */
    telegramFirstName: string()
        .optional()
        .describe(
            'Telegram first name at the time the account was linked, when available.'
        ),
    /** Telegram last name at the time the account was linked, when available. */
    telegramLastName: string()
        .optional()
        .describe(
            'Telegram last name at the time the account was linked, when available.'
        ),
    /** Date and time when the Telegram account was linked. */
    linkedAt: date()
        .coerce()
        .optional()
        .describe('Date and time when the Telegram account was linked.')
}).schemaName('TelegramConnectionStatus');

export const CreateTelegramLinkTokenResponseSchema = object({
    /** Telegram deep link users should open to connect their account. */
    startUrl: string().describe(
        'Telegram deep link users should open to connect their account.'
    ),
    /** Date and time when this link token expires. */
    expiresAt: date()
        .coerce()
        .describe('Date and time when this link token expires.')
}).schemaName('CreateTelegramLinkTokenResponse');

export const TelegramUserBodySchema = object({
    /** Telegram user identifier, sent as a string to avoid precision issues. */
    telegramUserId: string()
        .required('Telegram user id is required')
        .nonempty('Telegram user id is required')
        .describe(
            'Telegram user identifier, sent as a string to avoid precision issues.'
        ),
    /** Telegram username, when available. */
    telegramUsername: string()
        .maxLength(64, 'Telegram username is too long')
        .optional()
        .describe('Telegram username, when available.'),
    /** Telegram first name, when available. */
    telegramFirstName: string()
        .maxLength(128, 'Telegram first name is too long')
        .optional()
        .describe('Telegram first name, when available.'),
    /** Telegram last name, when available. */
    telegramLastName: string()
        .maxLength(128, 'Telegram last name is too long')
        .optional()
        .describe('Telegram last name, when available.')
}).schemaName('TelegramUserBody');

export const LinkTelegramAccountBodySchema = object({
    /** Random one-time token from the Telegram deep link payload. */
    token: string()
        .required('link token is required')
        .nonempty('link token is required')
        .describe('Random one-time token from the Telegram deep link payload.'),
    /** Telegram account to link to the xpenser account that owns the token. */
    telegramUser: TelegramUserBodySchema.describe(
        'Telegram account to link to the xpenser account that owns the token.'
    )
}).schemaName('LinkTelegramAccountBody');

export const TelegramTokenBodySchema = object({
    /** Telegram account requesting a short-lived xpenser API token. */
    telegramUser: TelegramUserBodySchema.describe(
        'Telegram account requesting a short-lived xpenser API token.'
    )
}).schemaName('TelegramTokenBody');

export const LinkTelegramAccountResponseSchema = object({
    /** Connected xpenser user identifier. */
    userId: number().describe('Connected xpenser user identifier.'),
    /** Connected xpenser user email address. */
    email: string().describe('Connected xpenser user email address.'),
    /** Current Telegram connection status. */
    telegram: TelegramConnectionStatusSchema.describe(
        'Current Telegram connection status.'
    )
}).schemaName('LinkTelegramAccountResponse');

export const CurrencySchema = object({
    /** ISO 4217 currency code. */
    code: CurrencyCodeSchema.describe('ISO 4217 currency code.'),
    /** Human-readable currency name. */
    name: string().describe('Human-readable currency name.')
}).schemaName('Currency');

export const CurrencyConversionQuerySchema = object({
    /** Amount entered by the user in the original currency. */
    amount: decimalNumber()
        .required('amount is required')
        .positive('amount must be greater than zero')
        .describe('Amount entered by the user in the original currency.'),
    /** Currency used for the entered amount. */
    currency: CurrencyCodeSchema.describe(
        'Currency used for the entered amount.'
    ),
    /** Date used to choose a historical exchange rate. */
    occurredAt: date()
        .coerce()
        .optional()
        .describe('Date used to choose a historical exchange rate.')
}).schemaName('CurrencyConversionQuery');

export const CurrencyConversionSchema = object({
    /** Amount entered by the user in the original currency. */
    amount: decimalNumber().describe(
        'Amount entered by the user in the original currency.'
    ),
    /** Currency used for the entered amount. */
    currency: CurrencyCodeSchema.describe(
        'Currency used for the entered amount.'
    ),
    /** Amount converted to the user default currency. */
    defaultCurrencyAmount: decimalNumber().describe(
        'Amount converted to the user default currency.'
    ),
    /** User default currency used for conversion. */
    defaultCurrency: CurrencyCodeSchema.describe(
        'User default currency used for conversion.'
    ),
    /** Exchange rate used for the conversion. */
    exchangeRate: decimalNumber().describe(
        'Exchange rate used for the conversion.'
    ),
    /** Date associated with the exchange rate. */
    exchangeRateDate: string().describe(
        'Date associated with the exchange rate.'
    )
}).schemaName('CurrencyConversion');

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

export const CategoryListQuerySchema = object({
    /** Optional category ordering mode. */
    sort: enumOf('recent-transaction-count')
        .optional()
        .describe('Optional category ordering mode.')
}).schemaName('CategoryListQuery');

export const CreateCategoryBodySchema = object({
    /** Category name shown in transaction forms and reports. */
    name: string()
        .required('category name is required')
        .nonempty('category name is required')
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
    /** Whether the transaction increases or reverses its category total. */
    effect: TransactionEffectSchema.describe(
        'Whether the transaction increases or reverses its category total.'
    ),
    /** Amount entered by the user in the original currency. */
    amount: decimalNumber().describe(
        'Amount entered by the user in the original currency.'
    ),
    /** Currency used for the entered amount. */
    currency: CurrencyCodeSchema.describe(
        'Currency used for the entered amount.'
    ),
    /** Amount converted to the user default currency at write time. */
    defaultCurrencyAmount: decimalNumber().describe(
        'Amount converted to the user default currency at write time.'
    ),
    /** User default currency used when the transaction was converted. */
    defaultCurrency: CurrencyCodeSchema.describe(
        'User default currency used when the transaction was converted.'
    ),
    /** Exchange rate used for the default-currency amount. */
    exchangeRate: decimalNumber().describe(
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
    categoryId: number()
        .required('category is required')
        .describe('Category identifier selected for the transaction.'),
    /** Amount entered by the user in the original currency. */
    amount: decimalNumber()
        .required('amount is required')
        .positive('amount must be greater than zero')
        .describe('Amount entered by the user in the original currency.'),
    /** Currency used for the entered amount. */
    currency: CurrencyCodeSchema.describe(
        'Currency used for the entered amount.'
    ),
    /** Whether the transaction increases or reverses its category total. */
    effect: TransactionEffectSchema.optional().describe(
        'Whether the transaction increases or reverses its category total.'
    ),
    /** Date and time when the transaction happened. */
    occurredAt: date()
        .required('date and time is required')
        .coerce()
        .describe('Date and time when the transaction happened.'),
    /** Optional note entered by the user. */
    note: string()
        .maxLength(500, 'note is too long')
        .optional()
        .describe('Optional note entered by the user.')
})
    .addValidator(value => {
        if (value.amount === undefined || Number.isNaN(value.amount)) {
            return {
                valid: false,
                errors: [
                    {
                        message: 'amount is required',
                        property: field => field.amount
                    }
                ]
            };
        }

        return { valid: true };
    })
    .addValidator(value => {
        if (
            value.amount === undefined ||
            Number.isNaN(value.amount) ||
            hasAtMostTwoDecimalPlaces(value.amount)
        ) {
            return { valid: true };
        }

        return {
            valid: false,
            errors: [
                {
                    message: 'amount can have at most two decimal places',
                    property: field => field.amount
                }
            ]
        };
    })
    .schemaName('CreateTransactionBody');

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
    period: PeriodSchema.default('day').describe('Reporting period.'),
    /** Date used to choose the reporting period. */
    date: date()
        .coerce()
        .optional()
        .describe('Date used to choose the reporting period.')
}).schemaName('DashboardQuery');

export const PeriodWindowQuerySchema = object({
    /** Reporting period. */
    period: PeriodSchema.default('day').describe('Reporting period.'),
    /** Date used to choose the center reporting period. */
    date: date()
        .coerce()
        .optional()
        .describe('Date used to choose the center reporting period.'),
    /** Number of previous periods to include. */
    before: number()
        .coerce()
        .default(2)
        .describe('Number of previous periods to include.'),
    /** Number of following periods to include. */
    after: number()
        .coerce()
        .default(2)
        .describe('Number of following periods to include.')
}).schemaName('PeriodWindowQuery');

export const StatsQuerySchema = object({
    /** Stats trend grouping. */
    groupBy: StatsGroupBySchema.default('day').describe(
        'Stats trend grouping.'
    ),
    /** Stats reporting timeframe. */
    timeframe: StatsTimeframeSchema.default('this-month').describe(
        'Stats reporting timeframe.'
    ),
    /** Inclusive custom start date. */
    from: date().coerce().optional().describe('Inclusive custom start date.'),
    /** Inclusive custom end date. */
    to: date().coerce().optional().describe('Inclusive custom end date.'),
    /** Dashboard-style reporting period. */
    period: PeriodSchema.optional().describe(
        'Dashboard-style reporting period.'
    ),
    /** Date used to choose the dashboard-style reporting period. */
    date: date()
        .coerce()
        .optional()
        .describe('Date used to choose the dashboard-style reporting period.')
}).schemaName('StatsQuery');

export const CategoryTrendQuerySchema = object({
    /** Category trend timeframe. */
    range: CategoryTrendRangeSchema.default('last-12-months').describe(
        'Category trend timeframe.'
    ),
    /** Category trend grouping. */
    groupBy: CategoryTrendGroupBySchema.default('month').describe(
        'Category trend grouping.'
    ),
    /** Inclusive custom start date. */
    from: date().coerce().optional().describe('Inclusive custom start date.'),
    /** Inclusive custom end date. */
    to: date().coerce().optional().describe('Inclusive custom end date.')
})
    .addValidator(value => {
        if (value.range !== 'custom' || (value.from && value.to)) {
            return { valid: true };
        }

        return {
            valid: false,
            errors: [
                {
                    message: 'custom range requires from and to dates'
                }
            ]
        };
    })
    .schemaName('CategoryTrendQuery');

export const DashboardCategoryTotalSchema = object({
    /** Category identifier. */
    categoryId: number().describe('Category identifier.'),
    /** Category name. */
    categoryName: string().describe('Category name.'),
    /** Transaction direction. */
    type: CategoryTypeSchema.describe('Transaction direction.'),
    /** Net category total in the user's default currency after reversals. */
    total: decimalNumber().describe(
        "Net category total in the user's default currency after reversals."
    ),
    /** Number of selected-period transactions in the category. */
    transactionCount: number().describe(
        'Number of selected-period transactions in the category.'
    ),
    /** Matching category total in the previous comparison period. */
    previousPeriodTotal: decimalNumber().describe(
        'Matching category total in the previous comparison period.'
    ),
    /** Percent change from the previous comparison period. */
    percentChange: decimalNumber().describe(
        'Percent change from the previous comparison period.'
    ),
    /** Selected-period bucket totals for lightweight category charts. */
    trend: array(decimalNumber()).describe(
        'Selected-period bucket totals for lightweight category charts.'
    )
}).schemaName('DashboardCategoryTotal');

export const StatsTrendPointSchema = object({
    /** Stable date or month bucket key. */
    bucket: string().describe('Stable date or month bucket key.'),
    /** Short label shown on charts. */
    label: string().describe('Short label shown on charts.'),
    /** Net income total in the user's default currency after reversals. */
    incomeTotal: decimalNumber().describe(
        "Net income total in the user's default currency after reversals."
    ),
    /** Net expense total in the user's default currency after reversals. */
    expenseTotal: decimalNumber().describe(
        "Net expense total in the user's default currency after reversals."
    ),
    /** Income minus expense total for the bucket. */
    netTotal: decimalNumber().describe(
        'Income minus expense total for the bucket.'
    ),
    /** Number of transactions in the bucket. */
    transactionCount: number().describe('Number of transactions in the bucket.')
}).schemaName('StatsTrendPoint');

export const StatsCategoryTotalSchema = object({
    /** Category identifier. */
    categoryId: number().describe('Category identifier.'),
    /** Category name. */
    categoryName: string().describe('Category name.'),
    /** Transaction direction. */
    type: CategoryTypeSchema.describe('Transaction direction.'),
    /** Net category total in the user's default currency after reversals. */
    total: decimalNumber().describe(
        "Net category total in the user's default currency after reversals."
    ),
    /** Share of the matching net income or expense total, as a percentage. */
    share: decimalNumber().describe(
        'Share of the matching net income or expense total, as a percentage.'
    ),
    /** Number of selected-period transactions in the category. */
    transactionCount: number().describe(
        'Number of selected-period transactions in the category.'
    ),
    /** Selected-period bucket totals for lightweight category charts. */
    trend: array(decimalNumber()).describe(
        'Selected-period bucket totals for lightweight category charts.'
    ),
    /** Matching total in the previous comparison period. */
    previousPeriodTotal: decimalNumber().describe(
        'Matching total in the previous comparison period.'
    ),
    /** Matching total in the same period one year earlier. */
    previousYearTotal: decimalNumber().describe(
        'Matching total in the same period one year earlier.'
    )
}).schemaName('StatsCategoryTotal');

export const StatsComparisonSchema = object({
    /** Comparison period start timestamp. */
    from: date().coerce().describe('Comparison period start timestamp.'),
    /** Comparison period end timestamp. */
    to: date().coerce().describe('Comparison period end timestamp.'),
    /** Net expenses in the default currency after reversals. */
    expenseTotal: decimalNumber().describe(
        'Net expenses in the default currency after reversals.'
    ),
    /** Net income in the default currency after reversals. */
    incomeTotal: decimalNumber().describe(
        'Net income in the default currency after reversals.'
    ),
    /** Income minus expenses in the default currency. */
    netTotal: decimalNumber().describe(
        'Income minus expenses in the default currency.'
    ),
    /** Total transaction count for the comparison period. */
    transactionCount: number().describe(
        'Total transaction count for the comparison period.'
    ),
    /** Expense transaction count for the comparison period. */
    expenseCount: number().describe(
        'Expense transaction count for the comparison period.'
    ),
    /** Income transaction count for the comparison period. */
    incomeCount: number().describe(
        'Income transaction count for the comparison period.'
    )
}).schemaName('StatsComparison');

export const StatsOverviewSchema = object({
    /** Stats trend grouping. */
    groupBy: StatsGroupBySchema.describe('Stats trend grouping.'),
    /** Stats reporting timeframe. */
    timeframe: StatsTimeframeSchema.describe('Stats reporting timeframe.'),
    /** Period start timestamp. */
    from: date().coerce().describe('Period start timestamp.'),
    /** Period end timestamp. */
    to: date().coerce().describe('Period end timestamp.'),
    /** Currency used for totals. */
    currency: CurrencyCodeSchema.describe('Currency used for totals.'),
    /** Net expenses in the default currency after reversals. */
    expenseTotal: decimalNumber().describe(
        'Net expenses in the default currency after reversals.'
    ),
    /** Net income in the default currency after reversals. */
    incomeTotal: decimalNumber().describe(
        'Net income in the default currency after reversals.'
    ),
    /** Income minus expenses in the default currency. */
    netTotal: decimalNumber().describe(
        'Income minus expenses in the default currency.'
    ),
    /** Savings rate for the period, as a percentage. */
    savingsRate: decimalNumber().describe(
        'Savings rate for the period, as a percentage.'
    ),
    /** Total transaction count for the period. */
    transactionCount: number().describe(
        'Total transaction count for the period.'
    ),
    /** Expense transaction count for the period. */
    expenseCount: number().describe(
        'Expense transaction count for the period.'
    ),
    /** Income transaction count for the period. */
    incomeCount: number().describe('Income transaction count for the period.'),
    /** Average expense transaction amount. */
    averageExpense: decimalNumber().describe(
        'Average expense transaction amount.'
    ),
    /** Average income transaction amount. */
    averageIncome: decimalNumber().describe(
        'Average income transaction amount.'
    ),
    /** Highest-spend expense category name, or an empty string. */
    largestExpenseCategory: string().describe(
        'Highest-spend expense category name, or an empty string.'
    ),
    /** Highest-income category name, or an empty string. */
    largestIncomeCategory: string().describe(
        'Highest-income category name, or an empty string.'
    ),
    /** Time buckets for trend charts. */
    trend: array(StatsTrendPointSchema).describe(
        'Time buckets for trend charts.'
    ),
    /** Category totals and shares for the selected period. */
    byCategory: array(StatsCategoryTotalSchema).describe(
        'Category totals and shares for the selected period.'
    ),
    /** Comparison totals for matching prior periods. */
    comparison: object({
        /** Matching previous period totals. */
        previousPeriod: StatsComparisonSchema.describe(
            'Matching previous period totals.'
        ),
        /** Same selected period one year earlier. */
        previousYear: StatsComparisonSchema.describe(
            'Same selected period one year earlier.'
        )
    }).describe('Comparison totals for matching prior periods.')
}).schemaName('StatsOverview');

export const DashboardSummarySchema = object({
    /** Reporting period used for the summary. */
    period: PeriodSchema.describe('Reporting period used for the summary.'),
    /** Period start timestamp. */
    from: date().coerce().describe('Period start timestamp.'),
    /** Period end timestamp. */
    to: date().coerce().describe('Period end timestamp.'),
    /** Currency used for totals. */
    currency: CurrencyCodeSchema.describe('Currency used for totals.'),
    /** Net expenses in the default currency after reversals. */
    expenseTotal: decimalNumber().describe(
        'Net expenses in the default currency after reversals.'
    ),
    /** Net income in the default currency after reversals. */
    incomeTotal: decimalNumber().describe(
        'Net income in the default currency after reversals.'
    ),
    /** Category totals for the selected period. */
    byCategory: array(DashboardCategoryTotalSchema).describe(
        'Category totals for the selected period.'
    )
}).schemaName('DashboardSummary');

export const DashboardWindowItemSchema = object({
    /** Stable local date key for the period start. */
    date: string().describe('Stable local date key for the period start.'),
    /** Summary for the matching dashboard period. */
    summary: DashboardSummarySchema.describe(
        'Summary for the matching dashboard period.'
    )
}).schemaName('DashboardWindowItem');

export const DashboardWindowResponseSchema = object({
    /** Ordered dashboard summaries for the requested period window. */
    items: array(DashboardWindowItemSchema).describe(
        'Ordered dashboard summaries for the requested period window.'
    )
}).schemaName('DashboardWindowResponse');

export const StatsWindowItemSchema = object({
    /** Stable local date key for the period start. */
    date: string().describe('Stable local date key for the period start.'),
    /** Stats overview for the matching dashboard period. */
    overview: StatsOverviewSchema.describe(
        'Stats overview for the matching dashboard period.'
    )
}).schemaName('StatsWindowItem');

export const StatsWindowResponseSchema = object({
    /** Ordered stats overviews for the requested period window. */
    items: array(StatsWindowItemSchema).describe(
        'Ordered stats overviews for the requested period window.'
    )
}).schemaName('StatsWindowResponse');

export const CategoryTrendPointSchema = object({
    /** Stable bucket key. */
    bucket: string().describe('Stable bucket key.'),
    /** Short label shown on charts. */
    label: string().describe('Short label shown on charts.'),
    /** Bucket start timestamp, clipped to the selected range. */
    from: date()
        .coerce()
        .describe('Bucket start timestamp, clipped to the selected range.'),
    /** Bucket end timestamp, clipped to the selected range. */
    to: date()
        .coerce()
        .describe('Bucket end timestamp, clipped to the selected range.'),
    /** Net category total in the user's default currency after reversals. */
    total: decimalNumber().describe(
        "Net category total in the user's default currency after reversals."
    ),
    /** Number of transactions in the bucket. */
    transactionCount: number().describe('Number of transactions in the bucket.')
}).schemaName('CategoryTrendPoint');

export const CategoryTrendResponseSchema = object({
    /** Category identifier. */
    categoryId: number().describe('Category identifier.'),
    /** Category name shown in reports. */
    categoryName: string().describe('Category name shown in reports.'),
    /** Whether this category is for expenses or income. */
    type: CategoryTypeSchema.describe(
        'Whether this category is for expenses or income.'
    ),
    /** Category trend timeframe. */
    range: CategoryTrendRangeSchema.describe('Category trend timeframe.'),
    /** Category trend grouping. */
    groupBy: CategoryTrendGroupBySchema.describe('Category trend grouping.'),
    /** Selected range start timestamp. */
    from: date().coerce().describe('Selected range start timestamp.'),
    /** Selected range end timestamp. */
    to: date().coerce().describe('Selected range end timestamp.'),
    /** Currency used for totals. */
    currency: CurrencyCodeSchema.describe('Currency used for totals.'),
    /** Net category total in the user's default currency after reversals. */
    total: decimalNumber().describe(
        "Net category total in the user's default currency after reversals."
    ),
    /** Number of selected-range transactions in the category. */
    transactionCount: number().describe(
        'Number of selected-range transactions in the category.'
    ),
    /** Number of buckets in the selected range. */
    bucketCount: number().describe('Number of buckets in the selected range.'),
    /** Maximum bucket count returned with chart points. */
    maxBuckets: number().describe(
        'Maximum bucket count returned with chart points.'
    ),
    /** True when the selected range is too dense for chart points. */
    densityExceeded: boolean().describe(
        'True when the selected range is too dense for chart points.'
    ),
    /** Bucket totals for the selected category trend. */
    trend: array(CategoryTrendPointSchema).describe(
        'Bucket totals for the selected category trend.'
    )
}).schemaName('CategoryTrendResponse');

export type Principal = InferType<typeof PrincipalSchema>;
export type RegisterBody = InferType<typeof RegisterBodySchema>;
export type LoginBody = InferType<typeof LoginBodySchema>;
export type PassportResolveUserBody = InferType<
    typeof PassportResolveUserBodySchema
>;
export type PassportResolveUserResponse = InferType<
    typeof PassportResolveUserResponseSchema
>;
export type PassportExchangeBody = InferType<typeof PassportExchangeBodySchema>;
export type TokenResponse = InferType<typeof TokenResponseSchema>;
export type UserPreference = InferType<typeof UserPreferenceSchema>;
export type ApiKey = InferType<typeof ApiKeySchema>;
export type CreateApiKeyBody = InferType<typeof CreateApiKeyBodySchema>;
export type CreateApiKeyResponse = InferType<typeof CreateApiKeyResponseSchema>;
export type TelegramConnectionStatus = InferType<
    typeof TelegramConnectionStatusSchema
>;
export type LinkTelegramAccountBody = InferType<
    typeof LinkTelegramAccountBodySchema
>;
export type TelegramTokenBody = InferType<typeof TelegramTokenBodySchema>;
export type LinkTelegramAccountResponse = InferType<
    typeof LinkTelegramAccountResponseSchema
>;
export type Currency = InferType<typeof CurrencySchema>;
export type CurrencyConversionQuery = InferType<
    typeof CurrencyConversionQuerySchema
>;
export type CurrencyConversion = InferType<typeof CurrencyConversionSchema>;
export type Category = InferType<typeof CategorySchema>;
export type CategoryListQuery = InferType<typeof CategoryListQuerySchema>;
export type CreateCategoryBody = InferType<typeof CreateCategoryBodySchema>;
export type TransactionEffect = InferType<typeof TransactionEffectSchema>;
export type Transaction = InferType<typeof TransactionSchema>;
export type CreateTransactionBody = InferType<
    typeof CreateTransactionBodySchema
>;
export type TransactionListQuery = InferType<typeof TransactionListQuerySchema>;
export type DashboardSummary = InferType<typeof DashboardSummarySchema>;
export type DashboardWindowResponse = InferType<
    typeof DashboardWindowResponseSchema
>;
export type StatsWindowResponse = InferType<typeof StatsWindowResponseSchema>;
export type StatsOverview = InferType<typeof StatsOverviewSchema>;
export type StatsQuery = InferType<typeof StatsQuerySchema>;
export type CategoryTrendGroupBy = InferType<typeof CategoryTrendGroupBySchema>;
export type CategoryTrendRange = InferType<typeof CategoryTrendRangeSchema>;
export type CategoryTrendQuery = InferType<typeof CategoryTrendQuerySchema>;
export type CategoryTrendResponse = InferType<
    typeof CategoryTrendResponseSchema
>;
