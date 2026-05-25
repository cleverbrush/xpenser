import type { Logger } from '@cleverbrush/log';
import {
    enumOf,
    type InferType,
    number,
    type ObjectSchemaBuilder,
    object,
    string
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
import type {
    Category,
    DashboardSummary,
    StatsOverview,
    StatsQuery,
    TransactionListQuery,
    UserPreference
} from '@xpenser/contracts';
import { listCategories as listUserCategories } from '../application/categories.js';
import {
    dashboardSummary,
    listTransactions,
    statsOverview
} from '../application/transactions.js';
import { getUserPreference } from '../application/users.js';
import type { AppDb } from '../db/schemas.js';
import type { McpApiKeyPrincipal } from './auth.js';

type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { readonly [key: string]: JsonValue };

type TransactionListResult = Awaited<ReturnType<typeof listTransactions>>;
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
    readonly listCategories: (userId: number) => Promise<Category[]>;
    readonly listTransactions: (
        userId: number,
        query: TransactionListQuery
    ) => Promise<TransactionListResult>;
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
    readonly principal: McpApiKeyPrincipal;
    readonly data: XpenserMcpDataAccess;
    readonly logger: Pick<Logger, 'info'>;
};

const readOnlyAnnotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
} as const;

const EmptyInputSchema = object({});

const dateString = string()
    .trim()
    .nonempty()
    .describe('ISO 8601 date or timestamp.');

const TransactionListInputSchema = object({
    search: string()
        .trim()
        .optional()
        .describe('Text search across category names and notes.'),
    type: enumOf('expense', 'income')
        .optional()
        .describe('Filter by transaction direction.'),
    categoryId: number()
        .isInteger()
        .positive()
        .optional()
        .describe('Filter by category identifier.'),
    from: dateString
        .optional()
        .describe('Inclusive occurrence start date or timestamp.'),
    to: dateString
        .optional()
        .describe('Inclusive occurrence end date or timestamp.'),
    page: number()
        .isInteger()
        .positive()
        .optional()
        .describe('One-based page number. Defaults to 1.'),
    limit: number()
        .isInteger()
        .positive()
        .optional()
        .describe('Page size. Defaults to 50 and is capped at 100.'),
    direction: enumOf('asc', 'desc')
        .optional()
        .describe('Sort direction by occurrence date. Defaults to desc.')
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

type TransactionListInput = InferType<typeof TransactionListInputSchema>;
type DashboardInput = InferType<typeof DashboardInputSchema>;
type StatsInput = InferType<typeof StatsInputSchema>;

export function createXpenserMcpDataAccess(db: AppDb): XpenserMcpDataAccess {
    return {
        getCurrentUser: userId => getUserPreference(db, userId),
        listCategories: userId => listUserCategories(db, userId),
        listTransactions: (userId, query) =>
            listTransactions(db, userId, query),
        getDashboardSummary: (userId, period, date) =>
            dashboardSummary(db, userId, period, date),
        getStatsOverview: (userId, query) => statsOverview(db, userId, query)
    };
}

function parseOptionalDate(value: string | undefined, field: string) {
    if (!value) {
        return undefined;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`${field} must be a valid date or timestamp.`);
    }

    return date;
}

function nonempty(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
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
        from: parseOptionalDate(input.from, 'from'),
        to: parseOptionalDate(input.to, 'to'),
        page,
        limit,
        direction: input.direction ?? 'desc'
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

    throw new McpError(
        ErrorCode.InvalidParams,
        `Input validation error: Invalid arguments for tool ${toolName}: ${validationErrorMessage(result)}`
    );
}

function logToolCall(context: XpenserMcpToolContext, toolName: string): void {
    context.logger.info(
        'MCP tool {ToolName} called by {UserId} using API key {ApiKeyId}',
        {
            ToolName: toolName,
            UserId: context.principal.userId,
            ApiKeyId: context.principal.apiKeyId
        }
    );
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
    context: XpenserMcpToolContext
): Promise<CallToolResult> {
    const toolName = 'xpenser_list_categories';
    logToolCall(context, toolName);
    return toolResult({
        categories: await context.data.listCategories(context.principal.userId)
    });
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

function createXpenserMcpTools(
    context: XpenserMcpToolContext
): readonly XpenserMcpTool[] {
    return [
        {
            name: 'xpenser_get_current_user',
            title: 'Get current xpenser user',
            description:
                'Return profile, default currency, and timezone context for the authenticated xpenser API key owner.',
            inputSchema: EmptyInputSchema,
            annotations: readOnlyAnnotations,
            handler: () => handleGetCurrentUser(context)
        },
        {
            name: 'xpenser_list_categories',
            title: 'List xpenser categories',
            description:
                'Return income and expense categories for the authenticated xpenser user.',
            inputSchema: EmptyInputSchema,
            annotations: readOnlyAnnotations,
            handler: () => handleListCategories(context)
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
            throw new McpError(
                ErrorCode.InvalidParams,
                `Tool ${request.params.name} not found.`
            );
        }

        const input = await validateToolInput(
            tool.inputSchema,
            request.params.arguments,
            tool.name
        );
        return tool.handler(input);
    });
}
