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
    StatsWindowResponse,
    Transaction,
    TransactionListQuery,
    TransactionScanImageResponse
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
import { getVendor, VendorNotFoundError } from './vendors.js';

export class TransactionNotFoundError extends Error {}
export class TransactionCategoryError extends Error {}

type DashboardPeriod = NonNullable<DashboardSummary['period']>;

type DashboardCategory = DashboardSummary['byCategory'][number];

type DashboardVendor = DashboardSummary['topVendors'][number];
type DashboardCategoryVendor =
    DashboardSummary['categoryVendorBreakdown'][number];
type TransactionScanAttachment = NonNullable<Transaction['scanAttachment']>;
type TransactionScanAttachmentRow = {
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

type StatsBucket = StatsOverview['trend'][number];

type StatsCategory = StatsOverview['byCategory'][number];

type StatsGroupBy = NonNullable<StatsQuery['groupBy']>;

type StatsTimeframe = NonNullable<StatsQuery['timeframe']>;

type StatsRange = {
    readonly from: Date;
    readonly to: Date;
};

type CategoryTrendBucket = CategoryTrendResponse['trend'][number];

type StatsRanges = {
    readonly selected: StatsRange;
    readonly previousPeriod: StatsRange;
    readonly previousYear: StatsRange;
};

type PeriodWindowQuery = {
    readonly period?: DashboardPeriod;
    readonly date?: Date;
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

async function loadCategoriesById(
    db: AppDb,
    userId: number
): Promise<Map<number, CategoryDb>> {
    const categories = (await db.categories.where(
        category => category.userId,
        userId
    )) as CategoryDb[];

    return new Map(
        categories.map(category => [category.id, category] as const)
    );
}

async function loadVendorsById(
    db: AppDb,
    userId: number
): Promise<Map<number, VendorDb>> {
    const vendors = (await db.vendors.where(
        vendor => vendor.userId,
        userId
    )) as VendorDb[];

    return new Map(vendors.map(vendor => [vendor.id, vendor] as const));
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
    scanAttachments: ReadonlyMap<number, TransactionScanAttachment> = new Map()
): Transaction {
    const category = categoryForTransaction(row, categoriesById);
    const fields = categoryFields(category, row, categoriesById);
    const vendor = row.vendorId ? vendorsById.get(row.vendorId) : undefined;

    return {
        id: row.id,
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
        scanAttachment: scanAttachments.get(row.id) ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
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
    userId: number,
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
        .where('item.user_id', userId)
        .where('image.user_id', userId)
        .where('item.decision', 'confirmed')
        .whereIn('item.transaction_id', uniqueIds)
        .orderBy('item.decided_at', 'desc')
        .select({
            transactionId: 'item.transaction_id',
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
    userId: number,
    categoryId: number
): Promise<CategoryDb> {
    const category = await db.categories
        .where(candidate => candidate.id, categoryId)
        .where(candidate => candidate.userId, userId)
        .first();
    if (!category) {
        throw new TransactionCategoryError('Category was not found.');
    }
    return category as CategoryDb;
}

async function validateVendor(
    db: AppDb,
    userId: number,
    vendorId: number
): Promise<void> {
    try {
        await getVendor(db, userId, vendorId);
    } catch (err) {
        if (err instanceof VendorNotFoundError) {
            throw new TransactionCategoryError(err.message);
        }
        throw err;
    }
}

export async function listTransactions(
    db: AppDb,
    userId: number,
    query: TransactionListQuery,
    knex?: Knex
) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    let builder = db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.userId, userId);

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
        loadCategoriesById(db, userId),
        loadVendorsById(db, userId)
    ]);
    const sortedRows = [...rows].sort(
        direction === 'asc'
            ? compareTransactionsByOccurrenceAsc
            : compareTransactionsByOccurrenceDesc
    ) as TransactionDb[];

    const search = query.search?.trim().toLowerCase();
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
                transaction.note?.toLowerCase().includes(search)
            );
        });
    const offset = (page - 1) * limit;
    const pageRows = filtered.slice(offset, offset + limit) as TransactionDb[];
    const scanAttachments = await scanAttachmentsByTransaction(
        knex,
        userId,
        pageRows.map(transaction => transaction.id)
    );

    return {
        items: pageRows.map(transaction =>
            mapTransaction(
                transaction,
                categoriesById,
                vendorsById,
                scanAttachments
            )
        ),
        total: filtered.length,
        page,
        limit
    };
}

export async function createTransaction(
    db: AppDb,
    config: Config,
    userId: number,
    body: CreateTransactionBody
): Promise<Transaction> {
    const [user, categoriesById] = await Promise.all([
        getUser(db, userId),
        loadCategoriesById(db, userId)
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
        await validateVendor(db, userId, body.vendorId);
    }
    const date = transactionDate(body.occurredAt, user.timezone);
    const exchange = await getExchangeRate(
        db,
        config,
        body.currency,
        user.defaultCurrency,
        date
    );

    const created = await db.transactions.insert({
        userId,
        categoryId: body.categoryId,
        vendorId: body.vendorId ?? undefined,
        type: category.type,
        amount: body.amount,
        currency: body.currency,
        defaultCurrencyAmount: convertAmount(body.amount, exchange.rate),
        defaultCurrency: user.defaultCurrency,
        exchangeRate: exchange.rate,
        exchangeRateDate: exchange.rateDate,
        occurredAt: body.occurredAt,
        note: body.note ?? undefined
    });

    return getTransaction(db, userId, created.id);
}

export async function getTransaction(
    db: AppDb,
    userId: number,
    transactionId: number
): Promise<Transaction> {
    const [row, categoriesById, vendorsById] = await Promise.all([
        db.transactions
            .include(transaction => transaction.category)
            .where(transaction => transaction.id, transactionId)
            .where(transaction => transaction.userId, userId)
            .first(),
        loadCategoriesById(db, userId),
        loadVendorsById(db, userId)
    ]);
    if (!row) {
        throw new TransactionNotFoundError('Transaction was not found.');
    }
    return mapTransaction(row as TransactionDb, categoriesById, vendorsById);
}

export async function getTransactionScanImage(
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
        .where('item.user_id', userId)
        .where('image.user_id', userId)
        .where('item.transaction_id', transactionId)
        .where('item.decision', 'confirmed')
        .orderBy('item.decided_at', 'desc')
        .select({
            scanId: 'item.scan_id',
            scanItemId: 'item.id',
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
    const current = await getTransaction(db, userId, transactionId);
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
        getUser(db, userId),
        loadCategoriesById(db, userId)
    ]);
    const category = categoriesById.get(next.categoryId);
    if (!category) {
        throw new TransactionCategoryError('Category was not found.');
    }
    const categoryChanged =
        body.categoryId !== undefined && body.categoryId !== current.categoryId;
    if (
        categoryChanged &&
        !categoryAvailableForTransactions(category, categoriesById)
    ) {
        throw new TransactionCategoryError(
            'Archived categories cannot be used for new transactions.'
        );
    }
    if (next.vendorId !== undefined && next.vendorId !== null) {
        await validateVendor(db, userId, next.vendorId);
    }
    const exchange = await getExchangeRate(
        db,
        config,
        next.currency,
        user.defaultCurrency,
        transactionDate(next.occurredAt, user.timezone)
    );

    await db.transactions
        .where(transaction => transaction.id, transactionId)
        .where(transaction => transaction.userId, userId)
        .update({
            categoryId: next.categoryId,
            vendorId: (next.vendorId ?? null) as never,
            type: category.type,
            amount: next.amount,
            currency: next.currency,
            defaultCurrencyAmount: convertAmount(next.amount, exchange.rate),
            defaultCurrency: user.defaultCurrency,
            exchangeRate: exchange.rate,
            exchangeRateDate: exchange.rateDate,
            occurredAt: next.occurredAt,
            note: next.note ?? undefined,
            updatedAt: new Date()
        });

    return getTransaction(db, userId, transactionId);
}

export async function deleteTransaction(
    db: AppDb,
    userId: number,
    transactionId: number
): Promise<void> {
    const deleted = await db.transactions
        .where(transaction => transaction.id, transactionId)
        .where(transaction => transaction.userId, userId)
        .delete();
    if (deleted === 0) {
        throw new TransactionNotFoundError('Transaction was not found.');
    }
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
    userId: number,
    range: StatsRange
) {
    return (await db.transactions
        .include(transaction => transaction.category)
        .where(transaction => transaction.userId, userId)
        .whereBetween(
            transaction => transaction.occurredAt,
            [range.from, range.to]
        )) as TransactionDb[];
}

async function transactionsForCategory(
    db: AppDb,
    userId: number,
    categoryId: number
) {
    return (await db.transactions
        .where(transaction => transaction.userId, userId)
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
    const [user, category] = await Promise.all([
        getUser(db, userId),
        getCategory(db, userId, categoryId)
    ]);
    const [rows, categoriesById] = await Promise.all([
        transactionsForCategory(db, userId, category.id),
        loadCategoriesById(db, userId)
    ]);
    const range = resolveCategoryTrendRange(query, {
        categoryCreatedAt: category.createdAt,
        rows,
        timeZone: user.timezone
    });

    return summarizeCategoryTrendRows({
        category,
        categoriesById,
        currency: user.defaultCurrency,
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
    vendorLimit = dashboardVendorLimit
): DashboardSummary {
    const bucketCount = dashboardTrendBucketCount(period, range, user.timezone);
    const totalsByCategory = new Map<string, DashboardCategory>();
    const totalsByVendor = new Map<string, DashboardVendor>();
    const totalsByCategoryVendor = new Map<string, DashboardCategoryVendor>();
    const previousTotalsByCategory = new Map<string, number>();
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
        const total = transactionSignedDefaultAmount(row, category);
        previousTotalsByCategory.set(
            key,
            (previousTotalsByCategory.get(key) ?? 0) + total
        );
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
        const total = transactionSignedDefaultAmount(row, category);
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
        const previousTotal = previousTotalsByCategory.get(key) ?? 0;
        category.previousPeriodTotal = previousTotal;
        category.percentChange = percentChange(category.total, previousTotal);
    }

    const byCategory = Array.from(totalsByCategory.values()).sort(
        (left, right) =>
            right.total - left.total ||
            left.type.localeCompare(right.type) ||
            left.categoryName.localeCompare(right.categoryName)
    );
    const byParentCategory = rollUpParentDashboardCategories(
        byCategory,
        bucketCount,
        categoriesById
    );
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
        currency: user.defaultCurrency,
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
    userId: number,
    period: DashboardPeriod,
    date?: Date,
    vendorLimit = dashboardVendorLimit
): Promise<DashboardSummary> {
    const user = await getUser(db, userId);
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
            transactionsForRange(db, userId, range),
            transactionsForRange(db, userId, comparisonRange),
            loadCategoriesById(db, userId),
            loadVendorsById(db, userId)
        ]
    );

    return summarizeDashboardRows(
        user,
        period,
        range,
        rows,
        previousRows,
        categoriesById,
        vendorsById,
        vendorLimit
    );
}

export async function dashboardWindow(
    db: AppDb,
    userId: number,
    query: PeriodWindowQuery
): Promise<DashboardWindowResponse> {
    const user = await getUser(db, userId);
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
            userId,
            encompassingRange(
                plans.flatMap(plan => [plan.range, plan.previousRange])
            )
        ),
        loadCategoriesById(db, userId),
        loadVendorsById(db, userId)
    ]);

    return {
        items: plans.map(plan => ({
            date: plan.date,
            summary: summarizeDashboardRows(
                user,
                period,
                plan.range,
                rowsInRange(allRows, plan.range),
                rowsInRange(allRows, plan.previousRange),
                categoriesById,
                vendorsById,
                query.vendorLimit ?? dashboardVendorLimit
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
    const user = await getUser(db, userId);
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
            transactionsForRange(db, userId, ranges.selected),
            transactionsForRange(db, userId, ranges.previousPeriod),
            transactionsForRange(db, userId, ranges.previousYear),
            loadCategoriesById(db, userId)
        ]);

    return summarizeStatsRows(
        user,
        groupBy,
        timeframe,
        ranges,
        selectedRows,
        previousPeriodRows,
        previousYearRows,
        categoriesById
    );
}

export async function statsWindow(
    db: AppDb,
    userId: number,
    query: PeriodWindowQuery
): Promise<StatsWindowResponse> {
    const user = await getUser(db, userId);
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
            transactionsForRange(db, userId, selectedRowsRange),
            transactionsForRange(db, userId, previousYearRowsRange),
            loadCategoriesById(db, userId)
        ]);

    return {
        items: plans.map(plan => ({
            date: plan.date,
            overview: summarizeStatsRows(
                user,
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
