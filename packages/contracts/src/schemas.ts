import {
    array,
    boolean,
    date,
    enumOf,
    type InferType,
    nul,
    number,
    object,
    string,
    union
} from '@cleverbrush/schema';
import { FieldLimits, TransactionTagLimits } from './limits.js';

export const CurrencyCodeSchema = string()
    .required('currency is required')
    .nonempty('currency is required')
    .matches(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO 4217 code')
    .describe('ISO 4217 currency code, for example USD or EUR.');

export const CountryCodeSchema = string()
    .required('country is required')
    .nonempty('country is required')
    .matches(/^[A-Z]{2}$/, 'country must be a 2-letter ISO 3166-1 code')
    .describe('ISO 3166-1 alpha-2 country code, for example US or UA.');

export const TimeZoneSchema = string()
    .required('timezone is required')
    .nonempty('timezone is required')
    .maxLength(FieldLimits.timeZone, 'timezone is too long')
    .addValidator(value => {
        if (value.length > FieldLimits.timeZone) {
            return { valid: true };
        }

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
    .describe(
        'IANA time zone identifier, for example UTC or America/New_York.'
    );

function isHttpsUrl(value: string): boolean {
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

export const CategoryTypeSchema = enumOf('expense', 'income')
    .required('category type is required')
    .describe('Whether a category is used for expenses or income.');

export const CategoryKindSchema = enumOf('normal', 'offset')
    .default('normal')
    .describe(
        'Whether transactions in this category report on the same or opposite side.'
    );

export const PeriodSchema = enumOf(
    'day',
    'week',
    'month',
    'quarter',
    'year'
).describe('Dashboard reporting period.');

export const StatsGroupBySchema = enumOf(
    'hour',
    'day',
    'week',
    'month'
).describe('Stats trend grouping.');

export const CategoryTrendGroupBySchema = enumOf(
    'day',
    'week',
    'month',
    'year'
).describe('Category trend grouping.');

export const CategoryTrendRangeSchema = enumOf(
    'last-30-days',
    'last-90-days',
    'this-year',
    'last-12-months',
    'all-time',
    'custom'
).describe('Category trend timeframe.');

export const StatsTimeframeSchema = enumOf(
    'this-week',
    'last-7-days',
    'this-month',
    'last-month',
    'last-30-days',
    'custom'
).describe('Stats reporting timeframe.');

export const SortDirectionSchema = enumOf('asc', 'desc').describe(
    'Sort direction.'
);

const decimalNumber = () => number().clearIsInteger();

function hasAtMostTwoDecimalPlaces(value: number): boolean {
    const scaled = value * 100;
    const nearestCent = Math.round(scaled);
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
    return Math.abs(scaled - nearestCent) <= tolerance;
}

function normalizedTransactionTagName(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function validateTransactionTagNames(
    tags: readonly string[] | undefined,
    property: (field: any) => any
) {
    if (!tags) {
        return { valid: true };
    }

    const names = tags.map(normalizedTransactionTagName);
    if (names.some(name => name === '')) {
        return {
            valid: false,
            errors: [
                {
                    message: 'tag name is required',
                    property
                }
            ]
        };
    }

    const uniqueNames = new Set(names.map(name => name.toLowerCase()));
    if (uniqueNames.size > TransactionTagLimits.maxTagsPerTransaction) {
        return {
            valid: false,
            errors: [
                {
                    message: `transactions can have at most ${TransactionTagLimits.maxTagsPerTransaction} tags`,
                    property
                }
            ]
        };
    }

    return { valid: true };
}

export const ErrorResponseSchema = object({
    /** Human-readable error message safe to show to the current user. */
    message: string().describe(
        'Human-readable error message safe to show to the current user.'
    )
}).schemaName('ErrorResponse');

export const ImageMimeTypeSchema = enumOf(
    'image/jpeg',
    'image/png',
    'image/webp'
).describe('Supported image MIME type.');

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
        .maxLength(FieldLimits.email, 'email is too long')
        .email('must be a valid email address')
        .describe('Email address used to sign in. Must be unique.'),
    /** Password for local sign-in. */
    password: string()
        .required('password is required')
        .nonempty('password is required')
        .minLength(8, 'password must be at least 8 characters')
        .maxLength(FieldLimits.password, 'password is too long')
        .describe('Password for local sign-in.'),
    /** Password confirmation entered during registration. */
    confirmPassword: string()
        .required('password confirmation is required')
        .nonempty('password confirmation is required')
        .minLength(8, 'password confirmation must be at least 8 characters')
        .maxLength(FieldLimits.password, 'password confirmation is too long')
        .describe('Password confirmation entered during registration.'),
    /** Default currency used for dashboards and reports. */
    defaultCurrency: CurrencyCodeSchema.describe(
        'Default currency used for dashboards and reports.'
    ),
    /** Country used to localize vendor enrichment. */
    countryCode: CountryCodeSchema.describe(
        'Country used to localize vendor enrichment.'
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
        .maxLength(FieldLimits.email, 'email is too long')
        .email('must be a valid email address')
        .describe('Email address used to sign in.'),
    /** Local account password. */
    password: string()
        .required('password is required')
        .nonempty('password is required')
        .maxLength(FieldLimits.password, 'password is too long')
        .describe('Local account password.')
}).schemaName('LoginBody');

export const EmailConfirmationPendingResponseSchema = object({
    /** Email address that must be confirmed before local sign-in. */
    email: string().describe(
        'Email address that must be confirmed before local sign-in.'
    ),
    /** True when the local account must confirm email before sign-in. */
    verificationRequired: boolean().describe(
        'True when the local account must confirm email before sign-in.'
    ),
    /** User-facing confirmation instructions. */
    message: string().describe('User-facing confirmation instructions.')
}).schemaName('EmailConfirmationPendingResponse');

export const ConfirmEmailBodySchema = object({
    /** One-time email confirmation token from the magic link. */
    token: string()
        .required('confirmation token is required')
        .nonempty('confirmation token is required')
        .maxLength(
            FieldLimits.confirmationToken,
            'confirmation token is too long'
        )
        .describe('One-time email confirmation token from the magic link.')
}).schemaName('ConfirmEmailBody');

export const ResendEmailConfirmationBodySchema = object({
    /** Email address that should receive a fresh confirmation link. */
    email: string()
        .required('email is required')
        .nonempty('email is required')
        .maxLength(FieldLimits.email, 'email is too long')
        .email('must be a valid email address')
        .describe(
            'Email address that should receive a fresh confirmation link.'
        )
}).schemaName('ResendEmailConfirmationBody');

export const EmailConfirmationMessageResponseSchema = object({
    /** User-facing confirmation message. */
    message: string().describe('User-facing confirmation message.')
}).schemaName('EmailConfirmationMessageResponse');

export const PassportResolveUserBodySchema = object({
    /** Identity provider resolved by Passport. */
    provider: string()
        .required('provider is required')
        .nonempty('provider is required')
        .maxLength(FieldLimits.passportProvider, 'provider is too long')
        .describe('Identity provider resolved by Passport.'),
    /** Provider-specific subject identifier. */
    provider_subject: string()
        .required('provider subject is required')
        .nonempty('provider subject is required')
        .maxLength(FieldLimits.passportSubject, 'provider subject is too long')
        .describe('Provider-specific subject identifier.'),
    /** Verified email address returned by the provider. */
    email: string()
        .required('email is required')
        .nonempty('email is required')
        .maxLength(FieldLimits.email, 'email is too long')
        .email('must be a valid email address')
        .describe('Verified email address returned by the provider.'),
    /** Whether the provider verified the email address. */
    email_verified: boolean()
        .required('email verification is required')
        .describe('Whether the provider verified the email address.'),
    /** Display name returned by the provider. */
    name: string()
        .optional()
        .maxLength(FieldLimits.passportDisplayName, 'display name is too long')
        .describe('Display name returned by the provider.'),
    /** Avatar URL returned by the provider. */
    avatar_url: string()
        .optional()
        .maxLength(FieldLimits.passportAvatarUrl, 'avatar URL is too long')
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
        .maxLength(
            FieldLimits.passportAuthorizationCode,
            'authorization code is too long'
        )
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

export const GoogleSignInBodySchema = object({
    /** Stable Google account subject returned by Auth.js. */
    providerSubject: string()
        .required('provider subject is required')
        .nonempty('provider subject is required')
        .maxLength(FieldLimits.passportSubject, 'provider subject is too long')
        .describe('Stable Google account subject returned by Auth.js.'),
    /** Verified email address returned by Google. */
    email: string()
        .required('email is required')
        .nonempty('email is required')
        .maxLength(FieldLimits.email, 'email is too long')
        .email('must be a valid email address')
        .describe('Verified email address returned by Google.'),
    /** Whether Google verified the email address. */
    emailVerified: boolean()
        .required('email verification is required')
        .describe('Whether Google verified the email address.'),
    /** Display name returned by Google. */
    name: string()
        .optional()
        .maxLength(FieldLimits.passportDisplayName, 'display name is too long')
        .describe('Display name returned by Google.'),
    /** Avatar URL returned by Google. */
    avatarUrl: string()
        .optional()
        .maxLength(FieldLimits.passportAvatarUrl, 'avatar URL is too long')
        .describe('Avatar URL returned by Google.')
}).schemaName('GoogleSignInBody');

export const SessionTokenBodySchema = object({
    /** Authenticated user identifier stored in the trusted web session. */
    userId: number().describe(
        'Authenticated user identifier stored in the trusted web session.'
    )
}).schemaName('SessionTokenBody');

export const BudgetRoleSchema = enumOf('admin', 'member').describe(
    'Budget access role.'
);

export const BudgetPermissionsSchema = object({
    canCreateTransactions: boolean().describe(
        'Allows creating transactions in the budget.'
    ),
    canUpdateTransactions: boolean().describe(
        'Allows updating transactions in the budget.'
    ),
    canDeleteTransactions: boolean().describe(
        'Allows deleting transactions from the budget.'
    ),
    canManageCategories: boolean().describe(
        'Allows creating, editing, archiving, and deleting budget categories.'
    ),
    canManageVendors: boolean().describe(
        'Allows creating and editing budget vendors.'
    ),
    canManageTags: boolean().describe(
        'Allows creating and assigning transaction tags in the budget.'
    ),
    canManageMembers: boolean().describe(
        'Allows inviting, editing, and removing budget members.'
    )
});

export const BudgetSchema = object({
    /** Unique budget identifier. */
    id: number().describe('Unique budget identifier.'),
    /** Budget name shown in navigation and reports. */
    name: string().describe('Budget name shown in navigation and reports.'),
    /** Default currency used for new transactions and reports in this budget. */
    defaultCurrency: CurrencyCodeSchema.describe(
        'Default currency used for new transactions and reports in this budget.'
    ),
    /** Country used to localize vendor enrichment in this budget. */
    countryCode: CountryCodeSchema.describe(
        'Country used to localize vendor enrichment in this budget.'
    ),
    /** Current user role in this budget. */
    role: BudgetRoleSchema.describe('Current user role in this budget.'),
    /** Current user permissions in this budget. */
    permissions: BudgetPermissionsSchema,
    /** True when this is the user main budget. */
    isMain: boolean().describe('True when this is the user main budget.'),
    /** Timestamp when the budget was archived and hidden from normal workflows. */
    archivedAt: date()
        .coerce()
        .nullable()
        .describe(
            'Timestamp when the budget was archived and hidden from normal workflows.'
        ),
    /** Creation timestamp. */
    createdAt: date().coerce().describe('Creation timestamp.'),
    /** Last update timestamp. */
    updatedAt: date().coerce().describe('Last update timestamp.')
}).schemaName('Budget');

export const BudgetMemberSchema = object({
    /** Budget identifier. */
    budgetId: number().describe('Budget identifier.'),
    /** User identifier. */
    userId: number().describe('User identifier.'),
    /** User email address. */
    email: string().describe('User email address.'),
    /** Member role. */
    role: BudgetRoleSchema.describe('Member role.'),
    /** Member permissions. */
    permissions: BudgetPermissionsSchema,
    /** Creation timestamp. */
    createdAt: date().coerce().describe('Creation timestamp.'),
    /** Last update timestamp. */
    updatedAt: date().coerce().describe('Last update timestamp.')
}).schemaName('BudgetMember');

const BudgetIdSchema = number()
    .coerce()
    .optional()
    .describe(
        'Budget identifier. Defaults to the authenticated user Main budget.'
    );

export const CreateBudgetBodySchema = object({
    /** Budget name shown in navigation and reports. */
    name: string()
        .required('budget name is required')
        .nonempty('budget name is required')
        .maxLength(FieldLimits.budgetName, 'budget name is too long')
        .describe('Budget name shown in navigation and reports.'),
    /** Default currency used for new transactions and reports in this budget. */
    defaultCurrency: CurrencyCodeSchema.optional().describe(
        'Default currency used for new transactions and reports in this budget.'
    ),
    /** Country used to localize vendor enrichment in this budget. */
    countryCode: CountryCodeSchema.optional().describe(
        'Country used to localize vendor enrichment in this budget.'
    )
}).schemaName('CreateBudgetBody');

export const UpdateBudgetBodySchema = object({
    /** Budget name shown in navigation and reports. */
    name: string()
        .minLength(1, 'budget name is required')
        .maxLength(FieldLimits.budgetName, 'budget name is too long')
        .optional()
        .describe('Budget name shown in navigation and reports.'),
    /** Default currency used for new transactions and reports in this budget. */
    defaultCurrency: CurrencyCodeSchema.optional().describe(
        'Default currency used for new transactions and reports in this budget.'
    ),
    /** Country used to localize vendor enrichment in this budget. */
    countryCode: CountryCodeSchema.optional().describe(
        'Country used to localize vendor enrichment in this budget.'
    ),
    /** Whether this budget should be archived or restored. */
    archived: boolean()
        .optional()
        .describe('Whether this budget should be archived or restored.')
}).schemaName('UpdateBudgetBody');

export const ListBudgetsQuerySchema = object({
    /** Budget lifecycle status to include. */
    status: enumOf('active', 'archived', 'all')
        .optional()
        .describe('Budget lifecycle status to include.')
}).schemaName('ListBudgetsQuery');

export const TransactionCreatorSchema = object({
    /** User identifier that created the transaction. */
    userId: number().describe('User identifier that created the transaction.'),
    /** Creator email address. */
    email: string().describe('Creator email address.')
}).schemaName('TransactionCreator');

export const InviteBudgetMemberBodySchema = object({
    /** Email address to invite. */
    email: string()
        .required('email is required')
        .nonempty('email is required')
        .maxLength(FieldLimits.email, 'email is too long')
        .email('must be a valid email address')
        .describe('Email address to invite.'),
    /** Role to grant when the invitation is accepted. */
    role: BudgetRoleSchema.default('member').describe(
        'Role to grant when the invitation is accepted.'
    ),
    /** Permissions to grant when the invitation is accepted. */
    permissions: BudgetPermissionsSchema.optional()
}).schemaName('InviteBudgetMemberBody');

export const UpdateBudgetMemberBodySchema = object({
    /** Updated member role. */
    role: BudgetRoleSchema.describe('Updated member role.'),
    /** Updated member permissions. */
    permissions: BudgetPermissionsSchema
}).schemaName('UpdateBudgetMemberBody');

export const AcceptBudgetInvitationBodySchema = object({
    /** One-time budget invitation token from the magic link. */
    token: string()
        .required('invitation token is required')
        .nonempty('invitation token is required')
        .maxLength(
            FieldLimits.budgetInviteToken,
            'invitation token is too long'
        )
        .describe('One-time budget invitation token from the magic link.')
}).schemaName('AcceptBudgetInvitationBody');

export const BudgetInvitationResponseSchema = object({
    /** User-facing invitation status message. */
    message: string().describe('User-facing invitation status message.')
}).schemaName('BudgetInvitationResponse');

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
        /** Country used to localize vendor enrichment. */
        countryCode: CountryCodeSchema.describe(
            'Country used to localize vendor enrichment.'
        ),
        /** Time zone used for transaction display and reporting periods. */
        timezone: TimeZoneSchema.describe(
            'Time zone used for transaction display and reporting periods.'
        ),
        /** User Main budget identifier. */
        mainBudgetId: number()
            .nullable()
            .describe('User Main budget identifier.'),
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
    /** Country used to localize vendor enrichment. */
    countryCode: CountryCodeSchema.describe(
        'Country used to localize vendor enrichment.'
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
    /** User Main budget identifier. */
    mainBudgetId: number().nullable().describe('User Main budget identifier.'),
    /** Budgets accessible to this user. */
    budgets: array(BudgetSchema).describe('Budgets accessible to this user.'),
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
        .maxLength(FieldLimits.apiKeyName, 'API key name is too long')
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
    apiKey: ApiKeySchema
}).schemaName('CreateApiKeyResponse');

export const McpOAuthConnectionSchema = object({
    /** Unique MCP OAuth connection identifier. */
    id: number().describe('Unique MCP OAuth connection identifier.'),
    /** MCP client identifier issued during registration. */
    clientId: string().describe(
        'MCP client identifier issued during registration.'
    ),
    /** Client-provided name shown to the user. */
    clientName: string().describe('Client-provided name shown to the user.'),
    /** Creation timestamp. */
    createdAt: date().coerce().describe('Creation timestamp.'),
    /** Last time this connection authenticated MCP access, when available. */
    lastUsedAt: date()
        .coerce()
        .optional()
        .describe(
            'Last time this connection authenticated MCP access, when available.'
        )
}).schemaName('McpOAuthConnection');

const McpOAuthAuthorizationFields = {
    /** OAuth response type. xpenser supports authorization code only. */
    response_type: string()
        .required('response_type is required')
        .nonempty('response_type is required')
        .describe('OAuth response type. xpenser supports code only.'),
    /** Registered MCP OAuth client identifier. */
    client_id: string()
        .required('client_id is required')
        .nonempty('client_id is required')
        .describe('Registered MCP OAuth client identifier.'),
    /** Redirect URI registered by the MCP client. */
    redirect_uri: string()
        .required('redirect_uri is required')
        .nonempty('redirect_uri is required')
        .describe('Redirect URI registered by the MCP client.'),
    /** PKCE S256 code challenge. */
    code_challenge: string()
        .required('code_challenge is required')
        .nonempty('code_challenge is required')
        .describe('PKCE S256 code challenge.'),
    /** PKCE challenge method. xpenser requires S256. */
    code_challenge_method: string()
        .required('code_challenge_method is required')
        .nonempty('code_challenge_method is required')
        .describe('PKCE challenge method. xpenser requires S256.'),
    /** Opaque client state returned unchanged to the redirect URI. */
    state: string()
        .optional()
        .describe(
            'Opaque client state returned unchanged to the redirect URI.'
        ),
    /** Requested OAuth scope. xpenser supports the mcp scope. */
    scope: string()
        .optional()
        .describe('Requested OAuth scope. xpenser supports the mcp scope.')
};

export const McpOAuthAuthorizationQuerySchema = object(
    McpOAuthAuthorizationFields
).schemaName('McpOAuthAuthorizationQuery');

export const McpOAuthAuthorizationRequestSchema = object({
    /** Client-provided name shown to the user. */
    clientName: string().describe('Client-provided name shown to the user.'),
    /** Redirect URI that will receive the authorization code. */
    redirectUri: string().describe(
        'Redirect URI that will receive the authorization code.'
    ),
    /** OAuth scope that will be granted. */
    scope: string().describe('OAuth scope that will be granted.')
}).schemaName('McpOAuthAuthorizationRequest');

export const McpOAuthAuthorizeBodySchema = object(
    McpOAuthAuthorizationFields
).schemaName('McpOAuthAuthorizeBody');

export const McpOAuthAuthorizeResponseSchema = object({
    /** Redirect URL containing either the authorization code or OAuth error. */
    redirectUrl: string().describe(
        'Redirect URL containing either the authorization code or OAuth error.'
    )
}).schemaName('McpOAuthAuthorizeResponse');

export const UpdateUserPreferenceBodySchema = object({
    /** Default currency used for reports and new transactions. */
    defaultCurrency: CurrencyCodeSchema.describe(
        'Default currency used for reports and new transactions.'
    ),
    /** Country used to localize vendor enrichment. */
    countryCode: CountryCodeSchema.optional().describe(
        'Country used to localize vendor enrichment.'
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
        .maxLength(FieldLimits.telegramUserId, 'Telegram user id is too long')
        .describe(
            'Telegram user identifier, sent as a string to avoid precision issues.'
        ),
    /** Telegram username, when available. */
    telegramUsername: string()
        .maxLength(
            FieldLimits.telegramUsername,
            'Telegram username is too long'
        )
        .optional()
        .describe('Telegram username, when available.'),
    /** Telegram first name, when available. */
    telegramFirstName: string()
        .maxLength(
            FieldLimits.telegramFirstName,
            'Telegram first name is too long'
        )
        .optional()
        .describe('Telegram first name, when available.'),
    /** Telegram last name, when available. */
    telegramLastName: string()
        .maxLength(
            FieldLimits.telegramLastName,
            'Telegram last name is too long'
        )
        .optional()
        .describe('Telegram last name, when available.')
}).schemaName('TelegramUserBody');

export const LinkTelegramAccountBodySchema = object({
    /** Random one-time token from the Telegram deep link payload. */
    token: string()
        .required('link token is required')
        .nonempty('link token is required')
        .maxLength(FieldLimits.telegramLinkToken, 'link token is too long')
        .describe('Random one-time token from the Telegram deep link payload.'),
    /** Telegram account to link to the xpenser account that owns the token. */
    telegramUser: TelegramUserBodySchema
}).schemaName('LinkTelegramAccountBody');

export const TelegramTokenBodySchema = object({
    /** Telegram account requesting a short-lived xpenser API token. */
    telegramUser: TelegramUserBodySchema
}).schemaName('TelegramTokenBody');

export const LinkTelegramAccountResponseSchema = object({
    /** Connected xpenser user identifier. */
    userId: number().describe('Connected xpenser user identifier.'),
    /** Connected xpenser user email address. */
    email: string().describe('Connected xpenser user email address.'),
    /** Current Telegram connection status. */
    telegram: TelegramConnectionStatusSchema
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
    /** Budget identifier. */
    budgetId: number().describe('Budget identifier.'),
    /** Category name shown in transaction forms and reports. */
    name: string().describe(
        'Category name shown in transaction forms and reports.'
    ),
    /** Whether this category is for expenses or income. */
    type: CategoryTypeSchema.describe(
        'Whether this category is for expenses or income.'
    ),
    /** Whether this category reports on its own side or the opposite side. */
    kind: CategoryKindSchema.describe(
        'Whether this category reports on its own side or the opposite side.'
    ),
    /** Optional parent category identifier for one-level nesting. */
    parentId: number()
        .nullable()
        .describe('Optional parent category identifier for one-level nesting.'),
    /** Parent category name, when this is a child category. */
    parentName: string()
        .optional()
        .describe('Parent category name, when this is a child category.'),
    /** Category path shown in transaction forms and reports. */
    displayName: string().describe(
        'Category path shown in transaction forms and reports.'
    ),
    /** True when one or more transactions reference this category. */
    inUse: boolean().describe(
        'True when one or more transactions reference this category.'
    ),
    /** True when this category has child categories. */
    hasChildren: boolean().describe(
        'True when this category has child categories.'
    ),
    /** Timestamp when the category was archived and hidden from new transactions. */
    archivedAt: date()
        .coerce()
        .nullable()
        .describe(
            'Timestamp when the category was archived and hidden from new transactions.'
        ),
    /** Creation timestamp. */
    createdAt: date().coerce().describe('Creation timestamp.'),
    /** Last update timestamp. */
    updatedAt: date().coerce().describe('Last update timestamp.')
}).schemaName('Category');

export const CategoryListQuerySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
    /** Optional category ordering mode. */
    sort: enumOf('recent-transaction-count')
        .optional()
        .describe('Optional category ordering mode.'),
    /** True to return only categories available for new transaction creation. */
    activeOnly: boolean()
        .coerce()
        .optional()
        .describe(
            'True to return only categories available for new transaction creation.'
        )
}).schemaName('CategoryListQuery');

export const CreateCategoryBodySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
    /** Category name shown in transaction forms and reports. */
    name: string()
        .required('category name is required')
        .nonempty('category name is required')
        .maxLength(FieldLimits.categoryName, 'category name is too long')
        .describe('Category name shown in transaction forms and reports.'),
    /** Whether this category is for expenses or income. */
    type: CategoryTypeSchema.describe(
        'Whether this category is for expenses or income.'
    ),
    /** Optional parent category identifier for one-level nesting. */
    parentId: number()
        .nullable()
        .optional()
        .describe('Optional parent category identifier for one-level nesting.'),
    /** Whether transactions in this category report on the same or opposite side. */
    kind: CategoryKindSchema.optional().describe(
        'Whether transactions in this category report on the same or opposite side.'
    )
}).schemaName('CreateCategoryBody');

export const UpdateCategoryBodySchema = object({
    /** Category name shown in transaction forms and reports. */
    name: string()
        .minLength(1, 'category name is required')
        .maxLength(FieldLimits.categoryName, 'category name is too long')
        .optional()
        .describe('Category name shown in transaction forms and reports.'),
    /** Whether this category is for expenses or income. */
    type: CategoryTypeSchema.optional().describe(
        'Whether this category is for expenses or income.'
    ),
    /** Optional parent category identifier for one-level nesting. */
    parentId: number()
        .nullable()
        .optional()
        .describe('Optional parent category identifier for one-level nesting.'),
    /** Whether transactions in this category report on the same or opposite side. */
    kind: CategoryKindSchema.optional().describe(
        'Whether transactions in this category report on the same or opposite side.'
    ),
    /** Whether this category should be archived or restored. */
    archived: boolean()
        .optional()
        .describe('Whether this category should be archived or restored.')
}).schemaName('UpdateCategoryBody');

export const MoveAndDeleteCategoryBodySchema = object({
    /** Category that should receive transactions before deleting the selected category. */
    replacementCategoryId: number().describe(
        'Category that should receive transactions before deleting the selected category.'
    )
}).schemaName('MoveAndDeleteCategoryBody');

export const VendorEnrichmentStatusSchema = enumOf(
    'disabled',
    'success',
    'not_found',
    'failed'
);

export const VendorSchema = object({
    /** Unique vendor identifier. */
    id: number().describe('Unique vendor identifier.'),
    /** Budget identifier. */
    budgetId: number().describe('Budget identifier.'),
    /** User-entered vendor name. */
    name: string().describe('User-entered vendor name.'),
    /** Vendor name shown in transaction forms and reports. */
    displayName: string().describe(
        'Vendor name shown in transaction forms and reports.'
    ),
    /** Provider-resolved vendor name, when available. */
    resolvedName: string()
        .optional()
        .describe('Provider-resolved vendor name, when available.'),
    /** Provider-resolved vendor domain, when available. */
    domain: string()
        .optional()
        .describe('Provider-resolved vendor domain, when available.'),
    /** Provider-resolved vendor description, when available. */
    description: string()
        .optional()
        .describe('Provider-resolved vendor description, when available.'),
    /** Provider-resolved logo URL, when available. */
    logoUrl: string()
        .optional()
        .describe('Provider-resolved logo URL, when available.'),
    /** Provider-resolved primary color hex code, when available. */
    primaryColor: string()
        .optional()
        .describe('Provider-resolved primary color hex code, when available.'),
    /** Vendor enrichment provider, when enrichment has been attempted. */
    enrichmentProvider: string()
        .optional()
        .describe(
            'Vendor enrichment provider, when enrichment has been attempted.'
        ),
    /** Latest vendor enrichment status, when enrichment has been attempted. */
    enrichmentStatus: VendorEnrichmentStatusSchema.optional().describe(
        'Latest vendor enrichment status, when enrichment has been attempted.'
    ),
    /** Timestamp for the latest enrichment attempt. */
    enrichedAt: date()
        .coerce()
        .optional()
        .describe('Timestamp for the latest enrichment attempt.'),
    /** Suggested category for this user and vendor, when history exists. */
    suggestedCategoryId: number()
        .optional()
        .describe(
            'Suggested category for this user and vendor, when history exists.'
        ),
    /** Suggested category display name, when history exists. */
    suggestedCategoryDisplayName: string()
        .optional()
        .describe('Suggested category display name, when history exists.'),
    /** Number of transactions linked to this vendor. */
    transactionCount: number().describe(
        'Number of transactions linked to this vendor.'
    ),
    /** Creation timestamp. */
    createdAt: date().coerce().describe('Creation timestamp.'),
    /** Last update timestamp. */
    updatedAt: date().coerce().describe('Last update timestamp.')
}).schemaName('Vendor');

export const VendorListQuerySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
    /** Text search applied to vendor names and domains. */
    search: string()
        .optional()
        .maxLength(FieldLimits.vendorSearch, 'vendor search query is too long')
        .describe('Text search applied to vendor names and domains.'),
    /** Maximum number of vendors to return. */
    limit: number()
        .coerce()
        .default(25)
        .describe('Maximum number of vendors to return.')
}).schemaName('VendorListQuery');

export const VendorCandidateSearchQuerySchema = object({
    /** Vendor name text to search through Brandfetch. */
    query: string()
        .required('vendor search query is required')
        .nonempty('vendor search query is required')
        .maxLength(FieldLimits.vendorSearch, 'vendor search query is too long')
        .describe('Vendor name text to search through Brandfetch.'),
    /** Maximum number of Brandfetch suggestions to return. */
    limit: number()
        .coerce()
        .default(6)
        .describe('Maximum number of Brandfetch suggestions to return.')
}).schemaName('VendorCandidateSearchQuery');

export const VendorCandidateDetailsQuerySchema = object({
    /** Brandfetch brand identifier. */
    brandfetchBrandId: string()
        .optional()
        .maxLength(
            FieldLimits.brandfetchBrandId,
            'Brandfetch brand identifier is too long'
        )
        .describe('Brandfetch brand identifier.'),
    /** Vendor domain returned by Brandfetch. */
    domain: string()
        .optional()
        .maxLength(FieldLimits.vendorDomain, 'domain is too long')
        .describe('Vendor domain returned by Brandfetch.')
})
    .addValidator(value => {
        if (value.brandfetchBrandId || value.domain) {
            return { valid: true };
        }

        return {
            valid: false,
            errors: [
                {
                    message:
                        'vendor candidate details require a brand ID or domain'
                }
            ]
        };
    })
    .schemaName('VendorCandidateDetailsQuery');

export const VendorCandidateSchema = object({
    /** Brandfetch brand identifier. */
    brandfetchBrandId: string()
        .optional()
        .maxLength(
            FieldLimits.brandfetchBrandId,
            'Brandfetch brand identifier is too long'
        )
        .describe('Brandfetch brand identifier.'),
    /** Vendor name returned by Brandfetch. */
    name: string()
        .maxLength(FieldLimits.vendorName, 'vendor name is too long')
        .describe('Vendor name returned by Brandfetch.'),
    /** Vendor domain returned by Brandfetch. */
    domain: string()
        .maxLength(FieldLimits.vendorDomain, 'domain is too long')
        .describe('Vendor domain returned by Brandfetch.'),
    /** Brandfetch icon URL for the vendor search result. */
    logoUrl: string()
        .optional()
        .maxLength(FieldLimits.vendorLogoUrl, 'logo URL is too long')
        .describe('Brandfetch icon URL for the vendor search result.'),
    /** Brandfetch description for the vendor candidate, when available. */
    description: string()
        .optional()
        .maxLength(FieldLimits.vendorDescription, 'description is too long')
        .describe('Brandfetch description for the vendor candidate.'),
    /** Brandfetch primary color hex code, when available. */
    primaryColor: string()
        .optional()
        .maxLength(FieldLimits.vendorPrimaryColor, 'primary color is too long')
        .describe('Brandfetch primary color hex code.'),
    /** Whether the brand has been claimed in Brandfetch. */
    claimed: boolean()
        .optional()
        .describe('Whether the brand has been claimed in Brandfetch.')
}).schemaName('VendorCandidate');

export const CreateVendorBodySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
    /** User-entered vendor name. */
    name: string()
        .required('vendor name is required')
        .nonempty('vendor name is required')
        .maxLength(FieldLimits.vendorName, 'vendor name is too long')
        .describe('User-entered vendor name.'),
    /** Brandfetch brand identifier selected from search results. */
    brandfetchBrandId: string()
        .optional()
        .maxLength(
            FieldLimits.brandfetchBrandId,
            'Brandfetch brand identifier is too long'
        )
        .describe('Brandfetch brand identifier selected from search results.'),
    /** Resolved name selected from Brandfetch search results. */
    resolvedName: string()
        .optional()
        .maxLength(FieldLimits.vendorName, 'resolved name is too long')
        .describe('Resolved name selected from Brandfetch search results.'),
    /** Vendor domain selected from Brandfetch search results. */
    domain: string()
        .optional()
        .maxLength(FieldLimits.vendorDomain, 'domain is too long')
        .describe('Vendor domain selected from Brandfetch search results.'),
    /** Vendor logo URL selected from Brandfetch search results. */
    logoUrl: string()
        .optional()
        .maxLength(FieldLimits.vendorLogoUrl, 'logo URL is too long')
        .describe('Vendor logo URL selected from Brandfetch search results.')
}).schemaName('CreateVendorBody');

export const UpdateVendorBodySchema = object({
    /** User-entered vendor name. */
    name: string()
        .optional()
        .nonempty('vendor name is required')
        .maxLength(FieldLimits.vendorName, 'vendor name is too long')
        .describe('User-entered vendor name.'),
    /** Manually adjusted resolved name. */
    resolvedName: string()
        .nullable()
        .optional()
        .maxLength(FieldLimits.vendorName, 'resolved name is too long')
        .describe('Manually adjusted resolved name.'),
    /** Manually adjusted vendor domain. */
    domain: string()
        .nullable()
        .optional()
        .maxLength(FieldLimits.vendorDomain, 'domain is too long')
        .describe('Manually adjusted vendor domain.'),
    /** Manually adjusted vendor description. */
    description: string()
        .nullable()
        .optional()
        .maxLength(FieldLimits.vendorDescription, 'description is too long')
        .describe('Manually adjusted vendor description.'),
    /** Manually adjusted logo URL. */
    logoUrl: string()
        .nullable()
        .optional()
        .maxLength(FieldLimits.vendorLogoUrl, 'logo URL is too long')
        .describe('Manually adjusted logo URL.'),
    /** Manually adjusted primary color hex code. */
    primaryColor: string()
        .nullable()
        .optional()
        .maxLength(FieldLimits.vendorPrimaryColor, 'primary color is too long')
        .describe('Manually adjusted primary color hex code.')
})
    .addValidator(value => {
        const logoUrl = value.logoUrl?.trim();
        if (!logoUrl || isHttpsUrl(logoUrl)) {
            return { valid: true };
        }

        return {
            valid: false,
            errors: [
                {
                    message: 'Logo URL must be a valid HTTPS URL.',
                    property: field => field.logoUrl
                }
            ]
        };
    })
    .addValidator(value => {
        const primaryColor = value.primaryColor?.trim();
        if (!primaryColor || /^#[0-9a-f]{6}$/i.test(primaryColor)) {
            return { valid: true };
        }

        return {
            valid: false,
            errors: [
                {
                    message: 'Primary color must be a six-digit hex color.',
                    property: field => field.primaryColor
                }
            ]
        };
    })
    .schemaName('UpdateVendorBody');

export const TransactionTagNameSchema = string()
    .maxLength(FieldLimits.transactionTagName, 'tag name is too long')
    .describe('User-entered transaction tag name.');

export const TransactionTagSchema = object({
    /** Unique transaction tag identifier. */
    id: number().describe('Unique transaction tag identifier.'),
    /** Budget identifier. */
    budgetId: number().describe('Budget identifier.'),
    /** User-entered transaction tag name. */
    name: string().describe('User-entered transaction tag name.'),
    /** Number of transactions currently using this tag. */
    transactionCount: number().describe(
        'Number of transactions currently using this tag.'
    ),
    /** Creation timestamp. */
    createdAt: date().coerce().describe('Creation timestamp.'),
    /** Last update timestamp. */
    updatedAt: date().coerce().describe('Last update timestamp.')
}).schemaName('TransactionTag');

export const TransactionTagListQuerySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
    /** Text search applied to transaction tag names. */
    search: string()
        .optional()
        .maxLength(
            FieldLimits.transactionTagSearch,
            'transaction tag search query is too long'
        )
        .describe('Text search applied to transaction tag names.'),
    /** Maximum number of tags to return. */
    limit: number()
        .coerce()
        .default(25)
        .describe('Maximum number of tags to return.')
}).schemaName('TransactionTagListQuery');

const TransactionTagNamesBodySchema = array(TransactionTagNameSchema)
    .maxLength(
        TransactionTagLimits.maxTagsPerTransaction,
        `transactions can have at most ${TransactionTagLimits.maxTagsPerTransaction} tags`
    )
    .optional()
    .describe('Transaction tag names.');

export const TransactionSchema = object({
    /** Unique transaction identifier. */
    id: number().describe('Unique transaction identifier.'),
    /** Budget identifier. */
    budgetId: number().describe('Budget identifier.'),
    /** Category identifier selected for the transaction. */
    categoryId: number().describe(
        'Category identifier selected for the transaction.'
    ),
    /** Vendor identifier selected for the transaction, when available. */
    vendorId: number()
        .nullable()
        .describe(
            'Vendor identifier selected for the transaction, when available.'
        ),
    /** Vendor name at read time, when available. */
    vendorName: string()
        .optional()
        .describe('Vendor name at read time, when available.'),
    /** Vendor logo URL at read time, when available. */
    vendorLogoUrl: string()
        .optional()
        .describe('Vendor logo URL at read time, when available.'),
    /** Category name at read time. */
    categoryName: string().describe('Category name at read time.'),
    /** Category path at read time. */
    categoryDisplayName: string().describe('Category path at read time.'),
    /** Optional parent category identifier at read time. */
    categoryParentId: number()
        .nullable()
        .describe('Optional parent category identifier at read time.'),
    /** Optional parent category name at read time. */
    categoryParentName: string()
        .optional()
        .describe('Optional parent category name at read time.'),
    /** Whether the selected category reports on the same or opposite side. */
    categoryKind: CategoryKindSchema.describe(
        'Whether the selected category reports on the same or opposite side.'
    ),
    /** Transaction direction. */
    type: CategoryTypeSchema.describe('Transaction direction.'),
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
    /** Tags assigned to this transaction. */
    tags: array(TransactionTagSchema).describe(
        'Tags assigned to this transaction.'
    ),
    /** User that originally created this transaction. */
    createdBy: TransactionCreatorSchema.describe(
        'User that originally created this transaction.'
    ),
    /** Original scanner image metadata when this transaction came from a scan. */
    scanAttachment: object({
        /** Scan session identifier. */
        scanId: number().describe('Scan session identifier.'),
        /** Scan item identifier linked to this transaction. */
        scanItemId: number().describe(
            'Scan item identifier linked to this transaction.'
        ),
        /** Original file name when available. */
        fileName: string()
            .nullable()
            .describe('Original file name when available.'),
        /** Stored image MIME type. */
        mimeType: ImageMimeTypeSchema.describe('Stored image MIME type.'),
        /** Original image size in bytes. */
        sizeBytes: number().describe('Original image size in bytes.'),
        /** Timestamp when the image was stored. */
        createdAt: date()
            .coerce()
            .describe('Timestamp when the image was stored.')
    })
        .optional()
        .nullable()
        .describe(
            'Original scanner image metadata when this transaction came from a scan.'
        ),
    /** Creation timestamp. */
    createdAt: date().coerce().describe('Creation timestamp.'),
    /** Last update timestamp. */
    updatedAt: date().coerce().describe('Last update timestamp.')
}).schemaName('Transaction');

export const CreateTransactionBodySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
    /** Category identifier selected for the transaction. */
    categoryId: number()
        .required('category is required')
        .describe('Category identifier selected for the transaction.'),
    /** Optional vendor identifier selected for the transaction. */
    vendorId: number()
        .nullable()
        .optional()
        .describe('Optional vendor identifier selected for the transaction.'),
    /** Amount entered by the user in the original currency. */
    amount: decimalNumber()
        .required('amount is required')
        .positive('amount must be greater than zero')
        .describe('Amount entered by the user in the original currency.'),
    /** Currency used for the entered amount. */
    currency: CurrencyCodeSchema.describe(
        'Currency used for the entered amount.'
    ),
    /** Date and time when the transaction happened. */
    occurredAt: date()
        .required('date and time is required')
        .coerce()
        .describe('Date and time when the transaction happened.'),
    /** Optional note entered by the user. */
    note: string()
        .maxLength(FieldLimits.transactionNote, 'note is too long')
        .optional()
        .describe('Optional note entered by the user.'),
    /** Optional tag names assigned to this transaction. */
    tags: TransactionTagNamesBodySchema
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
    .addValidator(value =>
        validateTransactionTagNames(value.tags, field => field.tags)
    )
    .schemaName('CreateTransactionBody');

export const UpdateTransactionBodySchema =
    CreateTransactionBodySchema.deepPartial().schemaName(
        'UpdateTransactionBody'
    );

export const TransactionListQuerySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
    /** Full text search applied to category name and note. */
    search: string()
        .optional()
        .maxLength(
            FieldLimits.transactionSearch,
            'transaction search query is too long'
        )
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
    /** Filter by a parent category and its direct children. */
    parentCategoryId: number()
        .coerce()
        .optional()
        .describe('Filter by a parent category and its direct children.'),
    /** Filter by vendor identifier, or "none" for transactions without a vendor. */
    vendorId: union(number().coerce())
        .or(string('none'))
        .optional()
        .describe(
            'Filter by vendor identifier, or "none" for transactions without a vendor.'
        ),
    /** Comma-separated tag identifiers. Matches transactions with every selected tag. */
    tagIds: string()
        .optional()
        .maxLength(
            FieldLimits.transactionSearch,
            'transaction tag filters are too long'
        )
        .matches(
            /^\d+(?:,\d+)*$/,
            'tag filters must be comma-separated tag ids'
        )
        .describe(
            'Comma-separated tag identifiers. Matches transactions with every selected tag.'
        ),
    /** True to match expense or income transactions without tags. */
    untagged: boolean()
        .coerce()
        .optional()
        .describe('True to match transactions without tags.'),
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

export const TransactionExportQuerySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
    /** Full text search applied to category name and note. */
    search: string()
        .optional()
        .maxLength(
            FieldLimits.transactionSearch,
            'transaction search query is too long'
        )
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
    /** Filter by a parent category and its direct children. */
    parentCategoryId: number()
        .coerce()
        .optional()
        .describe('Filter by a parent category and its direct children.'),
    /** Filter by vendor identifier, or "none" for transactions without a vendor. */
    vendorId: union(number().coerce())
        .or(string('none'))
        .optional()
        .describe(
            'Filter by vendor identifier, or "none" for transactions without a vendor.'
        ),
    /** Comma-separated tag identifiers. Matches transactions with every selected tag. */
    tagIds: string()
        .optional()
        .maxLength(
            FieldLimits.transactionSearch,
            'transaction tag filters are too long'
        )
        .matches(
            /^\d+(?:,\d+)*$/,
            'tag filters must be comma-separated tag ids'
        )
        .describe(
            'Comma-separated tag identifiers. Matches transactions with every selected tag.'
        ),
    /** True to match expense or income transactions without tags. */
    untagged: boolean()
        .coerce()
        .optional()
        .describe('True to match transactions without tags.'),
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
    /** Sort direction by occurrence date. */
    direction: SortDirectionSchema.default('desc').describe(
        'Sort direction by occurrence date.'
    ),
    /** Comma-separated ISO currencies to include as amount columns. */
    currencies: string()
        .required('export currencies are required')
        .nonempty('export currencies are required')
        .maxLength(200, 'export currency list is too long')
        .matches(
            /^[A-Z]{3}(?:,[A-Z]{3})*$/,
            'export currencies must be comma-separated ISO currency codes'
        )
        .describe(
            'Comma-separated ISO currencies to include as amount columns.'
        )
}).schemaName('TransactionExportQuery');

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

export const TransactionScanDocumentKindSchema = enumOf(
    'bank_app',
    'bank_statement',
    'invoice',
    'receipt',
    'other'
).describe('Type of uploaded transaction source inferred from the image.');

export const TransactionScanConfidenceSchema = enumOf(
    'high',
    'medium',
    'low'
).describe('Model confidence for a scanned transaction field.');

export const TransactionScanSuggestedCategorySchema = object({
    /** Suggested category name when no existing category fits. */
    name: string().describe(
        'Suggested category name when no existing category fits.'
    ),
    /** Suggested category direction. */
    type: CategoryTypeSchema.describe('Suggested category direction.'),
    /** Optional parent category identifier for a suggested subcategory. */
    parentId: number()
        .nullable()
        .describe(
            'Optional parent category identifier for a suggested subcategory.'
        ),
    /** Suggested category kind. */
    kind: CategoryKindSchema.describe('Suggested category kind.'),
    /** Short reason for suggesting this new category. */
    reason: string().describe('Short reason for suggesting this new category.')
}).schemaName('TransactionScanSuggestedCategory');

export const TransactionScanFieldConfidenceSchema = object({
    amount: TransactionScanConfidenceSchema.describe('Amount confidence.'),
    category: TransactionScanConfidenceSchema.describe('Category confidence.'),
    currency: TransactionScanConfidenceSchema.describe('Currency confidence.'),
    date: TransactionScanConfidenceSchema.describe('Date confidence.'),
    overall: TransactionScanConfidenceSchema.describe('Overall confidence.'),
    vendor: TransactionScanConfidenceSchema.describe('Vendor confidence.')
}).schemaName('TransactionScanFieldConfidence');

export const TransactionScanDraftSchema = object({
    /** Stable scan item identifier used to record the wizard decision. */
    id: number().describe(
        'Stable scan item identifier used to record the wizard decision.'
    ),
    /** Positive amount in the original currency, when visible. */
    amount: decimalNumber()
        .nullable()
        .describe('Positive amount in the original currency, when visible.'),
    /** Existing category identifier selected by the scanner, when available. */
    categoryId: number()
        .nullable()
        .describe(
            'Existing category identifier selected by the scanner, when available.'
        ),
    /** Scanner suggestion for a category that does not exist yet. */
    suggestedCategory: union(TransactionScanSuggestedCategorySchema)
        .or(nul())
        .describe('Scanner suggestion for a category that does not exist yet.'),
    /** Currency used for the scanned amount, when visible. */
    currency: CurrencyCodeSchema.nullable().describe(
        'Currency used for the scanned amount, when visible.'
    ),
    /** Date and time when the scanned transaction happened, when visible. */
    occurredAt: date()
        .coerce()
        .nullable()
        .describe(
            'Date and time when the scanned transaction happened, when visible.'
        ),
    /** Existing vendor identifier selected by the scanner, when available. */
    vendorId: number()
        .nullable()
        .describe(
            'Existing vendor identifier selected by the scanner, when available.'
        ),
    /** Vendor name suggested by the scanner when no existing vendor fits. */
    suggestedVendorName: string()
        .nullable()
        .describe(
            'Vendor name suggested by the scanner when no existing vendor fits.'
        ),
    /** Suggested transaction direction used to filter categories in the wizard. */
    transactionType: CategoryTypeSchema.describe(
        'Suggested transaction direction used to filter categories in the wizard.'
    ),
    /** Optional note generated from visible source context. */
    note: string()
        .nullable()
        .describe('Optional note generated from visible source context.'),
    /** Text from the image that supports this draft. */
    evidence: string().describe(
        'Text from the image that supports this draft.'
    ),
    /** Confidence by scanned field. */
    confidence: TransactionScanFieldConfidenceSchema,
    /** Existing transactions that may already represent this draft. */
    possibleDuplicateTransactionIds: array(number()).describe(
        'Existing transactions that may already represent this draft.'
    )
}).schemaName('TransactionScanDraft');

export const TransactionScanBodySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
    /** Raw uploaded image bytes encoded as base64, without a data URL prefix. */
    imageBase64: string()
        .required('image is required')
        .nonempty('image is required')
        .describe(
            'Raw uploaded image bytes encoded as base64, without a data URL prefix.'
        ),
    /** Uploaded image MIME type. */
    mimeType: ImageMimeTypeSchema.describe('Uploaded image MIME type.'),
    /** Original file name, when provided by the browser. */
    fileName: string()
        .optional()
        .describe('Original file name, when provided by the browser.')
}).schemaName('TransactionScanBody');

export const TransactionScanAttachmentBodySchema = object({
    /** Raw uploaded image bytes encoded as base64, without a data URL prefix. */
    imageBase64: string()
        .required('image is required')
        .nonempty('image is required')
        .describe(
            'Raw uploaded image bytes encoded as base64, without a data URL prefix.'
        ),
    /** Uploaded image MIME type. */
    mimeType: ImageMimeTypeSchema.describe('Uploaded image MIME type.'),
    /** Original file name, when provided by the browser. */
    fileName: string()
        .optional()
        .describe('Original file name, when provided by the browser.')
}).schemaName('TransactionScanAttachmentBody');

export const TransactionScanResponseSchema = object({
    /** Stable scan identifier. */
    scanId: number().describe('Stable scan identifier.'),
    /** Type of uploaded source inferred from the image. */
    documentKind: TransactionScanDocumentKindSchema.describe(
        'Type of uploaded source inferred from the image.'
    ),
    /** User-facing scanner warnings. */
    warnings: array(string()).describe('User-facing scanner warnings.'),
    /** Draft transactions that require user confirmation. */
    drafts: array(TransactionScanDraftSchema).describe(
        'Draft transactions that require user confirmation.'
    )
}).schemaName('TransactionScanResponse');

export const TransactionScanJobResponseSchema = object({
    /** Short-lived scan job identifier used by the progress subscription. */
    jobId: string().describe(
        'Short-lived scan job identifier used by the progress subscription.'
    ),
    /** One-time token scoped to this scan job. */
    token: string().describe('One-time token scoped to this scan job.')
}).schemaName('TransactionScanJobResponse');

export const TransactionScanProgressQuerySchema = object({
    /** Short-lived scan job identifier returned by the start endpoint. */
    jobId: string()
        .required('scan job is required')
        .nonempty('scan job is required')
        .describe(
            'Short-lived scan job identifier returned by the start endpoint.'
        ),
    /** One-time token scoped to this scan job. */
    token: string()
        .required('scan token is required')
        .nonempty('scan token is required')
        .describe('One-time token scoped to this scan job.')
}).schemaName('TransactionScanProgressQuery');

export const TransactionScanProgressStageSchema = enumOf(
    'queued',
    'preparing',
    'analyzing',
    'saving',
    'complete',
    'failed'
).describe('Current scanner job stage.');

export const TransactionScanProgressEventSchema = object({
    /** Short-lived scan job identifier. */
    jobId: string().describe('Short-lived scan job identifier.'),
    /** Current scanner job stage. */
    stage: TransactionScanProgressStageSchema.describe(
        'Current scanner job stage.'
    ),
    /** User-facing progress message. */
    message: string().describe('User-facing progress message.'),
    /** Approximate scan progress from 0 to 100. */
    progress: number().describe('Approximate scan progress from 0 to 100.'),
    /** Final scan result when the job completed successfully. */
    scan: union(TransactionScanResponseSchema)
        .or(nul())
        .describe('Final scan result when the job completed successfully.'),
    /** Safe user-facing failure message when the job failed. */
    error: string()
        .nullable()
        .describe('Safe user-facing failure message when the job failed.')
}).schemaName('TransactionScanProgressEvent');

export const TransactionScanDecisionSchema = enumOf('confirmed', 'discarded');

export const TransactionScanCorrectedTransactionSchema = object({
    /** Confirmed category identifier. */
    categoryId: number().describe('Confirmed category identifier.'),
    /** Confirmed vendor identifier, when selected. */
    vendorId: number()
        .nullable()
        .describe('Confirmed vendor identifier, when selected.'),
    /** Confirmed amount. */
    amount: decimalNumber().describe('Confirmed amount.'),
    /** Confirmed currency. */
    currency: CurrencyCodeSchema.describe('Confirmed currency.'),
    /** Confirmed transaction date. */
    occurredAt: date().coerce().describe('Confirmed transaction date.'),
    /** Confirmed note. */
    note: string().nullable().describe('Confirmed note.'),
    /** Confirmed tag names. */
    tags: TransactionTagNamesBodySchema
}).schemaName('TransactionScanCorrectedTransaction');

export const TransactionScanDecisionBodySchema = object({
    /** User decision for this scanned draft. */
    decision: TransactionScanDecisionSchema.describe(
        'User decision for this scanned draft.'
    ),
    /** Transaction created from this draft, when confirmed. */
    transactionId: number()
        .nullable()
        .optional()
        .describe('Transaction created from this draft, when confirmed.'),
    /** Category created inline for this draft, when applicable. */
    createdCategoryId: number()
        .nullable()
        .optional()
        .describe('Category created inline for this draft, when applicable.'),
    /** Vendor created inline for this draft, when applicable. */
    createdVendorId: number()
        .nullable()
        .optional()
        .describe('Vendor created inline for this draft, when applicable.'),
    /** Final user-corrected values, when confirmed. */
    correctedTransaction: union(TransactionScanCorrectedTransactionSchema)
        .or(nul())
        .optional()
        .describe('Final user-corrected values, when confirmed.'),
    /** Original scan image, stored once for confirmed transactions. */
    attachment: union(TransactionScanAttachmentBodySchema)
        .optional()
        .describe(
            'Original scan image, stored once for confirmed transactions.'
        )
}).schemaName('TransactionScanDecisionBody');

export const TransactionScanImageResponseSchema = object({
    /** Scan session identifier. */
    scanId: number().describe('Scan session identifier.'),
    /** Scan item identifier linked to this transaction. */
    scanItemId: number().describe(
        'Scan item identifier linked to this transaction.'
    ),
    /** Original file name when available. */
    fileName: string()
        .nullable()
        .describe('Original file name when available.'),
    /** Stored image MIME type. */
    mimeType: ImageMimeTypeSchema.describe('Stored image MIME type.'),
    /** Original image size in bytes. */
    sizeBytes: number().describe('Original image size in bytes.'),
    /** Timestamp when the image was stored. */
    createdAt: date().coerce().describe('Timestamp when the image was stored.'),
    /** Raw uploaded image bytes encoded as base64. */
    imageBase64: string().describe(
        'Raw uploaded image bytes encoded as base64.'
    )
}).schemaName('TransactionScanImageResponse');

export const DashboardQuerySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
    /** Reporting period. */
    period: PeriodSchema.default('day').describe('Reporting period.'),
    /** Date used to choose the reporting period. */
    date: date()
        .coerce()
        .optional()
        .describe('Date used to choose the reporting period.'),
    /** Currency used for dashboard totals. */
    currency: CurrencyCodeSchema.optional().describe(
        'Currency used for dashboard totals.'
    ),
    /** Maximum number of vendor groups to include. */
    vendorLimit: number()
        .coerce()
        .optional()
        .describe('Maximum number of vendor groups to include.')
}).schemaName('DashboardQuery');

export const PeriodWindowQuerySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
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

export const DashboardWindowQuerySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
    /** Reporting period. */
    period: PeriodSchema.default('day').describe('Reporting period.'),
    /** Date used to choose the center reporting period. */
    date: date()
        .coerce()
        .optional()
        .describe('Date used to choose the center reporting period.'),
    /** Currency used for dashboard totals. */
    currency: CurrencyCodeSchema.optional().describe(
        'Currency used for dashboard totals.'
    ),
    /** Number of previous periods to include. */
    before: number()
        .coerce()
        .default(2)
        .describe('Number of previous periods to include.'),
    /** Number of following periods to include. */
    after: number()
        .coerce()
        .default(2)
        .describe('Number of following periods to include.'),
    /** Maximum number of vendor groups to include in each summary. */
    vendorLimit: number()
        .coerce()
        .optional()
        .describe('Maximum number of vendor groups to include in each summary.')
}).schemaName('DashboardWindowQuery');

export const StatsQuerySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
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

export const StatsTagReportQuerySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
    /** Reporting period. */
    period: PeriodSchema.default('day').describe('Reporting period.'),
    /** Date used to choose the reporting period. */
    date: date()
        .coerce()
        .optional()
        .describe('Date used to choose the reporting period.'),
    /** Selected tag identifier, or "untagged" for transactions without tags. */
    tag: union(number().coerce())
        .or(string('untagged'))
        .optional()
        .describe(
            'Selected tag identifier, or "untagged" for transactions without tags.'
        )
}).schemaName('StatsTagReportQuery');

export const CategoryTrendQuerySchema = object({
    /** Budget identifier. Defaults to the authenticated user Main budget. */
    budgetId: BudgetIdSchema,
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

export const DashboardVendorTotalSchema = object({
    /** Vendor identifier, or null for transactions without a vendor. */
    vendorId: number()
        .nullable()
        .describe(
            'Vendor identifier, or null for transactions without a vendor.'
        ),
    /** Vendor display name. */
    vendorName: string().describe('Vendor display name.'),
    /** Vendor domain, when available. */
    vendorDomain: string()
        .optional()
        .describe('Vendor domain, when available.'),
    /** Vendor logo URL, when available. */
    vendorLogoUrl: string()
        .optional()
        .describe('Vendor logo URL, when available.'),
    /** Vendor primary vendors color, when available. */
    vendorPrimaryColor: string()
        .optional()
        .describe('Vendor primary vendors color, when available.'),
    /** Transaction direction for this vendor group. */
    type: CategoryTypeSchema.describe(
        'Transaction direction for this vendor group.'
    ),
    /** Total in the selected dashboard currency for this vendor group. */
    total: decimalNumber().describe(
        'Total in the selected dashboard currency for this vendor group.'
    ),
    /** Number of selected-period transactions in this vendor group. */
    transactionCount: number().describe(
        'Number of selected-period transactions in this vendor group.'
    ),
    /** Selected-period bucket totals for lightweight vendor charts. */
    trend: array(decimalNumber()).describe(
        'Selected-period bucket totals for lightweight vendor charts.'
    )
}).schemaName('DashboardVendorTotal');

export const DashboardCategoryTotalSchema = object({
    /** Category identifier. */
    categoryId: number().describe('Category identifier.'),
    /** Category name. */
    categoryName: string().describe('Category name.'),
    /** Category path. */
    categoryDisplayName: string().describe('Category path.'),
    /** Optional parent category identifier. */
    categoryParentId: number()
        .nullable()
        .describe('Optional parent category identifier.'),
    /** Optional parent category name. */
    categoryParentName: string()
        .optional()
        .describe('Optional parent category name.'),
    /** Whether this category reports on its own side or the opposite side. */
    categoryKind: CategoryKindSchema.describe(
        'Whether this category reports on its own side or the opposite side.'
    ),
    /** Transaction direction. */
    type: CategoryTypeSchema.describe('Transaction direction.'),
    /** Category total in the selected dashboard currency on the reported side. */
    total: decimalNumber().describe(
        'Category total in the selected dashboard currency on the reported side.'
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

export const DashboardCategoryVendorTotalSchema = object({
    /** Category identifier. */
    categoryId: number().describe('Category identifier.'),
    /** Category name. */
    categoryName: string().describe('Category name.'),
    /** Category path. */
    categoryDisplayName: string().describe('Category path.'),
    /** Optional parent category identifier. */
    categoryParentId: number()
        .nullable()
        .describe('Optional parent category identifier.'),
    /** Optional parent category name. */
    categoryParentName: string()
        .optional()
        .describe('Optional parent category name.'),
    /** Whether this category reports on its own side or the opposite side. */
    categoryKind: CategoryKindSchema.describe(
        'Whether this category reports on its own side or the opposite side.'
    ),
    /** Vendor identifier, or null for transactions without a vendor. */
    vendorId: number()
        .nullable()
        .describe(
            'Vendor identifier, or null for transactions without a vendor.'
        ),
    /** Vendor display name. */
    vendorName: string().describe('Vendor display name.'),
    /** Vendor domain, when available. */
    vendorDomain: string()
        .optional()
        .describe('Vendor domain, when available.'),
    /** Vendor logo URL, when available. */
    vendorLogoUrl: string()
        .optional()
        .describe('Vendor logo URL, when available.'),
    /** Vendor primary color, when available. */
    vendorPrimaryColor: string()
        .optional()
        .describe('Vendor primary color, when available.'),
    /** Transaction direction for this category/vendor group. */
    type: CategoryTypeSchema.describe(
        'Transaction direction for this category/vendor group.'
    ),
    /** Total in the selected dashboard currency for this category/vendor group. */
    total: decimalNumber().describe(
        'Total in the selected dashboard currency for this category/vendor group.'
    ),
    /** Number of selected-period transactions in this category/vendor group. */
    transactionCount: number().describe(
        'Number of selected-period transactions in this category/vendor group.'
    ),
    /** Selected-period bucket totals for lightweight charts. */
    trend: array(decimalNumber()).describe(
        'Selected-period bucket totals for lightweight charts.'
    )
}).schemaName('DashboardCategoryVendorTotal');

export const StatsTrendPointSchema = object({
    /** Stable date or month bucket key. */
    bucket: string().describe('Stable date or month bucket key.'),
    /** Short label shown on charts. */
    label: string().describe('Short label shown on charts.'),
    /** Income total in the user's default currency. */
    incomeTotal: decimalNumber().describe(
        "Income total in the user's default currency."
    ),
    /** Expense total in the user's default currency. */
    expenseTotal: decimalNumber().describe(
        "Expense total in the user's default currency."
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
    /** Category path. */
    categoryDisplayName: string().describe('Category path.'),
    /** Optional parent category identifier. */
    categoryParentId: number()
        .nullable()
        .describe('Optional parent category identifier.'),
    /** Optional parent category name. */
    categoryParentName: string()
        .optional()
        .describe('Optional parent category name.'),
    /** Whether this category reports on its own side or the opposite side. */
    categoryKind: CategoryKindSchema.describe(
        'Whether this category reports on its own side or the opposite side.'
    ),
    /** Transaction direction. */
    type: CategoryTypeSchema.describe('Transaction direction.'),
    /** Category total in the user's default currency on the reported side. */
    total: decimalNumber().describe(
        "Category total in the user's default currency on the reported side."
    ),
    /** Share of the matching income or expense total, as a percentage. */
    share: decimalNumber().describe(
        'Share of the matching income or expense total, as a percentage.'
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
    /** Expenses in the default currency. */
    expenseTotal: decimalNumber().describe('Expenses in the default currency.'),
    /** Income in the default currency. */
    incomeTotal: decimalNumber().describe('Income in the default currency.'),
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

export const StatsTagKindSchema = enumOf('tag', 'untagged').describe(
    'Whether a tag report bucket is a saved tag or the untagged bucket.'
);

export const StatsTagTrendPointSchema = object({
    /** Stable date or month bucket key. */
    bucket: string().describe('Stable date or month bucket key.'),
    /** Short label shown on charts. */
    label: string().describe('Short label shown on charts.'),
    /** Expense total in the user's default currency. */
    expenseTotal: decimalNumber().describe(
        "Expense total in the user's default currency."
    ),
    /** Number of expense transactions in the bucket. */
    transactionCount: number().describe(
        'Number of expense transactions in the bucket.'
    )
}).schemaName('StatsTagTrendPoint');

export const StatsTagTotalSchema = object({
    /** Saved tag identifier, or null for the untagged bucket. */
    tagId: number()
        .nullable()
        .describe('Saved tag identifier, or null for the untagged bucket.'),
    /** Tag name shown in reports. */
    tagName: string().describe('Tag name shown in reports.'),
    /** Tag bucket kind. */
    kind: StatsTagKindSchema.describe('Tag bucket kind.'),
    /** Tag total in the user's default currency. */
    total: decimalNumber().describe(
        "Tag total in the user's default currency."
    ),
    /** Share of selected period expenses, as a percentage. */
    share: decimalNumber().describe(
        'Share of selected period expenses, as a percentage.'
    ),
    /** Number of selected-period expense transactions using this tag. */
    transactionCount: number().describe(
        'Number of selected-period expense transactions using this tag.'
    ),
    /** Average selected-period expense transaction amount for this tag. */
    averageExpense: decimalNumber().describe(
        'Average selected-period expense transaction amount for this tag.'
    )
}).schemaName('StatsTagTotal');

export const StatsTagVendorTotalSchema = object({
    /** Vendor identifier, or null for transactions without a vendor. */
    vendorId: number()
        .nullable()
        .describe(
            'Vendor identifier, or null for transactions without a vendor.'
        ),
    /** Vendor display name. */
    vendorName: string().describe('Vendor display name.'),
    /** Vendor domain, when available. */
    vendorDomain: string()
        .optional()
        .describe('Vendor domain, when available.'),
    /** Vendor logo URL, when available. */
    vendorLogoUrl: string()
        .optional()
        .describe('Vendor logo URL, when available.'),
    /** Vendor primary color, when available. */
    vendorPrimaryColor: string()
        .optional()
        .describe('Vendor primary color, when available.'),
    /** Vendor total in the user's default currency. */
    total: decimalNumber().describe(
        "Vendor total in the user's default currency."
    ),
    /** Number of selected-period expense transactions for this vendor. */
    transactionCount: number().describe(
        'Number of selected-period expense transactions for this vendor.'
    )
}).schemaName('StatsTagVendorTotal');

export const StatsTagDetailSchema = object({
    /** Selected tag identifier, or null for the untagged bucket. */
    tagId: number()
        .nullable()
        .describe('Selected tag identifier, or null for the untagged bucket.'),
    /** Selected tag name shown in reports. */
    tagName: string().describe('Selected tag name shown in reports.'),
    /** Selected tag bucket kind. */
    kind: StatsTagKindSchema.describe('Selected tag bucket kind.'),
    /** Selected tag total in the user's default currency. */
    total: decimalNumber().describe(
        "Selected tag total in the user's default currency."
    ),
    /** Selected tag share of period expenses, as a percentage. */
    share: decimalNumber().describe(
        'Selected tag share of period expenses, as a percentage.'
    ),
    /** Number of selected-period expense transactions in this tag. */
    transactionCount: number().describe(
        'Number of selected-period expense transactions in this tag.'
    ),
    /** Average selected-period expense transaction amount in this tag. */
    averageExpense: decimalNumber().describe(
        'Average selected-period expense transaction amount in this tag.'
    ),
    /** Time buckets for selected tag expense trend. */
    trend: array(StatsTagTrendPointSchema).describe(
        'Time buckets for selected tag expense trend.'
    ),
    /** Category totals within the selected tag. */
    byCategory: array(StatsCategoryTotalSchema).describe(
        'Category totals within the selected tag.'
    ),
    /** Parent category totals within the selected tag. */
    byParentCategory: array(StatsCategoryTotalSchema).describe(
        'Parent category totals within the selected tag.'
    ),
    /** Top vendors within the selected tag. */
    topVendors: array(StatsTagVendorTotalSchema).describe(
        'Top vendors within the selected tag.'
    )
}).schemaName('StatsTagDetail');

export const StatsTagReportSchema = object({
    /** Reporting period used for this tag report. */
    period: PeriodSchema.describe('Reporting period used for this tag report.'),
    /** Period start timestamp. */
    from: date().coerce().describe('Period start timestamp.'),
    /** Period end timestamp. */
    to: date().coerce().describe('Period end timestamp.'),
    /** Currency used for totals. */
    currency: CurrencyCodeSchema.describe('Currency used for totals.'),
    /** Selected period expense total before tag attribution. */
    expenseTotal: decimalNumber().describe(
        'Selected period expense total before tag attribution.'
    ),
    /** Number of selected-period expense transactions. */
    expenseCount: number().describe(
        'Number of selected-period expense transactions.'
    ),
    /** Number of selected-period expense transactions without tags. */
    untaggedCount: number().describe(
        'Number of selected-period expense transactions without tags.'
    ),
    /** Tag totals for the selected period. */
    tags: array(StatsTagTotalSchema).describe(
        'Tag totals for the selected period.'
    ),
    /** Selected tag detail, when requested and present. */
    selectedTag: union(StatsTagDetailSchema)
        .or(nul())
        .describe('Selected tag detail, when requested and present.')
}).schemaName('StatsTagReport');

export const DashboardComparisonSchema = object({
    /** Comparison period start timestamp. */
    from: date().coerce().describe('Comparison period start timestamp.'),
    /** Comparison period end timestamp. */
    to: date().coerce().describe('Comparison period end timestamp.'),
    /** Expenses in the selected dashboard currency. */
    expenseTotal: decimalNumber().describe(
        'Expenses in the selected dashboard currency.'
    ),
    /** Income in the selected dashboard currency. */
    incomeTotal: decimalNumber().describe(
        'Income in the selected dashboard currency.'
    ),
    /** Income minus expenses in the selected dashboard currency. */
    netTotal: decimalNumber().describe(
        'Income minus expenses in the selected dashboard currency.'
    )
}).schemaName('DashboardComparison');

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
    /** Expenses in the selected dashboard currency. */
    expenseTotal: decimalNumber().describe(
        'Expenses in the selected dashboard currency.'
    ),
    /** Income in the selected dashboard currency. */
    incomeTotal: decimalNumber().describe(
        'Income in the selected dashboard currency.'
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
    /** Parent category totals and shares for the selected period. */
    byParentCategory: array(StatsCategoryTotalSchema).describe(
        'Parent category totals and shares for the selected period.'
    ),
    /** Comparison totals for matching prior periods. */
    comparison: object({
        /** Matching previous period totals. */
        previousPeriod: StatsComparisonSchema,
        /** Same selected period one year earlier. */
        previousYear: StatsComparisonSchema
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
    /** Expenses in the default currency. */
    expenseTotal: decimalNumber().describe('Expenses in the default currency.'),
    /** Income in the default currency. */
    incomeTotal: decimalNumber().describe('Income in the default currency.'),
    /** Comparison totals for matching prior periods. */
    comparison: object({
        /** Matching previous period totals. */
        previousPeriod: DashboardComparisonSchema
    }).describe('Comparison totals for matching prior periods.'),
    /** Number of vendor groups in the selected period. */
    vendorCount: number().describe(
        'Number of vendor groups in the selected period.'
    ),
    /** Top vendor groups for the selected period. */
    topVendors: array(DashboardVendorTotalSchema).describe(
        'Top vendor groups for the selected period.'
    ),
    /** Category/vendor totals for the selected period. */
    categoryVendorBreakdown: array(DashboardCategoryVendorTotalSchema).describe(
        'Category/vendor totals for the selected period.'
    ),
    /** Category totals for the selected period. */
    byCategory: array(DashboardCategoryTotalSchema).describe(
        'Category totals for the selected period.'
    ),
    /** Parent category totals for the selected period. */
    byParentCategory: array(DashboardCategoryTotalSchema).describe(
        'Parent category totals for the selected period.'
    )
}).schemaName('DashboardSummary');

export const DashboardWindowItemSchema = object({
    /** Stable local date key for the period start. */
    date: string().describe('Stable local date key for the period start.'),
    /** Summary for the matching dashboard period. */
    summary: DashboardSummarySchema
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
    overview: StatsOverviewSchema
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
    /** Category total in the user's default currency on the reported side. */
    total: decimalNumber().describe(
        "Category total in the user's default currency on the reported side."
    ),
    /** Number of transactions in the bucket. */
    transactionCount: number().describe('Number of transactions in the bucket.')
}).schemaName('CategoryTrendPoint');

export const CategoryTrendResponseSchema = object({
    /** Category identifier. */
    categoryId: number().describe('Category identifier.'),
    /** Category name shown in reports. */
    categoryName: string().describe('Category name shown in reports.'),
    /** Category path shown in reports. */
    categoryDisplayName: string().describe('Category path shown in reports.'),
    /** Optional parent category identifier. */
    categoryParentId: number()
        .nullable()
        .describe('Optional parent category identifier.'),
    /** Optional parent category name. */
    categoryParentName: string()
        .optional()
        .describe('Optional parent category name.'),
    /** Whether this category reports on its own side or the opposite side. */
    categoryKind: CategoryKindSchema.describe(
        'Whether this category reports on its own side or the opposite side.'
    ),
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
    /** Category total in the user's default currency on the reported side. */
    total: decimalNumber().describe(
        "Category total in the user's default currency on the reported side."
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
export type EmailConfirmationPendingResponse = InferType<
    typeof EmailConfirmationPendingResponseSchema
>;
export type ConfirmEmailBody = InferType<typeof ConfirmEmailBodySchema>;
export type ResendEmailConfirmationBody = InferType<
    typeof ResendEmailConfirmationBodySchema
>;
export type EmailConfirmationMessageResponse = InferType<
    typeof EmailConfirmationMessageResponseSchema
>;
export type PassportResolveUserBody = InferType<
    typeof PassportResolveUserBodySchema
>;
export type PassportResolveUserResponse = InferType<
    typeof PassportResolveUserResponseSchema
>;
export type PassportExchangeBody = InferType<typeof PassportExchangeBodySchema>;
export type GoogleSignInBody = InferType<typeof GoogleSignInBodySchema>;
export type TokenResponse = InferType<typeof TokenResponseSchema>;
export type UserPreference = InferType<typeof UserPreferenceSchema>;
export type ApiKey = InferType<typeof ApiKeySchema>;
export type CreateApiKeyBody = InferType<typeof CreateApiKeyBodySchema>;
export type CreateApiKeyResponse = InferType<typeof CreateApiKeyResponseSchema>;
export type McpOAuthConnection = InferType<typeof McpOAuthConnectionSchema>;
export type McpOAuthAuthorizationQuery = InferType<
    typeof McpOAuthAuthorizationQuerySchema
>;
export type McpOAuthAuthorizationRequest = InferType<
    typeof McpOAuthAuthorizationRequestSchema
>;
export type McpOAuthAuthorizeBody = InferType<
    typeof McpOAuthAuthorizeBodySchema
>;
export type McpOAuthAuthorizeResponse = InferType<
    typeof McpOAuthAuthorizeResponseSchema
>;
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
export type BudgetRole = InferType<typeof BudgetRoleSchema>;
export type BudgetPermissions = InferType<typeof BudgetPermissionsSchema>;
export type Budget = InferType<typeof BudgetSchema>;
export type BudgetMember = InferType<typeof BudgetMemberSchema>;
export type CreateBudgetBody = InferType<typeof CreateBudgetBodySchema>;
export type UpdateBudgetBody = InferType<typeof UpdateBudgetBodySchema>;
export type ListBudgetsQuery = InferType<typeof ListBudgetsQuerySchema>;
export type InviteBudgetMemberBody = InferType<
    typeof InviteBudgetMemberBodySchema
>;
export type UpdateBudgetMemberBody = InferType<
    typeof UpdateBudgetMemberBodySchema
>;
export type AcceptBudgetInvitationBody = InferType<
    typeof AcceptBudgetInvitationBodySchema
>;
export type BudgetInvitationResponse = InferType<
    typeof BudgetInvitationResponseSchema
>;
export type CategoryKind = InferType<typeof CategoryKindSchema>;
export type Category = InferType<typeof CategorySchema>;
export type CategoryListQuery = InferType<typeof CategoryListQuerySchema>;
export type CreateCategoryBody = InferType<typeof CreateCategoryBodySchema>;
export type Vendor = InferType<typeof VendorSchema>;
export type VendorListQuery = InferType<typeof VendorListQuerySchema>;
export type VendorCandidateSearchQuery = InferType<
    typeof VendorCandidateSearchQuerySchema
>;
export type VendorCandidateDetailsQuery = InferType<
    typeof VendorCandidateDetailsQuerySchema
>;
export type VendorCandidate = InferType<typeof VendorCandidateSchema>;
export type CreateVendorBody = InferType<typeof CreateVendorBodySchema>;
export type UpdateVendorBody = InferType<typeof UpdateVendorBodySchema>;
export type Transaction = InferType<typeof TransactionSchema>;
export type TransactionTag = InferType<typeof TransactionTagSchema>;
export type TransactionTagListQuery = InferType<
    typeof TransactionTagListQuerySchema
>;
export type CreateTransactionBody = InferType<
    typeof CreateTransactionBodySchema
>;
export type TransactionListQuery = InferType<typeof TransactionListQuerySchema>;
export type TransactionExportQuery = InferType<
    typeof TransactionExportQuerySchema
>;
export type TransactionScanBody = InferType<typeof TransactionScanBodySchema>;
export type TransactionScanResponse = InferType<
    typeof TransactionScanResponseSchema
>;
export type TransactionScanJobResponse = InferType<
    typeof TransactionScanJobResponseSchema
>;
export type TransactionScanProgressQuery = InferType<
    typeof TransactionScanProgressQuerySchema
>;
export type TransactionScanProgressEvent = InferType<
    typeof TransactionScanProgressEventSchema
>;
export type TransactionScanDraft = InferType<typeof TransactionScanDraftSchema>;
export type TransactionScanDecisionBody = InferType<
    typeof TransactionScanDecisionBodySchema
>;
export type TransactionScanImageResponse = InferType<
    typeof TransactionScanImageResponseSchema
>;
export type DashboardSummary = InferType<typeof DashboardSummarySchema>;
export type DashboardWindowResponse = InferType<
    typeof DashboardWindowResponseSchema
>;
export type StatsWindowResponse = InferType<typeof StatsWindowResponseSchema>;
export type StatsOverview = InferType<typeof StatsOverviewSchema>;
export type StatsQuery = InferType<typeof StatsQuerySchema>;
export type StatsTagReport = InferType<typeof StatsTagReportSchema>;
export type StatsTagReportQuery = InferType<typeof StatsTagReportQuerySchema>;
export type CategoryTrendGroupBy = InferType<typeof CategoryTrendGroupBySchema>;
export type CategoryTrendRange = InferType<typeof CategoryTrendRangeSchema>;
export type CategoryTrendQuery = InferType<typeof CategoryTrendQuerySchema>;
export type CategoryTrendResponse = InferType<
    typeof CategoryTrendResponseSchema
>;
