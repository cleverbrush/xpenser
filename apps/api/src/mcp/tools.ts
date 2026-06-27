import type { Logger } from '@cleverbrush/log';
import {
    array,
    boolean,
    enumOf,
    type InferType,
    number,
    type ObjectSchemaBuilder,
    object,
    string,
    union
} from '@cleverbrush/schema';
import { toJsonSchema } from '@cleverbrush/schema-json';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
    CallToolRequestSchema,
    type CallToolResult,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
    type Tool
} from '@modelcontextprotocol/sdk/types.js';
import {
    type Category,
    type CategoryListQuery,
    type CreateCategoryBody,
    type CreateTransactionBody,
    type CreateVendorBody,
    type DashboardSummary,
    FieldLimits,
    type StatsOverview,
    type StatsQuery,
    type Transaction,
    type TransactionListQuery,
    type TransactionTag,
    TransactionTagLimits,
    type TransactionTagListQuery,
    type UpdateVendorBody,
    type UserPreference,
    type Vendor,
    type VendorCandidate,
    type VendorCandidateDetailsQuery,
    type VendorCandidateSearchQuery,
    type VendorListQuery
} from '@xpenser/contracts';
import type { Knex } from 'knex';
import {
    CategoryHierarchyError,
    CategoryInUseError,
    CategoryNotFoundError,
    createCategory as createUserCategory,
    deleteCategory as deleteUserCategory,
    LastCategoryError,
    listCategories as listUserCategories,
    moveAndDeleteCategory as moveAndDeleteUserCategory,
    updateCategory as updateUserCategory
} from '../application/categories.js';
import {
    listTransactionTags,
    TransactionTagError
} from '../application/transaction-tags.js';
import {
    createTransaction as createUserTransaction,
    dashboardSummary,
    deleteTransaction as deleteUserTransaction,
    listTransactions,
    statsOverview,
    TransactionCategoryError,
    TransactionNotFoundError,
    updateTransaction as updateUserTransaction
} from '../application/transactions.js';
import { getUserPreference } from '../application/users.js';
import {
    createVendor as createUserVendor,
    getVendorCandidateDetails,
    getVendorDetails,
    listVendors,
    retryVendorEnrichment,
    searchVendorCandidates,
    updateVendor as updateUserVendor,
    VendorMetadataError,
    VendorNameError,
    VendorNotFoundError
} from '../application/vendors.js';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';
import {
    McpToolCalled,
    TransactionCreated,
    VendorUpdateValidationRejected
} from '../log-templates.js';
import type { McpPrincipal } from './auth.js';

type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { readonly [key: string]: JsonValue };

type TransactionListResult = Awaited<ReturnType<typeof listTransactions>>;
type UpdateCategoryBody = Partial<CreateCategoryBody> & {
    readonly archived?: boolean;
};
type UpdateTransactionBody = Partial<CreateTransactionBody>;
type McpUpdateVendorBody = {
    readonly name?: string;
    readonly resolvedName?: string | null;
    readonly domain?: string | null;
    readonly description?: string | null;
    readonly logoUrl?: string | null;
    readonly primaryColor?: string | null;
};
type AnyObjectSchema = ObjectSchemaBuilder<any, any, any, any, any, any, any>;
type ToolAnnotations = NonNullable<Tool['annotations']>;
type ToolInputSchema = Tool['inputSchema'];

type XpenserMcpTool = {
    readonly name: string;
    readonly title: string;
    readonly description: string;
    readonly inputSchema: AnyObjectSchema;
    readonly annotations: ToolAnnotations;
    readonly handler: (
        input: Record<string, unknown>
    ) => Promise<CallToolResult>;
};

export type XpenserMcpDataAccess = {
    readonly getCurrentUser: (
        userId: number
    ) => Promise<UserPreference | undefined>;
    readonly listCategories: (
        userId: number,
        query: CategoryListQuery
    ) => Promise<Category[]>;
    readonly createCategory: (
        userId: number,
        body: CreateCategoryBody
    ) => Promise<Category>;
    readonly updateCategory: (
        userId: number,
        categoryId: number,
        body: UpdateCategoryBody
    ) => Promise<Category>;
    readonly deleteCategory: (
        userId: number,
        categoryId: number
    ) => Promise<void>;
    readonly moveAndDeleteCategory: (
        userId: number,
        categoryId: number,
        replacementCategoryId: number
    ) => Promise<void>;
    readonly listVendors: (
        userId: number,
        query: VendorListQuery
    ) => Promise<Vendor[]>;
    readonly getVendor: (userId: number, vendorId: number) => Promise<Vendor>;
    readonly searchVendorCandidates: (
        query: VendorCandidateSearchQuery
    ) => Promise<VendorCandidate[]>;
    readonly getVendorCandidateDetails: (
        query: VendorCandidateDetailsQuery
    ) => Promise<VendorCandidate | undefined>;
    readonly createVendor: (
        userId: number,
        body: CreateVendorBody
    ) => Promise<Vendor>;
    readonly updateVendor: (
        userId: number,
        vendorId: number,
        body: McpUpdateVendorBody
    ) => Promise<Vendor>;
    readonly enrichVendor: (
        userId: number,
        vendorId: number
    ) => Promise<Vendor>;
    readonly listTransactions: (
        userId: number,
        query: TransactionListQuery
    ) => Promise<TransactionListResult>;
    readonly listTransactionTags: (
        userId: number,
        query: TransactionTagListQuery
    ) => Promise<TransactionTag[]>;
    readonly createTransaction: (
        userId: number,
        body: CreateTransactionBody
    ) => Promise<Transaction>;
    readonly updateTransaction: (
        userId: number,
        transactionId: number,
        body: UpdateTransactionBody
    ) => Promise<Transaction>;
    readonly deleteTransaction: (
        userId: number,
        transactionId: number
    ) => Promise<void>;
    readonly getDashboardSummary: (
        userId: number,
        period: DashboardSummary['period'],
        date?: Date
    ) => Promise<DashboardSummary>;
    readonly getStatsOverview: (
        userId: number,
        query: StatsQuery
    ) => Promise<StatsOverview>;
};

export type XpenserMcpToolContext = {
    readonly principal: McpPrincipal;
    readonly data: XpenserMcpDataAccess;
    readonly logger: Pick<Logger, 'info' | 'warn'>;
};

const readOnlyAnnotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
} as const;

const openWorldReadOnlyAnnotations = {
    ...readOnlyAnnotations,
    openWorldHint: true
} as const;

const additiveWriteAnnotations = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
} as const;

const openWorldAdditiveWriteAnnotations = {
    ...additiveWriteAnnotations,
    openWorldHint: true
} as const;

const destructiveWriteAnnotations = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false
} as const;

const openWorldDestructiveWriteAnnotations = {
    ...destructiveWriteAnnotations,
    openWorldHint: true
} as const;

const EmptyInputSchema = object({});

const dateString = string()
    .trim()
    .nonempty()
    .describe('ISO 8601 date or timestamp.');

const currencyCode = string()
    .trim()
    .matches(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO 4217 code')
    .describe('ISO 4217 currency code, for example USD or EUR.');

const amount = number()
    .clearIsInteger()
    .positive()
    .describe('Positive amount with at most two decimal places.')
    .addValidator(value => {
        const scaled = value * 100;
        const nearestCent = Math.round(scaled);
        const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;
        if (Math.abs(scaled - nearestCent) <= tolerance) {
            return { valid: true };
        }

        return {
            valid: false,
            errors: [{ message: 'amount can have at most two decimal places' }]
        };
    });

function id(description: string) {
    return number().isInteger().positive().describe(description);
}

function optionalText(description: string, maxLength: number) {
    return string()
        .trim()
        .maxLength(maxLength)
        .optional()
        .describe(description);
}

function nullableText(description: string, maxLength: number) {
    return string()
        .trim()
        .maxLength(maxLength)
        .nullable()
        .optional()
        .describe(description);
}

const CategoryListInputSchema = object({
    sort: enumOf('recent-transaction-count')
        .optional()
        .describe('Optional category ordering mode.'),
    activeOnly: boolean()
        .optional()
        .describe(
            'True to return only categories available for new transactions.'
        )
});

const CreateCategoryInputSchema = object({
    name: string()
        .trim()
        .nonempty()
        .maxLength(FieldLimits.categoryName)
        .describe('Category name shown in transaction forms and reports.'),
    type: enumOf('expense', 'income').describe(
        'Whether this category is for expenses or income.'
    ),
    parentId: id('Optional parent category identifier for one-level nesting.')
        .nullable()
        .optional(),
    kind: enumOf('normal', 'offset')
        .optional()
        .describe(
            'Whether transactions in this category report on the same or opposite side.'
        )
});

const UpdateCategoryInputSchema = object({
    id: id('Category identifier to update.'),
    name: string()
        .trim()
        .nonempty()
        .maxLength(FieldLimits.categoryName)
        .optional()
        .describe('Updated category name.'),
    type: enumOf('expense', 'income')
        .optional()
        .describe('Updated category type.'),
    parentId: id('Updated parent category identifier, or null for top-level.')
        .nullable()
        .optional(),
    kind: enumOf('normal', 'offset')
        .optional()
        .describe('Updated category reporting kind.'),
    archived: boolean()
        .optional()
        .describe('Whether this category should be archived or restored.')
});

const CategoryIdInputSchema = object({
    id: id('Category identifier.')
});

const MoveAndDeleteCategoryInputSchema = object({
    id: id('Category identifier to delete.'),
    replacementCategoryId: id(
        'Category that should receive transactions before deleting the selected category.'
    )
});

const VendorListInputSchema = object({
    search: optionalText(
        'Text search applied to vendor names, domains, and descriptions.',
        FieldLimits.vendorSearch
    ),
    limit: number()
        .isInteger()
        .positive()
        .optional()
        .describe('Maximum number of vendors to return. Defaults to 25.')
});

const VendorIdInputSchema = object({
    id: id('Vendor identifier.')
});

const VendorCandidateSearchInputSchema = object({
    query: string()
        .trim()
        .nonempty()
        .maxLength(FieldLimits.vendorSearch)
        .describe('Vendor name text to search through Brandfetch.'),
    limit: number()
        .isInteger()
        .positive()
        .optional()
        .describe('Maximum number of Brandfetch suggestions to return.')
});

const VendorCandidateDetailsInputSchema = object({
    brandfetchBrandId: optionalText(
        'Brandfetch brand identifier.',
        FieldLimits.brandfetchBrandId
    ),
    domain: optionalText(
        'Vendor domain returned by Brandfetch.',
        FieldLimits.vendorDomain
    )
}).addValidator(value => {
    if (value.brandfetchBrandId || value.domain) {
        return { valid: true };
    }

    return {
        valid: false,
        errors: [
            { message: 'vendor candidate details require a brand ID or domain' }
        ]
    };
});

const CreateVendorInputSchema = object({
    name: string()
        .trim()
        .nonempty()
        .maxLength(FieldLimits.vendorName)
        .describe('User-entered vendor name.'),
    brandfetchBrandId: optionalText(
        'Brandfetch brand identifier selected from search results.',
        FieldLimits.brandfetchBrandId
    ),
    resolvedName: optionalText(
        'Resolved name selected from Brandfetch search results.',
        FieldLimits.vendorName
    ),
    domain: optionalText(
        'Vendor domain selected from Brandfetch search results.',
        FieldLimits.vendorDomain
    ),
    logoUrl: optionalText(
        'Vendor logo URL selected from Brandfetch search results.',
        FieldLimits.vendorLogoUrl
    )
});

const UpdateVendorInputSchema = object({
    id: id('Vendor identifier to update.'),
    name: optionalText(
        'Updated user-entered vendor name.',
        FieldLimits.vendorName
    ),
    resolvedName: nullableText(
        'Manually adjusted resolved name, or null to clear it.',
        FieldLimits.vendorName
    ),
    domain: nullableText(
        'Manually adjusted vendor domain, or null to clear it.',
        FieldLimits.vendorDomain
    ),
    description: nullableText(
        'Manually adjusted vendor description, or null to clear it.',
        FieldLimits.vendorDescription
    ),
    logoUrl: nullableText(
        'Manually adjusted HTTPS logo URL, or null to clear it.',
        FieldLimits.vendorLogoUrl
    ),
    primaryColor: nullableText(
        'Manually adjusted six-digit hex color, or null to clear it.',
        FieldLimits.vendorPrimaryColor
    )
});

const TransactionListInputSchema = object({
    search: string()
        .trim()
        .optional()
        .describe('Text search across category names, vendors, and notes.'),
    type: enumOf('expense', 'income')
        .optional()
        .describe('Filter by transaction direction.'),
    categoryId: id('Filter by category identifier.').optional(),
    parentCategoryId: id(
        'Filter by a parent category and its direct children.'
    ).optional(),
    vendorId: union(id('Filter by vendor identifier.'))
        .or(string('none'))
        .optional()
        .describe(
            'Filter by vendor identifier, or "none" for transactions without a vendor.'
        ),
    tagIds: array(id('Transaction tag identifier.'))
        .optional()
        .describe('Filter to transactions that have every listed tag.'),
    from: dateString
        .optional()
        .describe('Inclusive occurrence start date or timestamp.'),
    to: dateString
        .optional()
        .describe('Inclusive occurrence end date or timestamp.'),
    page: id('One-based page number. Defaults to 1.').optional(),
    limit: id('Page size. Defaults to 50 and is capped at 100.').optional(),
    direction: enumOf('asc', 'desc')
        .optional()
        .describe('Sort direction by occurrence date. Defaults to desc.')
});

const TransactionTagListInputSchema = object({
    search: optionalText(
        'Text search applied to tag names.',
        FieldLimits.transactionTagSearch
    ),
    limit: number()
        .isInteger()
        .positive()
        .optional()
        .describe('Maximum number of tags to return. Defaults to 25.')
});

const transactionTagNames = array(
    string()
        .trim()
        .maxLength(FieldLimits.transactionTagName)
        .describe('Transaction tag name.')
)
    .maxLength(TransactionTagLimits.maxTagsPerTransaction)
    .optional()
    .describe('Tag names to assign to the transaction.');

const CreateTransactionInputSchema = object({
    categoryId: id('Category identifier selected for the transaction.'),
    vendorId: id('Optional vendor identifier selected for the transaction.')
        .nullable()
        .optional(),
    amount,
    currency: currencyCode,
    occurredAt: dateString.describe(
        'Date and time when the transaction happened.'
    ),
    note: string()
        .maxLength(FieldLimits.transactionNote)
        .optional()
        .describe('Optional note entered by the user.'),
    tags: transactionTagNames
});

const UpdateTransactionInputSchema = object({
    id: id('Transaction identifier to update.'),
    categoryId: id('Updated category identifier.').optional(),
    vendorId: id('Updated vendor identifier, or null to remove the vendor.')
        .nullable()
        .optional(),
    amount: amount.optional(),
    currency: currencyCode.optional(),
    occurredAt: dateString
        .optional()
        .describe('Updated transaction occurrence date or timestamp.'),
    note: string()
        .maxLength(FieldLimits.transactionNote)
        .optional()
        .describe('Updated note. Pass an empty string to clear the note.'),
    tags: transactionTagNames.describe(
        'Updated tag names. Pass an empty list to clear tags.'
    )
});

const TransactionIdInputSchema = object({
    id: id('Transaction identifier.')
});

const DashboardInputSchema = object({
    period: enumOf('day', 'week', 'month', 'quarter', 'year')
        .optional()
        .describe('Reporting period. Defaults to day.'),
    date: dateString
        .optional()
        .describe('Date used to choose the reporting period.')
});

const StatsInputSchema = object({
    groupBy: enumOf('hour', 'day', 'week', 'month')
        .optional()
        .describe('Stats trend grouping. Defaults to day.'),
    timeframe: enumOf(
        'this-week',
        'last-7-days',
        'this-month',
        'last-month',
        'last-30-days',
        'custom'
    )
        .optional()
        .describe('Stats reporting timeframe. Defaults to this-month.'),
    from: dateString
        .optional()
        .describe('Inclusive custom start date or timestamp.'),
    to: dateString
        .optional()
        .describe('Inclusive custom end date or timestamp.'),
    period: enumOf('day', 'week', 'month', 'quarter', 'year')
        .optional()
        .describe('Dashboard-style reporting period.'),
    date: dateString
        .optional()
        .describe('Date used to choose the dashboard-style reporting period.')
});

type CategoryListInput = InferType<typeof CategoryListInputSchema>;
type CreateCategoryInput = InferType<typeof CreateCategoryInputSchema>;
type UpdateCategoryInput = InferType<typeof UpdateCategoryInputSchema>;
type CategoryIdInput = InferType<typeof CategoryIdInputSchema>;
type MoveAndDeleteCategoryInput = InferType<
    typeof MoveAndDeleteCategoryInputSchema
>;
type VendorListInput = InferType<typeof VendorListInputSchema>;
type VendorIdInput = InferType<typeof VendorIdInputSchema>;
type VendorCandidateSearchInput = InferType<
    typeof VendorCandidateSearchInputSchema
>;
type VendorCandidateDetailsInput = InferType<
    typeof VendorCandidateDetailsInputSchema
>;
type CreateVendorInput = InferType<typeof CreateVendorInputSchema>;
type UpdateVendorInput = InferType<typeof UpdateVendorInputSchema>;
type TransactionListInput = InferType<typeof TransactionListInputSchema>;
type TransactionTagListInput = InferType<typeof TransactionTagListInputSchema>;
type CreateTransactionInput = InferType<typeof CreateTransactionInputSchema>;
type UpdateTransactionInput = InferType<typeof UpdateTransactionInputSchema>;
type TransactionIdInput = InferType<typeof TransactionIdInputSchema>;
type DashboardInput = InferType<typeof DashboardInputSchema>;
type StatsInput = InferType<typeof StatsInputSchema>;

export function createXpenserMcpDataAccess(
    db: AppDb,
    config: Config,
    knex: Knex
): XpenserMcpDataAccess {
    return {
        getCurrentUser: userId => getUserPreference(db, userId),
        listCategories: (userId, query) =>
            listUserCategories(db, userId, query),
        createCategory: (userId, body) => createUserCategory(db, userId, body),
        updateCategory: (userId, categoryId, body) =>
            updateUserCategory(db, userId, categoryId, body),
        deleteCategory: (userId, categoryId) =>
            deleteUserCategory(db, userId, categoryId),
        moveAndDeleteCategory: (userId, categoryId, replacementCategoryId) =>
            moveAndDeleteUserCategory(
                db,
                userId,
                categoryId,
                replacementCategoryId
            ),
        listVendors: (userId, query) => listVendors(db, userId, query),
        getVendor: (userId, vendorId) => getVendorDetails(db, userId, vendorId),
        searchVendorCandidates: query => searchVendorCandidates(config, query),
        getVendorCandidateDetails: query =>
            getVendorCandidateDetails(config, query),
        createVendor: (userId, body) =>
            createUserVendor(db, config, userId, body),
        updateVendor: (userId, vendorId, body) =>
            updateUserVendor(db, userId, vendorId, body as UpdateVendorBody),
        enrichVendor: (userId, vendorId) =>
            retryVendorEnrichment(db, config, userId, vendorId),
        listTransactions: (userId, query) =>
            listTransactions(db, userId, query, knex),
        listTransactionTags: (userId, query) =>
            listTransactionTags(knex, userId, query),
        createTransaction: (userId, body) =>
            createUserTransaction(db, config, userId, body),
        updateTransaction: (userId, transactionId, body) =>
            updateUserTransaction(db, config, userId, transactionId, body),
        deleteTransaction: (userId, transactionId) =>
            deleteUserTransaction(db, userId, transactionId),
        getDashboardSummary: (userId, period, date) =>
            dashboardSummary(db, config, userId, period, date),
        getStatsOverview: (userId, query) => statsOverview(db, userId, query)
    };
}

function invalidParams(message: string): McpError {
    return new McpError(ErrorCode.InvalidParams, message);
}

function parseOptionalDate(value: string | undefined, field: string) {
    if (!value) {
        return undefined;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw invalidParams(`${field} must be a valid date or timestamp.`);
    }

    return date;
}

function parseRequiredDate(value: string, field: string): Date {
    return parseOptionalDate(value, field) ?? new Date(value);
}

function nonempty(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

export function normalizeCategoryListInput(
    input: CategoryListInput
): CategoryListQuery {
    return {
        sort: input.sort,
        activeOnly: input.activeOnly
    };
}

export function normalizeVendorListInput(
    input: VendorListInput
): VendorListQuery {
    return {
        search: nonempty(input.search),
        limit: input.limit ?? 25
    };
}

export function normalizeVendorCandidateSearchInput(
    input: VendorCandidateSearchInput
): VendorCandidateSearchQuery {
    return {
        query: input.query,
        limit: input.limit ?? 6
    };
}

export function normalizeTransactionListInput(
    input: TransactionListInput
): TransactionListQuery {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(100, Math.max(1, input.limit ?? 50));

    return {
        search: nonempty(input.search),
        type: input.type,
        categoryId: input.categoryId,
        parentCategoryId: input.parentCategoryId,
        vendorId: input.vendorId,
        tagIds:
            input.tagIds && input.tagIds.length > 0
                ? input.tagIds.join(',')
                : undefined,
        from: parseOptionalDate(input.from, 'from'),
        to: parseOptionalDate(input.to, 'to'),
        page,
        limit,
        direction: input.direction ?? 'desc'
    };
}

export function normalizeTransactionTagListInput(
    input: TransactionTagListInput
): TransactionTagListQuery {
    return {
        search: nonempty(input.search),
        limit: Math.min(100, Math.max(1, input.limit ?? 25))
    };
}

export function normalizeCreateTransactionInput(
    input: CreateTransactionInput
): CreateTransactionBody {
    return {
        categoryId: input.categoryId,
        vendorId: input.vendorId,
        amount: input.amount,
        currency: input.currency,
        occurredAt: parseRequiredDate(input.occurredAt, 'occurredAt'),
        note: input.note,
        tags: input.tags
    };
}

export function normalizeUpdateTransactionInput(
    input: UpdateTransactionInput
): UpdateTransactionBody {
    return {
        categoryId: input.categoryId,
        vendorId: input.vendorId,
        amount: input.amount,
        currency: input.currency,
        occurredAt: parseOptionalDate(input.occurredAt, 'occurredAt'),
        note: input.note,
        tags: input.tags
    };
}

export function normalizeStatsInput(input: StatsInput): StatsQuery {
    return {
        groupBy: input.groupBy ?? 'day',
        timeframe: input.timeframe ?? 'this-month',
        from: parseOptionalDate(input.from, 'from'),
        to: parseOptionalDate(input.to, 'to'),
        period: input.period,
        date: parseOptionalDate(input.date, 'date')
    };
}

export function serializeMcpData(value: unknown): JsonValue {
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (Array.isArray(value)) {
        return value.map(item => serializeMcpData(item));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value)
                .filter(([, item]) => item !== undefined)
                .map(([key, item]) => [key, serializeMcpData(item)])
        ) as { readonly [key: string]: JsonValue };
    }
    if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
    ) {
        return value;
    }

    return null;
}

function toolResult(payload: Record<string, unknown>): CallToolResult {
    const structuredContent = serializeMcpData(payload) as Record<
        string,
        unknown
    >;

    return {
        structuredContent,
        content: [
            {
                type: 'text',
                text: JSON.stringify(structuredContent, null, 2)
            }
        ]
    };
}

function inputJsonSchema(schema: AnyObjectSchema): ToolInputSchema {
    return toJsonSchema(schema, { $schema: false }) as ToolInputSchema;
}

function validationErrorMessage(result: unknown): string {
    const validationResult = result as {
        readonly errors?: readonly { readonly message: string }[];
        readonly getInvalidProperties?: () => readonly {
            readonly descriptor: { readonly toJsonPointer: () => string };
            readonly errors: readonly string[];
        }[];
    };
    const invalidProperties =
        typeof validationResult.getInvalidProperties === 'function'
            ? validationResult.getInvalidProperties()
            : [];
    const propertyErrors = invalidProperties.flatMap(property =>
        property.errors.map(error => {
            const pointer = property.descriptor.toJsonPointer();
            return pointer ? `${pointer}: ${error}` : error;
        })
    );
    const schemaErrors = (validationResult.errors ?? []).map(
        error => error.message
    );
    const errors = [...propertyErrors, ...schemaErrors];
    return errors.length > 0 ? errors.join('; ') : 'Invalid arguments.';
}

async function validateToolInput(
    schema: AnyObjectSchema,
    args: unknown,
    toolName: string
): Promise<Record<string, unknown>> {
    const result = await schema.validateAsync(args ?? {}, {
        doNotStopOnFirstError: true
    });
    if (result.valid) {
        return (result.object ?? {}) as Record<string, unknown>;
    }

    throw invalidParams(
        `Input validation error: Invalid arguments for tool ${toolName}: ${validationErrorMessage(result)}`
    );
}

function logToolCall(context: XpenserMcpToolContext, toolName: string): void {
    context.logger.info(McpToolCalled, {
        ToolName: toolName,
        UserId: context.principal.userId,
        CredentialType: context.principal.authType,
        CredentialId:
            context.principal.authType === 'api_key'
                ? String(context.principal.apiKeyId)
                : context.principal.mcpClientId
    });
}

function mapExpectedError(err: unknown): never {
    if (err instanceof McpError) {
        throw err;
    }
    if (
        err instanceof CategoryHierarchyError ||
        err instanceof CategoryInUseError ||
        err instanceof CategoryNotFoundError ||
        err instanceof LastCategoryError ||
        err instanceof TransactionCategoryError ||
        err instanceof TransactionNotFoundError ||
        err instanceof TransactionTagError ||
        err instanceof VendorMetadataError ||
        err instanceof VendorNameError ||
        err instanceof VendorNotFoundError
    ) {
        throw invalidParams(err.message);
    }

    throw err;
}

export async function handleGetCurrentUser(
    context: XpenserMcpToolContext
): Promise<CallToolResult> {
    const toolName = 'xpenser_get_current_user';
    logToolCall(context, toolName);
    const user = await context.data.getCurrentUser(context.principal.userId);
    if (!user) {
        throw new Error('User was not found.');
    }

    return toolResult({ user });
}

export async function handleListCategories(
    context: XpenserMcpToolContext,
    input: CategoryListInput = {}
): Promise<CallToolResult> {
    const toolName = 'xpenser_list_categories';
    logToolCall(context, toolName);
    return toolResult({
        categories: await context.data.listCategories(
            context.principal.userId,
            normalizeCategoryListInput(input)
        )
    });
}

export async function handleCreateCategory(
    context: XpenserMcpToolContext,
    input: CreateCategoryInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_create_category';
    logToolCall(context, toolName);
    try {
        return toolResult({
            category: await context.data.createCategory(
                context.principal.userId,
                input
            )
        });
    } catch (err) {
        return mapExpectedError(err);
    }
}

export async function handleUpdateCategory(
    context: XpenserMcpToolContext,
    input: UpdateCategoryInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_update_category';
    logToolCall(context, toolName);
    const { id: categoryId, ...body } = input;
    try {
        return toolResult({
            category: await context.data.updateCategory(
                context.principal.userId,
                categoryId,
                body
            )
        });
    } catch (err) {
        return mapExpectedError(err);
    }
}

export async function handleDeleteCategory(
    context: XpenserMcpToolContext,
    input: CategoryIdInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_delete_category';
    logToolCall(context, toolName);
    try {
        await context.data.deleteCategory(context.principal.userId, input.id);
        return toolResult({ deleted: true, id: input.id });
    } catch (err) {
        return mapExpectedError(err);
    }
}

export async function handleMoveAndDeleteCategory(
    context: XpenserMcpToolContext,
    input: MoveAndDeleteCategoryInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_move_and_delete_category';
    logToolCall(context, toolName);
    try {
        await context.data.moveAndDeleteCategory(
            context.principal.userId,
            input.id,
            input.replacementCategoryId
        );
        return toolResult({
            deleted: true,
            id: input.id,
            replacementCategoryId: input.replacementCategoryId
        });
    } catch (err) {
        return mapExpectedError(err);
    }
}

export async function handleListVendors(
    context: XpenserMcpToolContext,
    input: VendorListInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_list_vendors';
    logToolCall(context, toolName);
    return toolResult({
        vendors: await context.data.listVendors(
            context.principal.userId,
            normalizeVendorListInput(input)
        )
    });
}

export async function handleGetVendor(
    context: XpenserMcpToolContext,
    input: VendorIdInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_get_vendor';
    logToolCall(context, toolName);
    try {
        return toolResult({
            vendor: await context.data.getVendor(
                context.principal.userId,
                input.id
            )
        });
    } catch (err) {
        return mapExpectedError(err);
    }
}

export async function handleSearchVendorCandidates(
    context: XpenserMcpToolContext,
    input: VendorCandidateSearchInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_search_vendor_candidates';
    logToolCall(context, toolName);
    return toolResult({
        vendorCandidates: await context.data.searchVendorCandidates(
            normalizeVendorCandidateSearchInput(input)
        )
    });
}

export async function handleGetVendorCandidateDetails(
    context: XpenserMcpToolContext,
    input: VendorCandidateDetailsInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_get_vendor_candidate_details';
    logToolCall(context, toolName);
    return toolResult({
        vendorCandidate:
            (await context.data.getVendorCandidateDetails(input)) ?? null
    });
}

export async function handleCreateVendor(
    context: XpenserMcpToolContext,
    input: CreateVendorInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_create_vendor';
    logToolCall(context, toolName);
    try {
        return toolResult({
            vendor: await context.data.createVendor(
                context.principal.userId,
                input
            )
        });
    } catch (err) {
        return mapExpectedError(err);
    }
}

export async function handleUpdateVendor(
    context: XpenserMcpToolContext,
    input: UpdateVendorInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_update_vendor';
    logToolCall(context, toolName);
    const { id: vendorId, ...body } = input;
    try {
        return toolResult({
            vendor: await context.data.updateVendor(
                context.principal.userId,
                vendorId,
                body
            )
        });
    } catch (err) {
        if (
            err instanceof VendorMetadataError ||
            err instanceof VendorNameError
        ) {
            context.logger.warn(VendorUpdateValidationRejected, {
                Reason: err.message,
                UserId: context.principal.userId,
                VendorId: vendorId
            });
        }
        return mapExpectedError(err);
    }
}

export async function handleEnrichVendor(
    context: XpenserMcpToolContext,
    input: VendorIdInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_enrich_vendor';
    logToolCall(context, toolName);
    try {
        return toolResult({
            vendor: await context.data.enrichVendor(
                context.principal.userId,
                input.id
            )
        });
    } catch (err) {
        return mapExpectedError(err);
    }
}

export async function handleListTransactions(
    context: XpenserMcpToolContext,
    input: TransactionListInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_list_transactions';
    logToolCall(context, toolName);
    return toolResult({
        transactions: await context.data.listTransactions(
            context.principal.userId,
            normalizeTransactionListInput(input)
        )
    });
}

export async function handleListTransactionTags(
    context: XpenserMcpToolContext,
    input: TransactionTagListInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_list_transaction_tags';
    logToolCall(context, toolName);
    return toolResult({
        tags: await context.data.listTransactionTags(
            context.principal.userId,
            normalizeTransactionTagListInput(input)
        )
    });
}

export async function handleCreateTransaction(
    context: XpenserMcpToolContext,
    input: CreateTransactionInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_create_transaction';
    logToolCall(context, toolName);
    try {
        const transaction = await context.data.createTransaction(
            context.principal.userId,
            normalizeCreateTransactionInput(input)
        );
        context.logger.info(TransactionCreated, {
            TransactionId: transaction.id,
            UserId: context.principal.userId
        });
        return toolResult({ transaction });
    } catch (err) {
        return mapExpectedError(err);
    }
}

export async function handleUpdateTransaction(
    context: XpenserMcpToolContext,
    input: UpdateTransactionInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_update_transaction';
    logToolCall(context, toolName);
    try {
        return toolResult({
            transaction: await context.data.updateTransaction(
                context.principal.userId,
                input.id,
                normalizeUpdateTransactionInput(input)
            )
        });
    } catch (err) {
        return mapExpectedError(err);
    }
}

export async function handleDeleteTransaction(
    context: XpenserMcpToolContext,
    input: TransactionIdInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_delete_transaction';
    logToolCall(context, toolName);
    try {
        await context.data.deleteTransaction(
            context.principal.userId,
            input.id
        );
        return toolResult({ deleted: true, id: input.id });
    } catch (err) {
        return mapExpectedError(err);
    }
}

export async function handleGetDashboardSummary(
    context: XpenserMcpToolContext,
    input: DashboardInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_get_dashboard_summary';
    logToolCall(context, toolName);
    return toolResult({
        dashboard: await context.data.getDashboardSummary(
            context.principal.userId,
            input.period ?? 'day',
            parseOptionalDate(input.date, 'date')
        )
    });
}

export async function handleGetStatsOverview(
    context: XpenserMcpToolContext,
    input: StatsInput
): Promise<CallToolResult> {
    const toolName = 'xpenser_get_stats_overview';
    logToolCall(context, toolName);
    return toolResult({
        stats: await context.data.getStatsOverview(
            context.principal.userId,
            normalizeStatsInput(input)
        )
    });
}

export function createXpenserMcpTools(
    context: XpenserMcpToolContext
): readonly XpenserMcpTool[] {
    return [
        {
            name: 'xpenser_get_current_user',
            title: 'Get current xpenser user',
            description:
                'Return profile, default currency, transaction currency order, and timezone context for the authenticated xpenser API key owner.',
            inputSchema: EmptyInputSchema,
            annotations: readOnlyAnnotations,
            handler: () => handleGetCurrentUser(context)
        },
        {
            name: 'xpenser_list_categories',
            title: 'List xpenser categories',
            description:
                'Return income and expense categories for the authenticated xpenser user.',
            inputSchema: CategoryListInputSchema,
            annotations: readOnlyAnnotations,
            handler: input =>
                handleListCategories(context, input as CategoryListInput)
        },
        {
            name: 'xpenser_create_category',
            title: 'Create xpenser category',
            description:
                'Create an income or expense category for the authenticated xpenser user.',
            inputSchema: CreateCategoryInputSchema,
            annotations: additiveWriteAnnotations,
            handler: input =>
                handleCreateCategory(context, input as CreateCategoryInput)
        },
        {
            name: 'xpenser_update_category',
            title: 'Update xpenser category',
            description:
                'Update a category name, hierarchy, reporting kind, type, or archive state for the authenticated xpenser user.',
            inputSchema: UpdateCategoryInputSchema,
            annotations: destructiveWriteAnnotations,
            handler: input =>
                handleUpdateCategory(context, input as UpdateCategoryInput)
        },
        {
            name: 'xpenser_delete_category',
            title: 'Delete xpenser category',
            description:
                'Delete an unused leaf category owned by the authenticated xpenser user.',
            inputSchema: CategoryIdInputSchema,
            annotations: destructiveWriteAnnotations,
            handler: input =>
                handleDeleteCategory(context, input as CategoryIdInput)
        },
        {
            name: 'xpenser_move_and_delete_category',
            title: 'Move and delete xpenser category',
            description:
                'Move transactions from a leaf category to a same-direction replacement category, then delete the source category.',
            inputSchema: MoveAndDeleteCategoryInputSchema,
            annotations: destructiveWriteAnnotations,
            handler: input =>
                handleMoveAndDeleteCategory(
                    context,
                    input as MoveAndDeleteCategoryInput
                )
        },
        {
            name: 'xpenser_list_vendors',
            title: 'List xpenser vendors',
            description:
                'Return vendors owned by the authenticated xpenser user, with transaction counts and category suggestions.',
            inputSchema: VendorListInputSchema,
            annotations: readOnlyAnnotations,
            handler: input =>
                handleListVendors(context, input as VendorListInput)
        },
        {
            name: 'xpenser_get_vendor',
            title: 'Get xpenser vendor',
            description:
                'Return one vendor owned by the authenticated xpenser user.',
            inputSchema: VendorIdInputSchema,
            annotations: readOnlyAnnotations,
            handler: input => handleGetVendor(context, input as VendorIdInput)
        },
        {
            name: 'xpenser_search_vendor_candidates',
            title: 'Search vendor candidates',
            description:
                'Search Brandfetch for vendor candidates that can be used when creating a xpenser vendor.',
            inputSchema: VendorCandidateSearchInputSchema,
            annotations: openWorldReadOnlyAnnotations,
            handler: input =>
                handleSearchVendorCandidates(
                    context,
                    input as VendorCandidateSearchInput
                )
        },
        {
            name: 'xpenser_get_vendor_candidate_details',
            title: 'Get vendor candidate details',
            description:
                'Fetch Brandfetch metadata for a selected vendor candidate by brand identifier or domain.',
            inputSchema: VendorCandidateDetailsInputSchema,
            annotations: openWorldReadOnlyAnnotations,
            handler: input =>
                handleGetVendorCandidateDetails(
                    context,
                    input as VendorCandidateDetailsInput
                )
        },
        {
            name: 'xpenser_create_vendor',
            title: 'Create xpenser vendor',
            description:
                'Create or reuse a vendor owned by the authenticated xpenser user. Selected candidate metadata may be enriched through Brandfetch.',
            inputSchema: CreateVendorInputSchema,
            annotations: openWorldAdditiveWriteAnnotations,
            handler: input =>
                handleCreateVendor(context, input as CreateVendorInput)
        },
        {
            name: 'xpenser_update_vendor',
            title: 'Update xpenser vendor',
            description:
                'Update editable metadata for a vendor owned by the authenticated xpenser user.',
            inputSchema: UpdateVendorInputSchema,
            annotations: destructiveWriteAnnotations,
            handler: input =>
                handleUpdateVendor(context, input as UpdateVendorInput)
        },
        {
            name: 'xpenser_enrich_vendor',
            title: 'Enrich xpenser vendor',
            description:
                'Retry Brandfetch enrichment for a vendor owned by the authenticated xpenser user.',
            inputSchema: VendorIdInputSchema,
            annotations: openWorldDestructiveWriteAnnotations,
            handler: input =>
                handleEnrichVendor(context, input as VendorIdInput)
        },
        {
            name: 'xpenser_list_transactions',
            title: 'List xpenser transactions',
            description:
                'Return paginated transactions for the authenticated xpenser user. Amount is the original transaction amount; defaultCurrencyAmount is converted to the user default currency.',
            inputSchema: TransactionListInputSchema,
            annotations: readOnlyAnnotations,
            handler: input =>
                handleListTransactions(context, input as TransactionListInput)
        },
        {
            name: 'xpenser_list_transaction_tags',
            title: 'List xpenser transaction tags',
            description:
                'Return transaction tags owned by the authenticated xpenser user, including usage counts.',
            inputSchema: TransactionTagListInputSchema,
            annotations: readOnlyAnnotations,
            handler: input =>
                handleListTransactionTags(
                    context,
                    input as TransactionTagListInput
                )
        },
        {
            name: 'xpenser_create_transaction',
            title: 'Create xpenser transaction',
            description:
                'Create a transaction and store its historical exchange rate for the authenticated xpenser user.',
            inputSchema: CreateTransactionInputSchema,
            annotations: openWorldAdditiveWriteAnnotations,
            handler: input =>
                handleCreateTransaction(
                    context,
                    input as CreateTransactionInput
                )
        },
        {
            name: 'xpenser_update_transaction',
            title: 'Update xpenser transaction',
            description:
                'Update a transaction and recalculate converted values for the authenticated xpenser user.',
            inputSchema: UpdateTransactionInputSchema,
            annotations: openWorldDestructiveWriteAnnotations,
            handler: input =>
                handleUpdateTransaction(
                    context,
                    input as UpdateTransactionInput
                )
        },
        {
            name: 'xpenser_delete_transaction',
            title: 'Delete xpenser transaction',
            description:
                'Delete a transaction owned by the authenticated xpenser user.',
            inputSchema: TransactionIdInputSchema,
            annotations: destructiveWriteAnnotations,
            handler: input =>
                handleDeleteTransaction(context, input as TransactionIdInput)
        },
        {
            name: 'xpenser_get_dashboard_summary',
            title: 'Get xpenser dashboard summary',
            description:
                'Return period totals and category distributions in the user default currency.',
            inputSchema: DashboardInputSchema,
            annotations: readOnlyAnnotations,
            handler: input =>
                handleGetDashboardSummary(context, input as DashboardInput)
        },
        {
            name: 'xpenser_get_stats_overview',
            title: 'Get xpenser stats overview',
            description:
                'Return income, expense, net, savings, trend, category, and comparison statistics in the user default currency.',
            inputSchema: StatsInputSchema,
            annotations: readOnlyAnnotations,
            handler: input =>
                handleGetStatsOverview(context, input as StatsInput)
        }
    ];
}

export function registerXpenserMcpTools(
    server: Server,
    context: XpenserMcpToolContext
): void {
    const tools = createXpenserMcpTools(context);
    const toolsByName = new Map(tools.map(tool => [tool.name, tool] as const));

    server.registerCapabilities({
        tools: {
            listChanged: true
        }
    });
    server.setRequestHandler(ListToolsRequestSchema, () => ({
        tools: tools.map(tool => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: inputJsonSchema(tool.inputSchema),
            annotations: tool.annotations,
            execution: { taskSupport: 'forbidden' }
        }))
    }));
    server.setRequestHandler(CallToolRequestSchema, async request => {
        const tool = toolsByName.get(request.params.name);
        if (!tool) {
            throw invalidParams(`Tool ${request.params.name} not found.`);
        }

        const input = await validateToolInput(
            tool.inputSchema,
            request.params.arguments,
            tool.name
        );
        return tool.handler(input);
    });
}
