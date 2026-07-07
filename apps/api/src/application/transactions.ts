import type {
    CategoryTrendGroupBy,
    CategoryTrendQuery,
    CategoryTrendRange,
    CategoryTrendResponse,
    CreateTransactionBody,
    DashboardSummary,
    DashboardWindowResponse,
    StatsOverview,
    StatsQuery,
    StatsTagReport,
    StatsTagReportQuery,
    StatsWindowResponse,
    Transaction,
    TransactionExportQuery,
    TransactionListQuery,
    TransactionScanImageResponse,
    TransactionTag
} from '@xpenser/contracts';
import {
    addLocalDays,
    addLocalMonths,
    addLocalYears,
    addStatsBucketStepInTimeZone,
    dateToLocalDateParam,
    defaultTimeZone,
    localDayDifference,
    localEndOfDay,
    localHour,
    localMonthIndex,
    localStartOfDay,
    localStartOfHour,
    localStartOfMonth,
    localStartOfWeek,
    localStartOfYear,
    resolveDashboardComparisonRangeInTimeZone,
    resolveDashboardRangeInTimeZone,
    statsBucketKeyInTimeZone,
    statsBucketLabelInTimeZone
} from '@xpenser/timezone';
import type { Knex } from 'knex';
import type { Config } from '../config.js';
import type {
    AppDb,
    CategoryDb,
    TransactionDb,
    UserDb,
    VendorDb
} from '../db/schemas.js';
import { requireBudgetPermission, resolveBudgetAccess } from './budgets.js';
import {
    categoryAvailableForTransactions,
    categoryDisplayName,
    categoryParent,
    categoryReportingType
} from './categories.js';
import {
    convertAmount,
    getExchangeRate,
    transactionDate
} from './currencies.js';
import {
    pruneUnusedTransactionTags,
    replaceTransactionTags
} from './transaction-tags.js';
import { getVendor, VendorNotFoundError } from './vendors.js';

export class TransactionNotFoundError extends Error {}
export class TransactionCategoryError extends Error {}
export class TransactionExportError extends Error {}

type DashboardPeriod = NonNullable<DashboardSummary['period']>;

type DashboardCategory = DashboardSummary['byCategory'][number];

type DashboardVendor = DashboardSummary['topVendors'][number];
type DashboardCategoryVendor =
    DashboardSummary['categoryVendorBreakdown'][number];
type TransactionScanAttachment = NonNullable<Transaction['scanAttachment']>;
type TransactionScanAttachmentRow = {
    readonly budgetId: number;
    readonly createdAt: Date;
    readonly fileName: string | null;
    readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    readonly scanId: number;
    readonly scanItemId: number;
    readonly sizeBytes: number | string;
    readonly transactionId: number;
};

type TransactionScanImageRow = TransactionScanAttachmentRow & {
    readonly imageBase64: string;
};

type TransactionTagRow = {
    readonly budgetId: number;
    readonly createdAt: Date;
    readonly id: number;
    readonly name: string;
    readonly transactionId: number;
    readonly updatedAt: Date;
};

type TransactionTagCountRow = {
    readonly tagId: number;
    readonly transactionCount: number | string;
};

type TransactionCreator = Transaction['createdBy'];

type StatsBucket = StatsOverview['trend'][number];

type StatsCategory = StatsOverview['byCategory'][number];

type StatsTagTotal = StatsTagReport['tags'][number];

type StatsTagDetail = NonNullable<StatsTagReport['selectedTag']>;

type StatsTagTrendBucket = StatsTagDetail['trend'][number];

type StatsTagVendor = StatsTagDetail['topVendors'][number];

type StatsGroupBy = NonNullable<StatsQuery['groupBy']>;

type StatsTimeframe = NonNullable<StatsQuery['timeframe']>;

type StatsRange = {
    readonly from: Date;
    readonly to: Date;
};

type TransactionFilterQuery = Pick<
    TransactionListQuery,
    | 'budgetId'
    | 'categoryId'
    | 'direction'
    | 'from'
    | 'parentCategoryId'
    | 'search'
    | 'tagIds'
    | 'to'
    | 'type'
    | 'untagged'
    | 'vendorId'
>;

type FilteredTransactionRows = {
    readonly budgetId: number;
    readonly categoriesById: ReadonlyMap<number, CategoryDb>;
    readonly rows: readonly TransactionDb[];
    readonly tagsByTransaction: ReadonlyMap<number, readonly TransactionTag[]>;
    readonly tagsLoadedForAllRows: boolean;
    readonly vendorsById: ReadonlyMap<number, VendorDb>;
};

type CategoryTrendBucket = CategoryTrendResponse['trend'][number];

type StatsRanges = {
    readonly selected: StatsRange;
    readonly previousPeriod: StatsRange;
    readonly previousYear: StatsRange;
};

type PeriodWindowQuery = {
    readonly budgetId?: number;
    readonly period?: DashboardPeriod;
    readonly date?: Date;
    readonly currency?: string;
    readonly before?: number;
    readonly after?: number;
    readonly vendorLimit?: number;
};

type CategoryTrendRangeOptions = {
    readonly categoryCreatedAt: Date;
    readonly now?: Date;
    readonly rows?: readonly TransactionDb[];
    readonly timeZone?: string;
};

type CategoryComparison = {
    readonly categoryId: number;
    readonly categoryName: string;
    readonly categoryDisplayName: string;
    readonly categoryParentId: number | null;
    readonly categoryParentName?: string;
    readonly categoryKind: 'normal' | 'offset';
    readonly type: 'expense' | 'income';
    readonly total: number;
};

type DashboardReportingAmounts = {
    readonly amountsByTransactionId?: ReadonlyMap<number, number>;
    readonly currency: string;
};

export const categoryTrendMaxBuckets = 500;
const dashboardVendorLimit = 24;
const noVendorName = 'No vendor';

export function transactionSignedDefaultAmount(
    transaction: Pick<TransactionDb, 'defaultCurrencyAmount'> & {
        readonly category?: CategoryDb | null;
    },
    categoryOverride?: CategoryDb
): number {
    void categoryOverride;
    return Math.abs(Number(transaction.defaultCurrencyAmount));
}

function dashboardTransactionAmount(
    transaction: Pick<TransactionDb, 'defaultCurrencyAmount' | 'id'> & {
        readonly category?: CategoryDb | null;
    },
    reportingAmounts?: DashboardReportingAmounts,
    categoryOverride?: CategoryDb
): number {
    return (
        reportingAmounts?.amountsByTransactionId?.get(transaction.id) ??
        transactionSignedDefaultAmount(transaction, categoryOverride)
    );
}

function normalizedDashboardCurrency(
    currency: string | undefined,
    defaultCurrency: string
): string {
    const normalized = (currency ?? defaultCurrency).trim().toUpperCase();
    return /^[A-Z]{3}$/.test(normalized)
        ? normalized
        : defaultCurrency.trim().toUpperCase();
}

async function dashboardReportingAmounts(
    db: AppDb,
    config: Config,
    user: Pick<UserDb, 'defaultCurrency' | 'timezone'>,
    rows: readonly TransactionDb[],
    currency?: string
): Promise<DashboardReportingAmounts> {
    const defaultCurrency = user.defaultCurrency.trim().toUpperCase();
    const reportingCurrency = normalizedDashboardCurrency(
        currency,
        defaultCurrency
    );
    if (reportingCurrency === defaultCurrency) {
        return { currency: defaultCurrency };
    }

    const rateCache = new Map<
        `${string}:${string}:${string}`,
        Promise<number>
    >();
    const amountsByTransactionId = new Map<number, number>();

    await Promise.all(
        rows.map(async row => {
            const baseCurrency = row.currency.trim().toUpperCase();
            const rateDate = transactionDate(row.occurredAt, user.timezone);
            const rateKey =
                `${baseCurrency}:${reportingCurrency}:${rateDate}` as const;
            let rate = rateCache.get(rateKey);
            if (!rate) {
                rate = getExchangeRate(
                    db,
                    config,
                    baseCurrency,
                    reportingCurrency,
                    rateDate
                ).then(exchange => exchange.rate);
                rateCache.set(rateKey, rate);
            }

            amountsByTransactionId.set(
                row.id,
                convertAmount(Math.abs(Number(row.amount)), await rate)
            );
        })
    );

    return { amountsByTransactionId, currency: reportingCurrency };
}

async function loadCategoriesById(
    db: AppDb,
    budgetId: number
): Promise<Map<number, CategoryDb>> {
    const categories = (await db.categories.where(
        category => category.budgetId,
        budgetId
    )) as CategoryDb[];

    return new Map(
        categories.map(category => [category.id, category] as const)
    );
}

async function loadVendorsById(
    db: AppDb,
    budgetId: number
): Promise<Map<number, VendorDb>> {
    const vendors = (await db.vendors.where(
        vendor => vendor.budgetId,
        budgetId
    )) as VendorDb[];

    return new Map(vendors.map(vendor => [vendor.id, vendor] as const));
}

async function loadTransactionCreators(
    knex: Knex,
    transactions: readonly Pick<TransactionDb, 'userId'>[]
): Promise<Map<number, TransactionCreator>> {
    const userIds = Array.from(
        new Set(transactions.map(transaction => transaction.userId))
    );
    if (userIds.length === 0) {
        return new Map();
    }

    const rows = (await knex('users')
        .whereIn('id', userIds)
        .select({ id: 'id', email: 'email' })) as Array<{
        readonly id: number;
        readonly email: string;
    }>;

    return new Map(
        rows.map(row => [
            Number(row.id),
            { userId: Number(row.id), email: row.email }
        ])
    );
}

async function loadFavoriteCurrencies(
    db: AppDb,
    userId: number
): Promise<string[]> {
    const rows = await db.favoriteCurrencies
        .where(currency => currency.userId, userId)
        .orderBy(currency => currency.currency, 'asc');
    return rows.map(row => row.currency);
}

function categoryFields(
    category: CategoryDb | null | undefined,
    fallback: Pick<TransactionDb, 'categoryId' | 'type'>,
    categoriesById: ReadonlyMap<number, CategoryDb>
) {
    const parent = category
        ? categoryParent(category, categoriesById)
        : undefined;

    return {
        categoryId: category?.id ?? fallback.categoryId,
        categoryName: category?.name ?? '',
        categoryDisplayName: category
            ? categoryDisplayName(category, categoriesById)
            : '',
        categoryParentId: category?.parentId ?? null,
        categoryParentName: parent?.name,
        categoryKind: category?.kind === 'offset' ? 'offset' : 'normal',
        type: categoryReportingType(category, fallback.type)
    } as const;
}

function parentCategoryFields(
    category: Pick<
        StatsCategory,
        | 'categoryId'
        | 'categoryName'
        | 'categoryDisplayName'
        | 'categoryParentId'
        | 'categoryParentName'
        | 'type'
    >,
    categoriesById: ReadonlyMap<number, CategoryDb>
) {
    const parent =
        category.categoryParentId !== null
            ? categoriesById.get(category.categoryParentId)
            : categoriesById.get(category.categoryId);

    return {
        categoryId: parent?.id ?? category.categoryId,
        categoryName: parent?.name ?? category.categoryName,
        categoryDisplayName: parent?.name ?? category.categoryDisplayName,
        categoryParentId: null,
        categoryParentName: undefined,
        categoryKind: 'normal' as const,
        type: category.type
    };
}

function dashboardVendorFields(
    row: Pick<TransactionDb, 'vendorId'>,
    vendorsById: ReadonlyMap<number, VendorDb>
): Pick<
    DashboardVendor,
    | 'vendorId'
    | 'vendorName'
    | 'vendorDomain'
    | 'vendorLogoUrl'
    | 'vendorPrimaryColor'
> | null {
    if (!row.vendorId) {
        return {
            vendorId: null,
            vendorName: noVendorName,
            vendorDomain: undefined,
            vendorLogoUrl: undefined,
            vendorPrimaryColor: undefined
        };
    }

    const vendor = vendorsById.get(row.vendorId);
    if (!vendor) {
        return null;
    }

    return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorDomain: vendor.domain ?? undefined,
        vendorLogoUrl: vendor.logoUrl ?? undefined,
        vendorPrimaryColor: vendor.primaryColor ?? undefined
    };
}

function categoryForTransaction(
    row: Pick<TransactionDb, 'category' | 'categoryId'>,
    categoriesById: ReadonlyMap<number, CategoryDb>
): CategoryDb | undefined {
    return categoriesById.get(row.categoryId) ?? row.category ?? undefined;
}

function mapTransaction(
    row: TransactionDb,
    categoriesById: ReadonlyMap<number, CategoryDb>,
    vendorsById: ReadonlyMap<number, VendorDb>,
    scanAttachments: ReadonlyMap<number, TransactionScanAttachment> = new Map(),
    tagsByTransaction: ReadonlyMap<
        number,
        readonly TransactionTag[]
    > = new Map(),
    creatorsById: ReadonlyMap<number, TransactionCreator> = new Map()
): Transaction {
    const category = categoryForTransaction(row, categoriesById);
    const fields = categoryFields(category, row, categoriesById);
    const vendor = row.vendorId ? vendorsById.get(row.vendorId) : undefined;

    return {
        id: row.id,
        budgetId: row.budgetId,
        categoryId: fields.categoryId,
        vendorId: vendor?.id ?? row.vendorId ?? null,
        vendorName: vendor?.name,
        vendorLogoUrl: vendor?.logoUrl ?? undefined,
        categoryName: fields.categoryName,
        categoryDisplayName: fields.categoryDisplayName,
        categoryParentId: fields.categoryParentId,
        categoryParentName: fields.categoryParentName,
        categoryKind: fields.categoryKind,
        type: fields.type,
        amount: Number(row.amount),
        currency: row.currency,
        defaultCurrencyAmount: Number(row.defaultCurrencyAmount),
        defaultCurrency: row.defaultCurrency,
        exchangeRate: Number(row.exchangeRate),
        exchangeRateDate: row.exchangeRateDate,
        occurredAt: row.occurredAt,
        note: row.note ?? undefined,
        tags: [...(tagsByTransaction.get(row.id) ?? [])],
        createdBy: creatorsById.get(row.userId) ?? {
            userId: row.userId,
            email: ''
        },
        scanAttachment: scanAttachments.get(row.id) ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function transactionTagIds(value: string | undefined): number[] {
    if (!value) {
        return [];
    }

    return [
        ...new Set(
            value
                .split(',')
                .map(item => Number(item))
                .filter(item => Number.isInteger(item) && item > 0)
        )
    ];
}

async function transactionTagCounts(
    knex: Knex,
    tagIds: readonly number[]
): Promise<Map<number, number>> {
    const uniqueIds = [...new Set(tagIds)];
    if (uniqueIds.length === 0) {
        return new Map();
    }

    const rows = (await knex('transaction_tag_links')
        .whereIn('tag_id', uniqueIds)
        .groupBy('tag_id')
        .select({ tagId: 'tag_id' })
        .count({
            transactionCount: 'transaction_id'
        })) as TransactionTagCountRow[];

    return new Map(
        rows.map(row => [Number(row.tagId), Number(row.transactionCount)])
    );
}

async function transactionTagsByTransaction(
    knex: Knex | undefined,
    budgetId: number,
    transactionIds: readonly number[]
): Promise<Map<number, readonly TransactionTag[]>> {
    const uniqueIds = [...new Set(transactionIds)];
    if (!knex || uniqueIds.length === 0) {
        return new Map();
    }

    const rows = (await knex('transaction_tag_links as link')
        .join('transaction_tags as tag', 'tag.id', 'link.tag_id')
        .where('tag.budget_id', budgetId)
        .whereIn('link.transaction_id', uniqueIds)
        .orderBy('tag.name', 'asc')
        .select({
            transactionId: 'link.transaction_id',
            budgetId: 'tag.budget_id',
            id: 'tag.id',
            name: 'tag.name',
            createdAt: 'tag.created_at',
            updatedAt: 'tag.updated_at'
        })) as TransactionTagRow[];
    const counts = await transactionTagCounts(
        knex,
        rows.map(row => row.id)
    );
    const tags = new Map<number, TransactionTag[]>();

    for (const row of rows) {
        const current = tags.get(row.transactionId) ?? [];
        current.push({
            id: Number(row.id),
            budgetId: Number(row.budgetId),
            name: row.name,
            transactionCount: counts.get(Number(row.id)) ?? 0,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        });
        tags.set(row.transactionId, current);
    }

    return tags;
}

function scanAttachmentFromRow(
    row: TransactionScanAttachmentRow
): TransactionScanAttachment {
    return {
        scanId: Number(row.scanId),
        scanItemId: Number(row.scanItemId),
        fileName: row.fileName,
        mimeType: row.mimeType,
        sizeBytes: Number(row.sizeBytes),
        createdAt: row.createdAt
    };
}

async function scanAttachmentsByTransaction(
    knex: Knex | undefined,
    budgetId: number,
    transactionIds: readonly number[]
): Promise<Map<number, TransactionScanAttachment>> {
    const uniqueIds = [...new Set(transactionIds)];
    if (!knex || uniqueIds.length === 0) {
        return new Map();
    }

    const rows = (await knex('transaction_scan_items as item')
        .join(
            'transaction_scan_images as image',
            'image.scan_id',
            'item.scan_id'
        )
        .where('item.budget_id', budgetId)
        .where('image.budget_id', budgetId)
        .where('item.decision', 'confirmed')
        .whereIn('item.transaction_id', uniqueIds)
        .orderBy('item.decided_at', 'desc')
        .select({
            transactionId: 'item.transaction_id',
            budgetId: 'item.budget_id',
            scanId: 'item.scan_id',
            scanItemId: 'item.id',
            fileName: 'image.file_name',
            mimeType: 'image.mime_type',
            sizeBytes: 'image.size_bytes',
            createdAt: 'image.created_at'
        })) as TransactionScanAttachmentRow[];

    const attachments = new Map<number, TransactionScanAttachment>();
    for (const row of rows) {
        if (!attachments.has(row.transactionId)) {
            attachments.set(row.transactionId, scanAttachmentFromRow(row));
        }
    }
    return attachments;
}

export function compareTransactionsByOccurrenceDesc(
    left: Pick<TransactionDb, 'id' | 'occurredAt'>,
    right: Pick<TransactionDb, 'id' | 'occurredAt'>
): number {
    return (
        right.occurredAt.getTime() - left.occurredAt.getTime() ||
        right.id - left.id
    );
}

export function compareTransactionsByOccurrenceAsc(
    left: Pick<TransactionDb, 'id' | 'occurredAt'>,
    right: Pick<TransactionDb, 'id' | 'occurredAt'>
): number {
    return (
        left.occurredAt.getTime() - right.occurredAt.getTime() ||
        left.id - right.id
    );
}

async function getUser(db: AppDb, userId: number): Promise<UserDb> {
    const user = await db.users.find(userId);
    if (!user) {
        throw new TransactionCategoryError('User was not found.');
    }
    return user as UserDb;
}

async function getCategory(
    db: AppDb,
    budgetId: number,
    categoryId: number
): Promise<CategoryDb> {
    const category = await db.categories
        .where(candidate => candidate.id, categoryId)
        .where(candidate => candidate.budgetId, budgetId)
        .first();
    if (!category) {
        throw new TransactionCategoryError('Category was not found.');
    }
    return category as CategoryDb;
}

async function validateVendor(
    db: AppDb,
    userId: number,
    budgetId: number,
    vendorId: number
): Promise<void> {
    try {
        const vendor = await getVendor(db, userId, vendorId);
        if (vendor.budgetId !== budgetId) {
            throw new TransactionCategoryError('Vendor was not found.');
        }
    } catch (err) {
        if (err instanceof VendorNotFoundError) {
            throw new TransactionCategoryError(err.message);
        }
        throw err;
    }
}

async function filteredTransactionRows(
    db: AppDb,
    userId: number,
    query: TransactionFilterQuery,
    knex: Knex | undefined,
    options: { readonly includeTagsForAllRows?: boolean } = {}
): Promise<FilteredTransactionRows> {
    const access = await resolveBudgetAccess(db, userId, query.budgetId);
    let builder = db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.budgetId, access.budget.id);

    if (query.categoryId) {
        builder = builder.where(
            transaction => transaction.categoryId,
            query.categoryId
        );
    }
    if (query.from) {
        builder = builder.where(
            transaction => transaction.occurredAt,
            '>=',
            query.from
        );
    }
    if (query.to) {
        builder = builder.where(
            transaction => transaction.occurredAt,
            '<=',
            query.to
        );
    }

    const direction = query.direction ?? 'desc';
    const [rows, categoriesById, vendorsById] = await Promise.all([
        builder
            .orderBy(transaction => transaction.occurredAt, direction)
            .orderBy(transaction => transaction.id, direction),
        loadCategoriesById(db, access.budget.id),
        loadVendorsById(db, access.budget.id)
    ]);
    const sortedRows = [...rows].sort(
        direction === 'asc'
            ? compareTransactionsByOccurrenceAsc
            : compareTransactionsByOccurrenceDesc
    ) as TransactionDb[];

    const search = query.search?.trim().toLowerCase();
    const tagIds = transactionTagIds(query.tagIds);
    const needsAllTagData =
        Boolean(search) ||
        tagIds.length > 0 ||
        query.untagged === true ||
        options.includeTagsForAllRows === true;
    const allTagsByTransaction = needsAllTagData
        ? await transactionTagsByTransaction(
              knex ?? db.knex,
              access.budget.id,
              sortedRows.map(transaction => transaction.id)
          )
        : new Map<number, readonly TransactionTag[]>();
    const filtered = sortedRows
        .filter(transaction => {
            if (query.vendorId === 'none') {
                return transaction.vendorId == null;
            }
            if (!query.vendorId) {
                return true;
            }

            return transaction.vendorId === query.vendorId;
        })
        .filter(transaction => {
            if (!query.type) {
                return true;
            }

            const category = categoryForTransaction(
                transaction,
                categoriesById
            );
            return (
                categoryReportingType(category, transaction.type) === query.type
            );
        })
        .filter(transaction => {
            if (!query.parentCategoryId) {
                return true;
            }

            const category = categoryForTransaction(
                transaction,
                categoriesById
            );
            return (
                transaction.categoryId === query.parentCategoryId ||
                category?.parentId === query.parentCategoryId
            );
        })
        .filter(transaction => {
            if (tagIds.length === 0 && query.untagged !== true) {
                return true;
            }

            const tags = allTagsByTransaction.get(transaction.id) ?? [];
            if (query.untagged === true && tags.length > 0) {
                return false;
            }
            return tagIds.every(tagId => tags.some(tag => tag.id === tagId));
        })
        .filter(transaction => {
            if (!search) {
                return true;
            }

            const category = categoryForTransaction(
                transaction,
                categoriesById
            );
            return (
                category?.name.toLowerCase().includes(search) ||
                (category
                    ? categoryDisplayName(
                          category,
                          categoriesById
                      ).toLowerCase()
                    : ''
                ).includes(search) ||
                (transaction.vendorId
                    ? (vendorsById.get(transaction.vendorId)?.name ?? '')
                          .toLowerCase()
                          .includes(search)
                    : false) ||
                (transaction.vendorId
                    ? (vendorsById.get(transaction.vendorId)?.domain ?? '')
                          .toLowerCase()
                          .includes(search)
                    : false) ||
                (allTagsByTransaction.get(transaction.id) ?? []).some(tag =>
                    tag.name.toLowerCase().includes(search)
                ) ||
                transaction.note?.toLowerCase().includes(search)
            );
        });

    return {
        budgetId: access.budget.id,
        categoriesById,
        rows: filtered,
        tagsByTransaction: allTagsByTransaction,
        tagsLoadedForAllRows: needsAllTagData,
        vendorsById
    };
}

export async function listTransactions(
    db: AppDb,
    userId: number,
    query: TransactionListQuery,
    knex?: Knex
) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const {
        budgetId,
        categoriesById,
        rows: filtered,
        tagsByTransaction,
        tagsLoadedForAllRows,
        vendorsById
    } = await filteredTransactionRows(db, userId, query, knex);
    const offset = (page - 1) * limit;
    const pageRows = filtered.slice(offset, offset + limit) as TransactionDb[];
    const scanAttachments = await scanAttachmentsByTransaction(
        knex,
        budgetId,
        pageRows.map(transaction => transaction.id)
    );
    const pageTagsByTransaction = tagsLoadedForAllRows
        ? tagsByTransaction
        : await transactionTagsByTransaction(
              knex ?? db.knex,
              budgetId,
              pageRows.map(transaction => transaction.id)
          );
    const creatorsById = await loadTransactionCreators(
        knex ?? db.knex,
        pageRows
    );

    return {
        items: pageRows.map(transaction =>
            mapTransaction(
                transaction,
                categoriesById,
                vendorsById,
                scanAttachments,
                pageTagsByTransaction,
                creatorsById
            )
        ),
        total: filtered.length,
        page,
        limit
    };
}

function exportCurrencies(value: string): string[] {
    return [
        ...new Set(
            value
                .split(',')
                .map(currency => currency.trim().toUpperCase())
                .filter(currency => /^[A-Z]{3}$/.test(currency))
        )
    ];
}

function csvCell(value: Date | number | string | null | undefined): string {
    if (value === null || value === undefined) {
        return '';
    }

    const text = value instanceof Date ? value.toISOString() : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvLine(
    values: readonly (Date | number | string | null | undefined)[]
): string {
    return values.map(csvCell).join(',');
}

function signedExportAmount(value: number, type: 'expense' | 'income'): number {
    return type === 'expense' ? -Math.abs(value) : Math.abs(value);
}

function exportFileName(now = new Date()): string {
    return `xpenser-transactions-${now.toISOString().slice(0, 10)}.csv`;
}

type ExportRateRequest = {
    readonly base: string;
    readonly date: string;
    readonly key: string;
    readonly quote: string;
};

async function mapWithConcurrency<T>(
    items: readonly T[],
    concurrency: number,
    mapper: (item: T) => Promise<void>
): Promise<void> {
    let index = 0;
    const workerCount = Math.min(Math.max(1, concurrency), items.length);
    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            for (;;) {
                const item = items[index];
                index += 1;
                if (item === undefined) {
                    return;
                }
                await mapper(item);
            }
        })
    );
}

async function exportCurrencyRates(
    db: AppDb,
    config: Config,
    transactions: readonly Transaction[],
    currencies: readonly string[],
    timezone: string
): Promise<ReadonlyMap<string, number>> {
    const requests = new Map<string, ExportRateRequest>();

    for (const transaction of transactions) {
        const date = transactionDate(transaction.occurredAt, timezone);
        const base = transaction.currency.trim().toUpperCase();
        for (const quoteCurrency of currencies) {
            const quote = quoteCurrency.trim().toUpperCase();
            if (base === quote) {
                continue;
            }

            const key = `${base}:${quote}:${date}`;
            if (!requests.has(key)) {
                requests.set(key, { base, date, key, quote });
            }
        }
    }

    const rates = new Map<string, number>();
    await mapWithConcurrency([...requests.values()], 4, async request => {
        const exchange = await getExchangeRate(
            db,
            config,
            request.base,
            request.quote,
            request.date
        );
        rates.set(request.key, exchange.rate);
    });

    return rates;
}

function convertedExportAmount(
    transaction: Transaction,
    currency: string,
    rates: ReadonlyMap<string, number>,
    timezone: string
): number {
    const base = transaction.currency.trim().toUpperCase();
    const quote = currency.trim().toUpperCase();
    if (base === quote) {
        return signedExportAmount(
            Math.abs(transaction.amount),
            transaction.type
        );
    }

    const rateDate = transactionDate(transaction.occurredAt, timezone);
    const rate = rates.get(`${base}:${quote}:${rateDate}`);
    if (rate === undefined) {
        throw new TransactionExportError(
            `Missing ${base}/${quote} exchange rate for ${rateDate}.`
        );
    }

    return signedExportAmount(
        convertAmount(Math.abs(transaction.amount), rate),
        transaction.type
    );
}

function transactionCsvRows(
    transactions: readonly Transaction[],
    currencies: readonly string[],
    rates: ReadonlyMap<string, number>,
    timezone: string
): string {
    const headers = [
        'id',
        'occurred_at',
        'type',
        'category_id',
        'category_name',
        'category_display_name',
        'category_parent_id',
        'category_parent_name',
        'category_kind',
        'vendor_id',
        'vendor_name',
        'tag_ids',
        'tags',
        'note',
        'amount',
        'signed_amount',
        'currency',
        'default_currency_amount',
        'default_currency',
        'exchange_rate',
        'exchange_rate_date',
        'scan_id',
        'scan_item_id',
        'scan_file_name',
        'scan_mime_type',
        'scan_size_bytes',
        'created_at',
        'updated_at',
        ...currencies.map(currency => `amount_${currency}`)
    ];

    const lines = [csvLine(headers)];
    for (const transaction of transactions) {
        lines.push(
            csvLine([
                transaction.id,
                transaction.occurredAt,
                transaction.type,
                transaction.categoryId,
                transaction.categoryName,
                transaction.categoryDisplayName,
                transaction.categoryParentId,
                transaction.categoryParentName,
                transaction.categoryKind,
                transaction.vendorId,
                transaction.vendorName,
                transaction.tags.map(tag => tag.id).join('; '),
                transaction.tags.map(tag => tag.name).join('; '),
                transaction.note,
                transaction.amount,
                signedExportAmount(transaction.amount, transaction.type),
                transaction.currency,
                signedExportAmount(
                    transaction.defaultCurrencyAmount,
                    transaction.type
                ),
                transaction.defaultCurrency,
                transaction.exchangeRate,
                transaction.exchangeRateDate,
                transaction.scanAttachment?.scanId,
                transaction.scanAttachment?.scanItemId,
                transaction.scanAttachment?.fileName,
                transaction.scanAttachment?.mimeType,
                transaction.scanAttachment?.sizeBytes,
                transaction.createdAt,
                transaction.updatedAt,
                ...currencies.map(currency =>
                    convertedExportAmount(
                        transaction,
                        currency,
                        rates,
                        timezone
                    )
                )
            ])
        );
    }

    return `${lines.join('\n')}\n`;
}

export async function exportTransactionsCsv(
    db: AppDb,
    config: Config,
    userId: number,
    query: TransactionExportQuery,
    knex?: Knex
): Promise<{ readonly csv: string; readonly fileName: string }> {
    const [user, favorites, access] = await Promise.all([
        getUser(db, userId),
        loadFavoriteCurrencies(db, userId),
        resolveBudgetAccess(db, userId, query.budgetId)
    ]);
    const allowedCurrencies = new Set(
        [access.budget.defaultCurrency, ...favorites].map(currency =>
            currency.trim().toUpperCase()
        )
    );
    const currencies = exportCurrencies(query.currencies);
    if (currencies.length === 0) {
        throw new TransactionExportError(
            'Select at least one currency to export.'
        );
    }

    const disallowed = currencies.filter(
        currency => !allowedCurrencies.has(currency)
    );
    if (disallowed.length > 0) {
        throw new TransactionExportError(
            'Exports can include only your default and favorite currencies.'
        );
    }

    const { budgetId, categoriesById, rows, tagsByTransaction, vendorsById } =
        await filteredTransactionRows(db, userId, query, knex, {
            includeTagsForAllRows: true
        });
    const scanAttachments = await scanAttachmentsByTransaction(
        knex,
        budgetId,
        rows.map(transaction => transaction.id)
    );
    const creatorsById = await loadTransactionCreators(knex ?? db.knex, rows);
    const transactions = rows.map(transaction =>
        mapTransaction(
            transaction,
            categoriesById,
            vendorsById,
            scanAttachments,
            tagsByTransaction,
            creatorsById
        )
    );
    const rates = await exportCurrencyRates(
        db,
        config,
        transactions,
        currencies,
        user.timezone
    );

    return {
        csv: transactionCsvRows(transactions, currencies, rates, user.timezone),
        fileName: exportFileName()
    };
}

export async function createTransaction(
    db: AppDb,
    config: Config,
    userId: number,
    body: CreateTransactionBody
): Promise<Transaction> {
    return db.transaction(async trx => {
        const access = await resolveBudgetAccess(trx, userId, body.budgetId);
        requireBudgetPermission(access, 'canCreateTransactions');
        if ((body.tags?.length ?? 0) > 0) {
            requireBudgetPermission(access, 'canManageTags');
        }
        const [user, categoriesById] = await Promise.all([
            getUser(trx, userId),
            loadCategoriesById(trx, access.budget.id)
        ]);
        const category = categoriesById.get(body.categoryId);
        if (!category) {
            throw new TransactionCategoryError('Category was not found.');
        }
        if (!categoryAvailableForTransactions(category, categoriesById)) {
            throw new TransactionCategoryError(
                'Archived categories cannot be used for new transactions.'
            );
        }
        if (body.vendorId !== undefined && body.vendorId !== null) {
            await validateVendor(trx, userId, access.budget.id, body.vendorId);
        }
        const date = transactionDate(body.occurredAt, user.timezone);
        const exchange = await getExchangeRate(
            trx,
            config,
            body.currency,
            access.budget.defaultCurrency,
            date
        );

        const created = await trx.transactions.insert({
            budgetId: access.budget.id,
            userId,
            categoryId: body.categoryId,
            vendorId: body.vendorId ?? undefined,
            type: category.type,
            amount: body.amount,
            currency: body.currency,
            defaultCurrencyAmount: convertAmount(body.amount, exchange.rate),
            defaultCurrency: access.budget.defaultCurrency,
            exchangeRate: exchange.rate,
            exchangeRateDate: exchange.rateDate,
            occurredAt: body.occurredAt,
            note: body.note ?? undefined
        });

        await replaceTransactionTags(
            trx.knex,
            userId,
            access.budget.id,
            created.id,
            body.tags ?? []
        );

        return getTransaction(trx, userId, created.id);
    });
}

export async function getTransaction(
    db: AppDb,
    userId: number,
    transactionId: number
): Promise<Transaction> {
    const row = (await db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.id, transactionId)
        .first()) as TransactionDb | undefined;
    if (!row) {
        throw new TransactionNotFoundError('Transaction was not found.');
    }
    const access = await resolveBudgetAccess(db, userId, row.budgetId);
    const [categoriesById, vendorsById, tagsByTransaction, creatorsById] =
        await Promise.all([
            loadCategoriesById(db, access.budget.id),
            loadVendorsById(db, access.budget.id),
            transactionTagsByTransaction(db.knex, access.budget.id, [
                transactionId
            ]),
            loadTransactionCreators(db.knex, [row])
        ]);
    return mapTransaction(
        row,
        categoriesById,
        vendorsById,
        new Map(),
        tagsByTransaction,
        creatorsById
    );
}

export async function getTransactionScanImage(
    db: AppDb,
    knex: Knex,
    userId: number,
    transactionId: number
): Promise<TransactionScanImageResponse> {
    const row = (await knex('transaction_scan_items as item')
        .join(
            'transaction_scan_images as image',
            'image.scan_id',
            'item.scan_id'
        )
        .where('item.transaction_id', transactionId)
        .where('item.decision', 'confirmed')
        .orderBy('item.decided_at', 'desc')
        .select({
            scanId: 'item.scan_id',
            scanItemId: 'item.id',
            budgetId: 'item.budget_id',
            fileName: 'image.file_name',
            mimeType: 'image.mime_type',
            sizeBytes: 'image.size_bytes',
            createdAt: 'image.created_at',
            imageBase64: 'image.image_base64'
        })
        .first()) as TransactionScanImageRow | undefined;

    if (!row) {
        throw new TransactionNotFoundError('Scanned image was not found.');
    }
    await resolveBudgetAccess(db, userId, Number(row.budgetId));

    return {
        ...scanAttachmentFromRow({ ...row, transactionId }),
        imageBase64: row.imageBase64
    };
}

export async function updateTransaction(
    db: AppDb,
    config: Config,
    userId: number,
    transactionId: number,
    body: Partial<CreateTransactionBody>
): Promise<Transaction> {
    return db.transaction(async trx => {
        const current = await getTransaction(trx, userId, transactionId);
        const access = await resolveBudgetAccess(trx, userId, current.budgetId);
        requireBudgetPermission(access, 'canUpdateTransactions');
        if (body.tags !== undefined) {
            requireBudgetPermission(access, 'canManageTags');
        }
        const next = {
            categoryId: body.categoryId ?? current.categoryId,
            vendorId:
                body.vendorId !== undefined ? body.vendorId : current.vendorId,
            amount: body.amount ?? current.amount,
            currency: body.currency ?? current.currency,
            occurredAt: body.occurredAt ?? current.occurredAt,
            note: body.note ?? current.note
        };

        const [user, categoriesById] = await Promise.all([
            getUser(trx, userId),
            loadCategoriesById(trx, access.budget.id)
        ]);
        const category = categoriesById.get(next.categoryId);
        if (!category) {
            throw new TransactionCategoryError('Category was not found.');
        }
        const categoryChanged =
            body.categoryId !== undefined &&
            body.categoryId !== current.categoryId;
        if (
            categoryChanged &&
            !categoryAvailableForTransactions(category, categoriesById)
        ) {
            throw new TransactionCategoryError(
                'Archived categories cannot be used for new transactions.'
            );
        }
        if (next.vendorId !== undefined && next.vendorId !== null) {
            await validateVendor(trx, userId, access.budget.id, next.vendorId);
        }
        const exchange = await getExchangeRate(
            trx,
            config,
            next.currency,
            access.budget.defaultCurrency,
            transactionDate(next.occurredAt, user.timezone)
        );

        await trx.transactions
            .where(transaction => transaction.id, transactionId)
            .where(transaction => transaction.budgetId, access.budget.id)
            .update({
                categoryId: next.categoryId,
                vendorId: (next.vendorId ?? null) as never,
                type: category.type,
                amount: next.amount,
                currency: next.currency,
                defaultCurrencyAmount: convertAmount(
                    next.amount,
                    exchange.rate
                ),
                defaultCurrency: access.budget.defaultCurrency,
                exchangeRate: exchange.rate,
                exchangeRateDate: exchange.rateDate,
                occurredAt: next.occurredAt,
                note: next.note ?? undefined,
                updatedAt: new Date()
            });

        if (body.tags !== undefined) {
            await replaceTransactionTags(
                trx.knex,
                userId,
                access.budget.id,
                transactionId,
                body.tags
            );
        }

        return getTransaction(trx, userId, transactionId);
    });
}

export async function deleteTransaction(
    db: AppDb,
    userId: number,
    transactionId: number
): Promise<void> {
    await db.transaction(async trx => {
        const current = await trx.transactions
            .where(transaction => transaction.id, transactionId)
            .first();
        if (!current) {
            throw new TransactionNotFoundError('Transaction was not found.');
        }
        const access = await resolveBudgetAccess(
            trx,
            userId,
            (current as TransactionDb).budgetId
        );
        requireBudgetPermission(access, 'canDeleteTransactions');
        const deleted = await trx.transactions
            .where(transaction => transaction.id, transactionId)
            .where(transaction => transaction.budgetId, access.budget.id)
            .delete();
        if (deleted === 0) {
            throw new TransactionNotFoundError('Transaction was not found.');
        }
        await pruneUnusedTransactionTags(trx.knex, access.budget.id);
    });
}

function isValidDate(value: unknown): value is Date {
    return value instanceof Date && !Number.isNaN(value.getTime());
}

function previousRollingRange(range: StatsRange): StatsRange {
    const duration = range.to.getTime() - range.from.getTime();
    const to = new Date(range.from.getTime() - 1);
    return {
        from: new Date(to.getTime() - duration),
        to
    };
}

function previousCalendarMonthRange(
    range: StatsRange,
    timeZone: string
): StatsRange {
    const currentMonth = localStartOfMonth(range.from, timeZone);
    const to = new Date(currentMonth.getTime() - 1);
    return {
        from: localStartOfMonth(
            addLocalMonths(currentMonth, -1, timeZone),
            timeZone
        ),
        to
    };
}

function shiftRangeDays(
    range: StatsRange,
    days: number,
    timeZone: string
): StatsRange {
    return {
        from: addLocalDays(range.from, days, timeZone),
        to: addLocalDays(range.to, days, timeZone)
    };
}

function shiftRangeMonths(
    range: StatsRange,
    months: number,
    timeZone: string
): StatsRange {
    return {
        from: addLocalMonths(range.from, months, timeZone),
        to: addLocalMonths(range.to, months, timeZone)
    };
}

function shiftRangeYears(
    range: StatsRange,
    years: number,
    timeZone: string
): StatsRange {
    return {
        from: addLocalYears(range.from, years, timeZone),
        to: addLocalYears(range.to, years, timeZone)
    };
}

export function percentChange(current: number, previous: number): number {
    if (previous === 0) {
        if (current === 0) {
            return 0;
        }
        return current > 0 ? 100 : -100;
    }

    return ((current - previous) / Math.abs(previous)) * 100;
}

function normalizeRange(from: Date, to: Date, timeZone: string): StatsRange {
    return from <= to
        ? { from, to }
        : {
              from: localStartOfDay(to, timeZone),
              to: localEndOfDay(from, timeZone)
          };
}

function categoryTrendGroupBy(value?: CategoryTrendGroupBy) {
    return value ?? 'month';
}

function categoryTrendRange(value?: CategoryTrendRange) {
    return value ?? 'last-12-months';
}

function categoryTrendStart(
    groupBy: CategoryTrendGroupBy,
    value: Date,
    timeZone: string
): Date {
    if (groupBy === 'week') {
        return localStartOfWeek(value, timeZone);
    }
    if (groupBy === 'month') {
        return localStartOfMonth(value, timeZone);
    }
    if (groupBy === 'year') {
        return localStartOfYear(value, timeZone);
    }
    return localStartOfDay(value, timeZone);
}

function categoryTrendBucketStarts(
    groupBy: CategoryTrendGroupBy,
    range: StatsRange,
    timeZone: string,
    limit = Number.POSITIVE_INFINITY
): Date[] {
    const starts: Date[] = [];
    let current = categoryTrendStart(groupBy, range.from, timeZone);

    while (current <= range.to && starts.length <= limit) {
        starts.push(current);
        current = addStatsBucketStepInTimeZone(current, groupBy, timeZone);
    }

    return starts;
}

function categoryTrendBucketEnd(
    groupBy: CategoryTrendGroupBy,
    start: Date,
    range: StatsRange,
    timeZone: string
): Date {
    const nextStart = addStatsBucketStepInTimeZone(start, groupBy, timeZone);
    const end = new Date(nextStart.getTime() - 1);
    return end < range.to ? end : range.to;
}

function clippedBucketStart(start: Date, range: StatsRange): Date {
    return start > range.from ? start : range.from;
}

export function categoryTrendBucketCount(
    groupBy: CategoryTrendGroupBy,
    range: StatsRange,
    timeZone = defaultTimeZone
): number {
    let count = 0;
    let current = categoryTrendStart(groupBy, range.from, timeZone);

    while (current <= range.to) {
        count += 1;
        current = addStatsBucketStepInTimeZone(current, groupBy, timeZone);
    }

    return count;
}

export function resolveCategoryTrendRange(
    query: Partial<CategoryTrendQuery>,
    options: CategoryTrendRangeOptions
): StatsRange {
    const now = options.now ?? new Date();
    const timeZone = options.timeZone ?? defaultTimeZone;
    const today = localStartOfDay(now, timeZone);
    const range = categoryTrendRange(query.range);

    if (range === 'last-30-days') {
        return { from: addLocalDays(today, -29, timeZone), to: now };
    }
    if (range === 'last-90-days') {
        return { from: addLocalDays(today, -89, timeZone), to: now };
    }
    if (range === 'this-year') {
        return { from: localStartOfYear(now, timeZone), to: now };
    }
    if (range === 'all-time') {
        const firstTransaction = [...(options.rows ?? [])].sort(
            compareTransactionsByOccurrenceAsc
        )[0];
        return {
            from: localStartOfDay(
                firstTransaction?.occurredAt ?? options.categoryCreatedAt,
                timeZone
            ),
            to: now
        };
    }
    if (
        range === 'custom' &&
        isValidDate(query.from) &&
        isValidDate(query.to)
    ) {
        return normalizeRange(
            localStartOfDay(query.from, timeZone),
            localEndOfDay(query.to, timeZone),
            timeZone
        );
    }

    return {
        from: localStartOfMonth(
            addLocalMonths(localStartOfMonth(now, timeZone), -11, timeZone),
            timeZone
        ),
        to: now
    };
}

function emptyCategoryTrendBucket(
    groupBy: CategoryTrendGroupBy,
    range: StatsRange,
    start: Date,
    timeZone: string
): CategoryTrendBucket {
    const key = statsBucketKeyInTimeZone(start, groupBy, timeZone);
    return {
        bucket: key,
        label: statsBucketLabelInTimeZone(start, groupBy, timeZone),
        from: clippedBucketStart(start, range),
        to: categoryTrendBucketEnd(groupBy, start, range, timeZone),
        total: 0,
        transactionCount: 0
    };
}

export function summarizeCategoryTrendRows({
    category,
    categoriesById = new Map([[category.id, category]]),
    currency,
    groupBy,
    range,
    rows,
    timeFrame,
    timeZone = defaultTimeZone
}: {
    readonly category: CategoryDb;
    readonly categoriesById?: ReadonlyMap<number, CategoryDb>;
    readonly currency: string;
    readonly groupBy: CategoryTrendGroupBy;
    readonly range: StatsRange;
    readonly rows: readonly TransactionDb[];
    readonly timeFrame: CategoryTrendRange;
    readonly timeZone?: string;
}): CategoryTrendResponse {
    const selectedRows = rowsInRange(rows, range);
    const total = selectedRows.reduce(
        (sum, row) => sum + transactionSignedDefaultAmount(row, category),
        0
    );
    const fields = categoryFields(
        category,
        { categoryId: category.id, type: category.type },
        categoriesById
    );
    const bucketCount = categoryTrendBucketCount(groupBy, range, timeZone);
    const base = {
        categoryId: category.id,
        categoryName: category.name,
        categoryDisplayName: fields.categoryDisplayName,
        categoryParentId: fields.categoryParentId,
        categoryParentName: fields.categoryParentName,
        categoryKind: fields.categoryKind,
        type: fields.type,
        range: timeFrame,
        groupBy,
        from: range.from,
        to: range.to,
        currency,
        total,
        transactionCount: selectedRows.length,
        bucketCount,
        maxBuckets: categoryTrendMaxBuckets
    } as const;

    if (bucketCount > categoryTrendMaxBuckets) {
        return {
            ...base,
            densityExceeded: true,
            trend: []
        };
    }

    const buckets = new Map(
        categoryTrendBucketStarts(groupBy, range, timeZone).map(
            start =>
                [
                    statsBucketKeyInTimeZone(start, groupBy, timeZone),
                    emptyCategoryTrendBucket(groupBy, range, start, timeZone)
                ] as const
        )
    );

    for (const row of selectedRows) {
        const bucket = buckets.get(
            statsBucketKeyInTimeZone(row.occurredAt, groupBy, timeZone)
        );
        if (!bucket) {
            continue;
        }

        bucket.total += transactionSignedDefaultAmount(row, category);
        bucket.transactionCount += 1;
    }

    return {
        ...base,
        densityExceeded: false,
        trend: Array.from(buckets.values())
    };
}

export function resolveDashboardRange(
    period: DashboardPeriod,
    date = new Date(),
    now = new Date(),
    timeZone = defaultTimeZone
): StatsRange {
    return resolveDashboardRangeInTimeZone(period, date, now, timeZone);
}

export function resolveDashboardComparisonRange(
    period: DashboardPeriod,
    range: StatsRange,
    timeZone = defaultTimeZone
): StatsRange {
    return resolveDashboardComparisonRangeInTimeZone(period, range, timeZone);
}

const defaultPeriodWindowSide = 2;
const maxPeriodWindowSide = 4;

function clampPeriodWindowSide(value: number | undefined): number {
    if (!Number.isFinite(value)) {
        return defaultPeriodWindowSide;
    }
    return Math.min(
        maxPeriodWindowSide,
        Math.max(0, Math.trunc(value ?? defaultPeriodWindowSide))
    );
}

function addDashboardPeriods(
    period: DashboardPeriod,
    value: Date,
    offset: number,
    timeZone: string
): Date {
    let current = value;
    const direction = offset < 0 ? -1 : 1;

    for (let index = 0; index < Math.abs(offset); index += 1) {
        current =
            period === 'day'
                ? addLocalDays(current, direction, timeZone)
                : period === 'week'
                  ? addLocalDays(current, direction * 7, timeZone)
                  : period === 'month'
                    ? addLocalMonths(current, direction, timeZone)
                    : period === 'quarter'
                      ? addLocalMonths(current, direction * 3, timeZone)
                      : addLocalYears(current, direction, timeZone);
    }

    return current;
}

export function resolveDashboardPeriodWindow(
    period: DashboardPeriod,
    date = new Date(),
    now = new Date(),
    timeZone = defaultTimeZone,
    before?: number,
    after?: number
): Date[] {
    const beforeCount = clampPeriodWindowSide(before);
    const afterCount = clampPeriodWindowSide(after);
    const latestStart = resolveDashboardRange(
        period,
        now,
        now,
        timeZone
    ).from.getTime();
    const dates: Date[] = [];
    const seen = new Set<string>();

    for (let offset = -beforeCount; offset <= afterCount; offset += 1) {
        const candidate = addDashboardPeriods(period, date, offset, timeZone);
        const range = resolveDashboardRange(period, candidate, now, timeZone);
        if (offset > 0 && range.from.getTime() > latestStart) {
            continue;
        }

        const key = dateToLocalDateParam(range.from, timeZone);
        if (!seen.has(key)) {
            dates.push(range.from);
            seen.add(key);
        }
    }

    return dates;
}

function rangeKey(range: StatsRange, timeZone: string): string {
    return dateToLocalDateParam(range.from, timeZone);
}

function encompassingRange(ranges: readonly StatsRange[]): StatsRange {
    return {
        from: new Date(Math.min(...ranges.map(range => range.from.getTime()))),
        to: new Date(Math.max(...ranges.map(range => range.to.getTime())))
    };
}

function rowsInRange(
    rows: readonly TransactionDb[],
    range: StatsRange
): TransactionDb[] {
    return rows.filter(
        row => row.occurredAt >= range.from && row.occurredAt <= range.to
    );
}

export function dashboardStatsGroupBy(period: DashboardPeriod): StatsGroupBy {
    if (period === 'day') {
        return 'hour';
    }
    if (period === 'week') {
        return 'day';
    }
    if (period === 'year') {
        return 'month';
    }
    return 'week';
}

function dashboardTrendBucketCount(
    period: DashboardPeriod,
    range: StatsRange,
    timeZone: string
): number {
    if (period === 'day') {
        return 24;
    }
    if (period === 'week') {
        return 7;
    }
    if (period === 'month') {
        return Math.ceil(
            (localDayDifference(range.from, range.to, timeZone) + 1) / 7
        );
    }
    if (period === 'quarter') {
        return Math.ceil(
            (localDayDifference(range.from, range.to, timeZone) + 1) / 7
        );
    }
    return 12;
}

function dashboardTrendBucketIndex(
    period: DashboardPeriod,
    date: Date,
    range: StatsRange,
    timeZone: string
): number {
    if (period === 'day') {
        return localHour(date, timeZone);
    }
    if (period === 'week') {
        return localDayDifference(range.from, date, timeZone);
    }
    if (period === 'month') {
        return Math.floor(localDayDifference(range.from, date, timeZone) / 7);
    }
    if (period === 'quarter') {
        return Math.floor(localDayDifference(range.from, date, timeZone) / 7);
    }
    return localMonthIndex(date, timeZone);
}

export function resolveStatsRanges(
    query: Partial<StatsQuery>,
    now = new Date(),
    timeZone = defaultTimeZone
) {
    if (query.period) {
        const selected = resolveDashboardRange(
            query.period,
            query.date,
            now,
            timeZone
        );
        return {
            selected,
            previousPeriod: resolveDashboardComparisonRange(
                query.period,
                selected,
                timeZone
            ),
            previousYear: shiftRangeYears(selected, -1, timeZone)
        };
    }

    const timeframe = (query.timeframe ?? 'this-month') as StatsTimeframe;
    const today = localStartOfDay(now, timeZone);
    let selected: StatsRange;

    if (timeframe === 'this-week') {
        selected = { from: localStartOfWeek(now, timeZone), to: now };
    } else if (timeframe === 'last-7-days') {
        selected = { from: addLocalDays(today, -6, timeZone), to: now };
    } else if (timeframe === 'last-month') {
        const currentMonth = localStartOfMonth(now, timeZone);
        selected = {
            from: localStartOfMonth(
                addLocalMonths(currentMonth, -1, timeZone),
                timeZone
            ),
            to: new Date(currentMonth.getTime() - 1)
        };
    } else if (timeframe === 'last-30-days') {
        selected = { from: addLocalDays(today, -29, timeZone), to: now };
    } else if (timeframe === 'custom') {
        selected = normalizeRange(
            isValidDate(query.from)
                ? localStartOfDay(query.from, timeZone)
                : localStartOfMonth(now, timeZone),
            isValidDate(query.to) ? localEndOfDay(query.to, timeZone) : now,
            timeZone
        );
    } else {
        selected = { from: localStartOfMonth(now, timeZone), to: now };
    }

    let previousPeriod: StatsRange;
    if (timeframe === 'this-week') {
        previousPeriod = shiftRangeDays(selected, -7, timeZone);
    } else if (timeframe === 'this-month') {
        previousPeriod = shiftRangeMonths(selected, -1, timeZone);
    } else if (timeframe === 'last-month') {
        previousPeriod = previousCalendarMonthRange(selected, timeZone);
    } else if (timeframe === 'last-7-days') {
        previousPeriod = shiftRangeDays(selected, -7, timeZone);
    } else if (timeframe === 'last-30-days') {
        previousPeriod = shiftRangeDays(selected, -30, timeZone);
    } else {
        previousPeriod = previousRollingRange(selected);
    }

    return {
        selected,
        previousPeriod,
        previousYear: shiftRangeYears(selected, -1, timeZone)
    };
}

function statsTrendBuckets(
    groupBy: StatsGroupBy,
    range: StatsRange,
    timeZone: string
): Map<string, StatsBucket> {
    const buckets = new Map<string, StatsBucket>();
    let current =
        groupBy === 'hour'
            ? localStartOfHour(range.from, timeZone)
            : groupBy === 'week'
              ? localStartOfWeek(range.from, timeZone)
              : groupBy === 'month'
                ? localStartOfMonth(range.from, timeZone)
                : localStartOfDay(range.from, timeZone);

    while (current <= range.to) {
        const key = statsBucketKeyInTimeZone(current, groupBy, timeZone);
        buckets.set(key, {
            bucket: key,
            label: statsBucketLabelInTimeZone(current, groupBy, timeZone),
            incomeTotal: 0,
            expenseTotal: 0,
            netTotal: 0,
            transactionCount: 0
        });
        current = addStatsBucketStepInTimeZone(current, groupBy, timeZone);
    }

    return buckets;
}

function computeShare(total: number, basis: number): number {
    return basis > 0 ? (total / basis) * 100 : 0;
}

function topCategory(
    categories: readonly StatsCategory[],
    type: 'expense' | 'income'
): string {
    const category = categories
        .filter(candidate => candidate.type === type)
        .sort((left, right) => right.total - left.total)[0];
    return category && category.total > 0 ? category.categoryDisplayName : '';
}

function emptyStatsCategory(
    category: Pick<
        StatsCategory,
        | 'categoryDisplayName'
        | 'categoryId'
        | 'categoryKind'
        | 'categoryName'
        | 'categoryParentId'
        | 'categoryParentName'
        | 'type'
    >,
    bucketCount: number
): StatsCategory {
    return {
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        categoryDisplayName: category.categoryDisplayName,
        categoryParentId: category.categoryParentId,
        categoryParentName: category.categoryParentName,
        categoryKind: category.categoryKind,
        type: category.type,
        total: 0,
        share: 0,
        transactionCount: 0,
        trend: Array.from({ length: bucketCount }, () => 0),
        previousPeriodTotal: 0,
        previousYearTotal: 0
    };
}

function summarizeSelectedRows(
    rows: readonly TransactionDb[],
    groupBy: StatsGroupBy,
    buckets: Map<string, StatsBucket>,
    timeZone: string,
    categoriesById: ReadonlyMap<number, CategoryDb>
) {
    const bucketKeys = Array.from(buckets.keys());
    const bucketIndexes = new Map(
        bucketKeys.map((key, index) => [key, index] as const)
    );
    const categories = new Map<string, StatsCategory>();
    let incomeTotal = 0;
    let expenseTotal = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    for (const row of rows) {
        const rowCategory = categoryForTransaction(row, categoriesById);
        const total = transactionSignedDefaultAmount(row, rowCategory);
        const fields = categoryFields(rowCategory, row, categoriesById);
        const type = fields.type;
        const date = new Date(row.occurredAt);
        const bucket = buckets.get(
            statsBucketKeyInTimeZone(date, groupBy, timeZone)
        );

        if (type === 'income') {
            incomeTotal += total;
            incomeCount += 1;
            if (bucket) {
                bucket.incomeTotal += total;
            }
        } else {
            expenseTotal += total;
            expenseCount += 1;
            if (bucket) {
                bucket.expenseTotal += total;
            }
        }

        if (bucket) {
            bucket.transactionCount += 1;
        }

        const categoryKey = `${type}:${row.categoryId}`;
        const summaryCategory =
            categories.get(categoryKey) ??
            emptyStatsCategory(fields, bucketKeys.length);
        const bucketIndex = bucketIndexes.get(
            statsBucketKeyInTimeZone(date, groupBy, timeZone)
        );
        summaryCategory.total += total;
        summaryCategory.transactionCount += 1;
        if (bucketIndex !== undefined) {
            summaryCategory.trend[bucketIndex] =
                (summaryCategory.trend[bucketIndex] ?? 0) + total;
        }
        categories.set(categoryKey, summaryCategory);
    }

    for (const bucket of buckets.values()) {
        bucket.netTotal = bucket.incomeTotal - bucket.expenseTotal;
    }

    return {
        categories,
        incomeTotal,
        expenseTotal,
        incomeCount,
        expenseCount,
        transactionCount: rows.length,
        trend: Array.from(buckets.values())
    };
}

function summarizeComparisonRows(
    rows: readonly TransactionDb[],
    range: StatsRange,
    categoriesById: ReadonlyMap<number, CategoryDb>
) {
    const categories = new Map<string, CategoryComparison>();
    let incomeTotal = 0;
    let expenseTotal = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    for (const row of rows) {
        const category = categoryForTransaction(row, categoriesById);
        const total = transactionSignedDefaultAmount(row, category);
        const fields = categoryFields(category, row, categoriesById);
        const type = fields.type;

        if (type === 'income') {
            incomeTotal += total;
            incomeCount += 1;
        } else {
            expenseTotal += total;
            expenseCount += 1;
        }

        const categoryKey = `${type}:${row.categoryId}`;
        const summaryCategory = categories.get(categoryKey) ?? {
            ...fields,
            total: 0
        };
        categories.set(categoryKey, {
            ...summaryCategory,
            total: summaryCategory.total + total
        });
    }

    return {
        categories,
        summary: {
            from: range.from,
            to: range.to,
            incomeTotal,
            expenseTotal,
            netTotal: incomeTotal - expenseTotal,
            transactionCount: rows.length,
            incomeCount,
            expenseCount
        }
    };
}

function mergeComparisonCategoryTotals(
    selectedCategories: Map<string, StatsCategory>,
    comparisonCategories: Map<string, CategoryComparison>,
    field: 'previousPeriodTotal' | 'previousYearTotal',
    bucketCount: number
): void {
    for (const [key, comparison] of comparisonCategories) {
        const category =
            selectedCategories.get(key) ??
            emptyStatsCategory(comparison, bucketCount);
        category[field] = comparison.total;
        selectedCategories.set(key, category);
    }
}

function rollUpParentStatsCategories(
    categories: readonly StatsCategory[],
    bucketCount: number,
    categoriesById: ReadonlyMap<number, CategoryDb>,
    incomeTotal: number,
    expenseTotal: number
): StatsCategory[] {
    const rollups = new Map<string, StatsCategory>();

    for (const category of categories) {
        const parentFields = parentCategoryFields(category, categoriesById);
        const key = `${parentFields.type}:${parentFields.categoryId}`;
        const current =
            rollups.get(key) ?? emptyStatsCategory(parentFields, bucketCount);

        current.total += category.total;
        current.transactionCount += category.transactionCount;
        current.previousPeriodTotal += category.previousPeriodTotal;
        current.previousYearTotal += category.previousYearTotal;
        category.trend.forEach((value, index) => {
            current.trend[index] = (current.trend[index] ?? 0) + value;
        });
        rollups.set(key, current);
    }

    return Array.from(rollups.values())
        .map(category => ({
            ...category,
            share: computeShare(
                category.total,
                category.type === 'income' ? incomeTotal : expenseTotal
            )
        }))
        .sort(
            (left, right) =>
                Math.max(
                    right.total,
                    right.previousPeriodTotal,
                    right.previousYearTotal
                ) -
                    Math.max(
                        left.total,
                        left.previousPeriodTotal,
                        left.previousYearTotal
                    ) || left.categoryName.localeCompare(right.categoryName)
        );
}

function statsTagTrendBuckets(
    groupBy: StatsGroupBy,
    range: StatsRange,
    timeZone: string
): Map<string, StatsTagTrendBucket> {
    return new Map(
        Array.from(statsTrendBuckets(groupBy, range, timeZone).entries()).map(
            ([key, bucket]) => [
                key,
                {
                    bucket: bucket.bucket,
                    label: bucket.label,
                    expenseTotal: 0,
                    transactionCount: 0
                }
            ]
        )
    );
}

function statsTagTotalFromState(
    state: Omit<StatsTagTotal, 'averageExpense' | 'share'>,
    expenseTotal: number
): StatsTagTotal {
    return {
        ...state,
        share: computeShare(state.total, expenseTotal),
        averageExpense:
            state.transactionCount > 0
                ? state.total / state.transactionCount
                : 0
    };
}

function summarizeStatsTagDetail({
    categoriesById,
    groupBy,
    kind,
    range,
    rows,
    tagId,
    tagName,
    timeZone,
    totalExpense,
    vendorsById
}: {
    readonly categoriesById: ReadonlyMap<number, CategoryDb>;
    readonly groupBy: StatsGroupBy;
    readonly kind: StatsTagDetail['kind'];
    readonly range: StatsRange;
    readonly rows: readonly TransactionDb[];
    readonly tagId: number | null;
    readonly tagName: string;
    readonly timeZone: string;
    readonly totalExpense: number;
    readonly vendorsById: ReadonlyMap<number, VendorDb>;
}): StatsTagDetail {
    const trend = statsTagTrendBuckets(groupBy, range, timeZone);
    const bucketKeys = Array.from(trend.keys());
    const bucketIndexes = new Map(
        bucketKeys.map((key, index) => [key, index] as const)
    );
    const categories = new Map<string, StatsCategory>();
    const vendors = new Map<string, StatsTagVendor>();
    let total = 0;

    for (const row of rows) {
        const category = categoryForTransaction(row, categoriesById);
        const fields = categoryFields(category, row, categoriesById);
        if (fields.type !== 'expense') {
            continue;
        }

        const amount = transactionSignedDefaultAmount(row, category);
        total += amount;

        const bucketKey = statsBucketKeyInTimeZone(
            row.occurredAt,
            groupBy,
            timeZone
        );
        const bucket = trend.get(bucketKey);
        if (bucket) {
            bucket.expenseTotal += amount;
            bucket.transactionCount += 1;
        }

        const categoryKey = `${fields.type}:${fields.categoryId}`;
        const currentCategory =
            categories.get(categoryKey) ??
            emptyStatsCategory(fields, bucketKeys.length);
        const bucketIndex = bucketIndexes.get(bucketKey);
        currentCategory.total += amount;
        currentCategory.transactionCount += 1;
        if (bucketIndex !== undefined) {
            currentCategory.trend[bucketIndex] =
                (currentCategory.trend[bucketIndex] ?? 0) + amount;
        }
        categories.set(categoryKey, currentCategory);

        const rowVendorFields = dashboardVendorFields(row, vendorsById);
        if (rowVendorFields) {
            const vendorKey = String(rowVendorFields.vendorId ?? 'none');
            const currentVendor = vendors.get(vendorKey) ?? {
                ...rowVendorFields,
                total: 0,
                transactionCount: 0
            };
            currentVendor.total += amount;
            currentVendor.transactionCount += 1;
            vendors.set(vendorKey, currentVendor);
        }
    }

    const byCategory = Array.from(categories.values())
        .map(category => ({
            ...category,
            share: computeShare(category.total, total)
        }))
        .sort(
            (left, right) =>
                right.total - left.total ||
                left.categoryName.localeCompare(right.categoryName)
        );

    return {
        tagId,
        tagName,
        kind,
        total,
        share: computeShare(total, totalExpense),
        transactionCount: rows.length,
        averageExpense: rows.length > 0 ? total / rows.length : 0,
        trend: Array.from(trend.values()),
        byCategory,
        byParentCategory: rollUpParentStatsCategories(
            byCategory,
            bucketKeys.length,
            categoriesById,
            0,
            total
        ),
        topVendors: Array.from(vendors.values())
            .sort(
                (left, right) =>
                    right.total - left.total ||
                    left.vendorName.localeCompare(right.vendorName)
            )
            .slice(0, dashboardVendorLimit)
    };
}

function emptyDashboardCategory(
    category: Pick<
        DashboardCategory,
        | 'categoryDisplayName'
        | 'categoryId'
        | 'categoryKind'
        | 'categoryName'
        | 'categoryParentId'
        | 'categoryParentName'
        | 'type'
    >,
    bucketCount: number
): DashboardCategory {
    return {
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        categoryDisplayName: category.categoryDisplayName,
        categoryParentId: category.categoryParentId,
        categoryParentName: category.categoryParentName,
        categoryKind: category.categoryKind,
        type: category.type,
        total: 0,
        transactionCount: 0,
        previousPeriodTotal: 0,
        percentChange: 0,
        trend: Array.from({ length: bucketCount }, () => 0)
    };
}

function rollUpParentDashboardCategories(
    categories: readonly DashboardCategory[],
    bucketCount: number,
    categoriesById: ReadonlyMap<number, CategoryDb>
): DashboardCategory[] {
    const rollups = new Map<string, DashboardCategory>();

    for (const category of categories) {
        const parentFields = parentCategoryFields(category, categoriesById);
        const key = `${parentFields.type}:${parentFields.categoryId}`;
        const current =
            rollups.get(key) ??
            emptyDashboardCategory(parentFields, bucketCount);

        current.total += category.total;
        current.transactionCount += category.transactionCount;
        current.previousPeriodTotal += category.previousPeriodTotal;
        category.trend.forEach((value, index) => {
            current.trend[index] = (current.trend[index] ?? 0) + value;
        });
        rollups.set(key, current);
    }

    for (const category of rollups.values()) {
        category.percentChange = percentChange(
            category.total,
            category.previousPeriodTotal
        );
    }

    return Array.from(rollups.values()).sort(
        (left, right) =>
            right.total - left.total ||
            left.type.localeCompare(right.type) ||
            left.categoryName.localeCompare(right.categoryName)
    );
}

async function transactionsForRange(
    db: AppDb,
    budgetId: number,
    range: StatsRange
) {
    return (await db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.budgetId, budgetId)
        .whereBetween(
            transaction => transaction.occurredAt,
            [range.from, range.to]
        )) as TransactionDb[];
}

async function transactionsForCategory(
    db: AppDb,
    budgetId: number,
    categoryId: number
) {
    return (await db.transactions
        .where(transaction => transaction.budgetId, budgetId)
        .where(transaction => transaction.categoryId, categoryId)
        .orderBy(transaction => transaction.occurredAt, 'asc')
        .orderBy(transaction => transaction.id, 'asc')) as TransactionDb[];
}

export async function categoryTrend(
    db: AppDb,
    userId: number,
    categoryId: number,
    query: CategoryTrendQuery
): Promise<CategoryTrendResponse> {
    const [user, access] = await Promise.all([
        getUser(db, userId),
        resolveBudgetAccess(db, userId, query.budgetId)
    ]);
    const category = await getCategory(db, access.budget.id, categoryId);
    const [rows, categoriesById] = await Promise.all([
        transactionsForCategory(db, access.budget.id, category.id),
        loadCategoriesById(db, access.budget.id)
    ]);
    const range = resolveCategoryTrendRange(query, {
        categoryCreatedAt: category.createdAt,
        rows,
        timeZone: user.timezone
    });

    return summarizeCategoryTrendRows({
        category,
        categoriesById,
        currency: access.budget.defaultCurrency,
        groupBy: categoryTrendGroupBy(query.groupBy),
        range,
        rows,
        timeFrame: categoryTrendRange(query.range),
        timeZone: user.timezone
    });
}

export function summarizeDashboardRows(
    user: Pick<UserDb, 'defaultCurrency' | 'timezone'>,
    period: DashboardPeriod,
    range: StatsRange,
    rows: readonly TransactionDb[],
    previousRows: readonly TransactionDb[],
    categoriesById: ReadonlyMap<number, CategoryDb>,
    vendorsById: ReadonlyMap<number, VendorDb>,
    vendorLimit = dashboardVendorLimit,
    reportingAmounts?: DashboardReportingAmounts
): DashboardSummary {
    const bucketCount = dashboardTrendBucketCount(period, range, user.timezone);
    const totalsByCategory = new Map<string, DashboardCategory>();
    const totalsByVendor = new Map<string, DashboardVendor>();
    const totalsByCategoryVendor = new Map<string, DashboardCategoryVendor>();
    const previousCategoriesByKey = new Map<string, DashboardCategory>();
    const comparisonRange = resolveDashboardComparisonRange(
        period,
        range,
        user.timezone
    );
    let previousExpenseTotal = 0;
    let previousIncomeTotal = 0;

    for (const row of previousRows) {
        const category = categoryForTransaction(row, categoriesById);
        const fields = categoryFields(category, row, categoriesById);
        const key = `${fields.type}:${fields.categoryId}`;
        const total = dashboardTransactionAmount(
            row,
            reportingAmounts,
            category
        );
        const previousCategory =
            previousCategoriesByKey.get(key) ??
            emptyDashboardCategory(fields, bucketCount);
        previousCategory.previousPeriodTotal += total;
        previousCategoriesByKey.set(key, previousCategory);
        if (fields.type === 'income') {
            previousIncomeTotal += total;
        } else {
            previousExpenseTotal += total;
        }
    }

    for (const row of rows) {
        const category = categoryForTransaction(row, categoriesById);
        const fields = categoryFields(category, row, categoriesById);
        const key = `${fields.type}:${fields.categoryId}`;
        const current = totalsByCategory.get(key) ?? {
            ...fields,
            total: 0,
            transactionCount: 0,
            previousPeriodTotal: 0,
            percentChange: 0,
            trend: Array.from({ length: bucketCount }, () => 0)
        };
        const total = dashboardTransactionAmount(
            row,
            reportingAmounts,
            category
        );
        const bucketIndex = dashboardTrendBucketIndex(
            period,
            row.occurredAt,
            range,
            user.timezone
        );

        current.total += total;
        current.transactionCount += 1;
        if (bucketIndex >= 0 && bucketIndex < current.trend.length) {
            current.trend[bucketIndex] =
                (current.trend[bucketIndex] ?? 0) + total;
        }
        totalsByCategory.set(key, current);

        const rowVendorFields = dashboardVendorFields(row, vendorsById);
        if (!rowVendorFields) {
            continue;
        }

        const vendorKey = `${fields.type}:${rowVendorFields.vendorId ?? 'none'}`;
        const currentVendor = totalsByVendor.get(vendorKey) ?? {
            ...rowVendorFields,
            type: fields.type,
            total: 0,
            transactionCount: 0,
            trend: Array.from({ length: bucketCount }, () => 0)
        };
        currentVendor.total += total;
        currentVendor.transactionCount += 1;
        if (bucketIndex >= 0 && bucketIndex < currentVendor.trend.length) {
            currentVendor.trend[bucketIndex] =
                (currentVendor.trend[bucketIndex] ?? 0) + total;
        }
        totalsByVendor.set(vendorKey, currentVendor);

        const categoryVendorKey = `${key}:${
            rowVendorFields.vendorId ?? 'none'
        }`;
        const currentCategoryVendor =
            totalsByCategoryVendor.get(categoryVendorKey) ??
            ({
                ...fields,
                ...rowVendorFields,
                total: 0,
                transactionCount: 0,
                trend: Array.from({ length: bucketCount }, () => 0)
            } satisfies DashboardCategoryVendor);
        currentCategoryVendor.total += total;
        currentCategoryVendor.transactionCount += 1;
        if (
            bucketIndex >= 0 &&
            bucketIndex < currentCategoryVendor.trend.length
        ) {
            currentCategoryVendor.trend[bucketIndex] =
                (currentCategoryVendor.trend[bucketIndex] ?? 0) + total;
        }
        totalsByCategoryVendor.set(categoryVendorKey, currentCategoryVendor);
    }

    for (const [key, category] of totalsByCategory) {
        const previousTotal =
            previousCategoriesByKey.get(key)?.previousPeriodTotal ?? 0;
        category.previousPeriodTotal = previousTotal;
        category.percentChange = percentChange(category.total, previousTotal);
    }

    const categoriesForParentRollups = [
        ...totalsByCategory.values(),
        ...Array.from(previousCategoriesByKey.entries())
            .filter(([key]) => !totalsByCategory.has(key))
            .map(([, category]) => category)
    ];

    const byCategory = Array.from(totalsByCategory.values()).sort(
        (left, right) =>
            right.total - left.total ||
            left.type.localeCompare(right.type) ||
            left.categoryName.localeCompare(right.categoryName)
    );
    const byParentCategory = rollUpParentDashboardCategories(
        categoriesForParentRollups,
        bucketCount,
        categoriesById
    ).filter(category => category.transactionCount > 0);
    const topVendors = Array.from(totalsByVendor.values())
        .sort(
            (left, right) =>
                left.type.localeCompare(right.type) ||
                right.transactionCount - left.transactionCount ||
                right.total - left.total ||
                left.vendorName.localeCompare(right.vendorName)
        )
        .slice(0, Math.max(0, vendorLimit));
    const expenseTotal = byCategory
        .filter(item => item.type === 'expense')
        .reduce((sum, item) => sum + item.total, 0);
    const incomeTotal = byCategory
        .filter(item => item.type === 'income')
        .reduce((sum, item) => sum + item.total, 0);
    const categoryVendorBreakdown = Array.from(
        totalsByCategoryVendor.values()
    ).sort(
        (left, right) =>
            left.type.localeCompare(right.type) ||
            left.categoryDisplayName.localeCompare(right.categoryDisplayName) ||
            Math.abs(right.total) - Math.abs(left.total) ||
            left.vendorName.localeCompare(right.vendorName)
    );

    return {
        period,
        from: range.from,
        to: range.to,
        currency: reportingAmounts?.currency ?? user.defaultCurrency,
        expenseTotal,
        incomeTotal,
        comparison: {
            previousPeriod: {
                from: comparisonRange.from,
                to: comparisonRange.to,
                expenseTotal: previousExpenseTotal,
                incomeTotal: previousIncomeTotal,
                netTotal: previousIncomeTotal - previousExpenseTotal
            }
        },
        vendorCount: totalsByVendor.size,
        topVendors,
        categoryVendorBreakdown,
        byCategory,
        byParentCategory
    };
}

export async function dashboardSummary(
    db: AppDb,
    config: Config,
    userId: number,
    period: DashboardPeriod,
    date?: Date,
    vendorLimit = dashboardVendorLimit,
    currency?: string,
    budgetId?: number
): Promise<DashboardSummary> {
    const [user, access] = await Promise.all([
        getUser(db, userId),
        resolveBudgetAccess(db, userId, budgetId)
    ]);
    const reportUser = {
        ...user,
        defaultCurrency: access.budget.defaultCurrency
    };
    const range = resolveDashboardRange(
        period,
        date,
        new Date(),
        user.timezone
    );
    const comparisonRange = resolveDashboardComparisonRange(
        period,
        range,
        user.timezone
    );
    const [rows, previousRows, categoriesById, vendorsById] = await Promise.all(
        [
            transactionsForRange(db, access.budget.id, range),
            transactionsForRange(db, access.budget.id, comparisonRange),
            loadCategoriesById(db, access.budget.id),
            loadVendorsById(db, access.budget.id)
        ]
    );
    const reportingAmounts = await dashboardReportingAmounts(
        db,
        config,
        reportUser,
        [...rows, ...previousRows],
        currency
    );

    return summarizeDashboardRows(
        reportUser,
        period,
        range,
        rows,
        previousRows,
        categoriesById,
        vendorsById,
        vendorLimit,
        reportingAmounts
    );
}

export async function dashboardWindow(
    db: AppDb,
    config: Config,
    userId: number,
    query: PeriodWindowQuery
): Promise<DashboardWindowResponse> {
    const [user, access] = await Promise.all([
        getUser(db, userId),
        resolveBudgetAccess(db, userId, query.budgetId)
    ]);
    const reportUser = {
        ...user,
        defaultCurrency: access.budget.defaultCurrency
    };
    const now = new Date();
    const period = query.period ?? 'day';
    const dates = resolveDashboardPeriodWindow(
        period,
        query.date ?? now,
        now,
        user.timezone,
        query.before,
        query.after
    );
    const plans = dates.map(date => {
        const range = resolveDashboardRange(period, date, now, user.timezone);
        return {
            date: rangeKey(range, user.timezone),
            range,
            previousRange: resolveDashboardComparisonRange(
                period,
                range,
                user.timezone
            )
        };
    });
    const [allRows, categoriesById, vendorsById] = await Promise.all([
        transactionsForRange(
            db,
            access.budget.id,
            encompassingRange(
                plans.flatMap(plan => [plan.range, plan.previousRange])
            )
        ),
        loadCategoriesById(db, access.budget.id),
        loadVendorsById(db, access.budget.id)
    ]);
    const reportingAmounts = await dashboardReportingAmounts(
        db,
        config,
        reportUser,
        allRows,
        query.currency
    );

    return {
        items: plans.map(plan => ({
            date: plan.date,
            summary: summarizeDashboardRows(
                reportUser,
                period,
                plan.range,
                rowsInRange(allRows, plan.range),
                rowsInRange(allRows, plan.previousRange),
                categoriesById,
                vendorsById,
                query.vendorLimit ?? dashboardVendorLimit,
                reportingAmounts
            )
        }))
    };
}

function summarizeStatsRows(
    user: Pick<UserDb, 'defaultCurrency' | 'timezone'>,
    groupBy: StatsGroupBy,
    timeframe: StatsTimeframe,
    ranges: StatsRanges,
    selectedRows: readonly TransactionDb[],
    previousPeriodRows: readonly TransactionDb[],
    previousYearRows: readonly TransactionDb[],
    categoriesById: ReadonlyMap<number, CategoryDb>
): StatsOverview {
    const buckets = statsTrendBuckets(groupBy, ranges.selected, user.timezone);
    const selected = summarizeSelectedRows(
        selectedRows,
        groupBy,
        buckets,
        user.timezone,
        categoriesById
    );
    const previousPeriod = summarizeComparisonRows(
        previousPeriodRows,
        ranges.previousPeriod,
        categoriesById
    );
    const previousYear = summarizeComparisonRows(
        previousYearRows,
        ranges.previousYear,
        categoriesById
    );

    mergeComparisonCategoryTotals(
        selected.categories,
        previousPeriod.categories,
        'previousPeriodTotal',
        buckets.size
    );
    mergeComparisonCategoryTotals(
        selected.categories,
        previousYear.categories,
        'previousYearTotal',
        buckets.size
    );

    const byCategory = Array.from(selected.categories.values())
        .map(category => ({
            ...category,
            share: computeShare(
                category.total,
                category.type === 'income'
                    ? selected.incomeTotal
                    : selected.expenseTotal
            )
        }))
        .sort(
            (left, right) =>
                Math.max(
                    right.total,
                    right.previousPeriodTotal,
                    right.previousYearTotal
                ) -
                Math.max(
                    left.total,
                    left.previousPeriodTotal,
                    left.previousYearTotal
                )
        );
    const byParentCategory = rollUpParentStatsCategories(
        byCategory,
        buckets.size,
        categoriesById,
        selected.incomeTotal,
        selected.expenseTotal
    );
    const netTotal = selected.incomeTotal - selected.expenseTotal;

    return {
        groupBy,
        timeframe,
        from: ranges.selected.from,
        to: ranges.selected.to,
        currency: user.defaultCurrency,
        incomeTotal: selected.incomeTotal,
        expenseTotal: selected.expenseTotal,
        netTotal,
        savingsRate:
            selected.incomeTotal > 0
                ? (netTotal / selected.incomeTotal) * 100
                : 0,
        transactionCount: selected.transactionCount,
        incomeCount: selected.incomeCount,
        expenseCount: selected.expenseCount,
        averageIncome:
            selected.incomeCount > 0
                ? selected.incomeTotal / selected.incomeCount
                : 0,
        averageExpense:
            selected.expenseCount > 0
                ? selected.expenseTotal / selected.expenseCount
                : 0,
        largestIncomeCategory: topCategory(byCategory, 'income'),
        largestExpenseCategory: topCategory(byCategory, 'expense'),
        trend: selected.trend,
        byCategory,
        byParentCategory,
        comparison: {
            previousPeriod: previousPeriod.summary,
            previousYear: previousYear.summary
        }
    };
}

export async function statsOverview(
    db: AppDb,
    userId: number,
    query: StatsQuery
): Promise<StatsOverview> {
    const [user, access] = await Promise.all([
        getUser(db, userId),
        resolveBudgetAccess(db, userId, query.budgetId)
    ]);
    const reportUser = {
        ...user,
        defaultCurrency: access.budget.defaultCurrency
    };
    const groupBy = (query.groupBy ?? 'day') as StatsGroupBy;
    const timeframe = (
        query.period ? 'custom' : (query.timeframe ?? 'this-month')
    ) as StatsTimeframe;
    const ranges = resolveStatsRanges(
        { ...query, groupBy, timeframe },
        new Date(),
        user.timezone
    );
    const [selectedRows, previousPeriodRows, previousYearRows, categoriesById] =
        await Promise.all([
            transactionsForRange(db, access.budget.id, ranges.selected),
            transactionsForRange(db, access.budget.id, ranges.previousPeriod),
            transactionsForRange(db, access.budget.id, ranges.previousYear),
            loadCategoriesById(db, access.budget.id)
        ]);

    return summarizeStatsRows(
        reportUser,
        groupBy,
        timeframe,
        ranges,
        selectedRows,
        previousPeriodRows,
        previousYearRows,
        categoriesById
    );
}

async function transactionTagNameById(
    db: AppDb,
    budgetId: number,
    tagId: number
): Promise<string | undefined> {
    const row = (await db
        .knex('transaction_tags')
        .where('budget_id', budgetId)
        .where('id', tagId)
        .select({ name: 'name' })
        .first()) as { readonly name: string } | undefined;

    return row?.name;
}

export async function statsTagReport(
    db: AppDb,
    userId: number,
    query: StatsTagReportQuery
): Promise<StatsTagReport> {
    const [user, access] = await Promise.all([
        getUser(db, userId),
        resolveBudgetAccess(db, userId, query.budgetId)
    ]);
    const reportUser = {
        ...user,
        defaultCurrency: access.budget.defaultCurrency
    };
    const now = new Date();
    const period = query.period ?? 'day';
    const range = resolveDashboardRange(
        period,
        query.date ?? now,
        now,
        user.timezone
    );
    const [rows, categoriesById, vendorsById] = await Promise.all([
        transactionsForRange(db, access.budget.id, range),
        loadCategoriesById(db, access.budget.id),
        loadVendorsById(db, access.budget.id)
    ]);
    const tagsByTransaction = await transactionTagsByTransaction(
        db.knex,
        access.budget.id,
        rows.map(transaction => transaction.id)
    );
    const tagTotals = new Map<
        number,
        Omit<StatsTagTotal, 'averageExpense' | 'share'>
    >();
    const expenseRows: TransactionDb[] = [];
    const untaggedRows: TransactionDb[] = [];
    let expenseTotal = 0;
    let untaggedTotal = 0;

    for (const row of rows) {
        const category = categoryForTransaction(row, categoriesById);
        const fields = categoryFields(category, row, categoriesById);
        if (fields.type !== 'expense') {
            continue;
        }

        const amount = transactionSignedDefaultAmount(row, category);
        const tags = tagsByTransaction.get(row.id) ?? [];
        expenseRows.push(row);
        expenseTotal += amount;

        if (tags.length === 0) {
            untaggedRows.push(row);
            untaggedTotal += amount;
            continue;
        }

        for (const tag of tags) {
            const current = tagTotals.get(tag.id) ?? {
                tagId: tag.id,
                tagName: tag.name,
                kind: 'tag' as const,
                total: 0,
                transactionCount: 0
            };
            current.total += amount;
            current.transactionCount += 1;
            tagTotals.set(tag.id, current);
        }
    }

    const tags = Array.from(tagTotals.values()).map(tag =>
        statsTagTotalFromState(tag, expenseTotal)
    );
    if (untaggedRows.length > 0 || query.tag === 'untagged') {
        tags.push(
            statsTagTotalFromState(
                {
                    tagId: null,
                    tagName: 'Untagged',
                    kind: 'untagged',
                    total: untaggedTotal,
                    transactionCount: untaggedRows.length
                },
                expenseTotal
            )
        );
    }
    tags.sort(
        (left, right) =>
            right.total - left.total ||
            right.transactionCount - left.transactionCount ||
            left.tagName.localeCompare(right.tagName)
    );

    let selectedTag: StatsTagReport['selectedTag'] = null;
    if (query.tag === 'untagged') {
        selectedTag = summarizeStatsTagDetail({
            categoriesById,
            groupBy: dashboardStatsGroupBy(period),
            kind: 'untagged',
            range,
            rows: untaggedRows,
            tagId: null,
            tagName: 'Untagged',
            timeZone: user.timezone,
            totalExpense: expenseTotal,
            vendorsById
        });
    } else if (typeof query.tag === 'number') {
        const tagName =
            tagTotals.get(query.tag)?.tagName ??
            (await transactionTagNameById(db, access.budget.id, query.tag));
        if (tagName) {
            selectedTag = summarizeStatsTagDetail({
                categoriesById,
                groupBy: dashboardStatsGroupBy(period),
                kind: 'tag',
                range,
                rows: expenseRows.filter(row =>
                    (tagsByTransaction.get(row.id) ?? []).some(
                        tag => tag.id === query.tag
                    )
                ),
                tagId: query.tag,
                tagName,
                timeZone: user.timezone,
                totalExpense: expenseTotal,
                vendorsById
            });
        }
    }

    return {
        period,
        from: range.from,
        to: range.to,
        currency: reportUser.defaultCurrency,
        expenseTotal,
        expenseCount: expenseRows.length,
        untaggedCount: untaggedRows.length,
        tags,
        selectedTag
    };
}

export async function statsWindow(
    db: AppDb,
    userId: number,
    query: PeriodWindowQuery
): Promise<StatsWindowResponse> {
    const [user, access] = await Promise.all([
        getUser(db, userId),
        resolveBudgetAccess(db, userId, query.budgetId)
    ]);
    const reportUser = {
        ...user,
        defaultCurrency: access.budget.defaultCurrency
    };
    const now = new Date();
    const period = query.period ?? 'day';
    const groupBy = dashboardStatsGroupBy(period);
    const timeframe = 'custom';
    const dates = resolveDashboardPeriodWindow(
        period,
        query.date ?? now,
        now,
        user.timezone,
        query.before,
        query.after
    );
    const plans = dates.map(date => {
        const ranges = resolveStatsRanges(
            { date, groupBy, period, timeframe },
            now,
            user.timezone
        );
        return {
            date: rangeKey(ranges.selected, user.timezone),
            ranges
        };
    });
    const selectedRowsRange = encompassingRange(
        plans.flatMap(plan => [
            plan.ranges.selected,
            plan.ranges.previousPeriod
        ])
    );
    const previousYearRowsRange = encompassingRange(
        plans.map(plan => plan.ranges.previousYear)
    );
    const [selectedAndPreviousRows, previousYearRows, categoriesById] =
        await Promise.all([
            transactionsForRange(db, access.budget.id, selectedRowsRange),
            transactionsForRange(db, access.budget.id, previousYearRowsRange),
            loadCategoriesById(db, access.budget.id)
        ]);

    return {
        items: plans.map(plan => ({
            date: plan.date,
            overview: summarizeStatsRows(
                reportUser,
                groupBy,
                timeframe,
                plan.ranges,
                rowsInRange(selectedAndPreviousRows, plan.ranges.selected),
                rowsInRange(
                    selectedAndPreviousRows,
                    plan.ranges.previousPeriod
                ),
                rowsInRange(previousYearRows, plan.ranges.previousYear),
                categoriesById
            )
        }))
    };
}
