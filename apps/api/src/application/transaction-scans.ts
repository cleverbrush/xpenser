import { createHash } from 'node:crypto';
import type {
    Category,
    Transaction,
    TransactionScanBody,
    TransactionScanDecisionBody,
    TransactionScanDraft,
    TransactionScanResponse,
    Vendor
} from '@xpenser/contracts';
import { FieldLimits } from '@xpenser/contracts';
import {
    dateToLocalDateParam,
    localDateTimeInputToDate
} from '@xpenser/timezone';
import type { Config } from '../config.js';
import type { AppDb, TransactionScanItemDb, UserDb } from '../db/schemas.js';
import { listCategories } from './categories.js';
import { generateStructuredJsonFromContent } from './openai.js';
import { listTransactions } from './transactions.js';
import { listVendors } from './vendors.js';

export class TransactionScanInputError extends Error {}
export class TransactionScanNotFoundError extends Error {}

const maxImageBytes = 10 * 1024 * 1024;
const maxDrafts = 25;
const maxContextVendors = 100;
const maxRecentTransactions = 100;
const maxCorrectionExamples = 10;

const confidenceValues = new Set(['high', 'medium', 'low']);
const documentKinds = new Set([
    'bank_app',
    'bank_statement',
    'invoice',
    'receipt',
    'other'
]);

type Confidence = 'high' | 'low' | 'medium';
type TransactionType = 'expense' | 'income';

type RawFieldConfidence = {
    readonly amount?: unknown;
    readonly category?: unknown;
    readonly currency?: unknown;
    readonly date?: unknown;
    readonly overall?: unknown;
    readonly vendor?: unknown;
};

type RawScannedTransaction = {
    readonly amount?: unknown;
    readonly categoryId?: unknown;
    readonly confidence?: RawFieldConfidence;
    readonly currency?: unknown;
    readonly evidence?: unknown;
    readonly note?: unknown;
    readonly occurredDate?: unknown;
    readonly occurredTime?: unknown;
    readonly suggestedCategoryKind?: unknown;
    readonly suggestedCategoryName?: unknown;
    readonly suggestedCategoryParentId?: unknown;
    readonly suggestedCategoryReason?: unknown;
    readonly suggestedCategoryType?: unknown;
    readonly suggestedVendorName?: unknown;
    readonly transactionType?: unknown;
    readonly vendorId?: unknown;
};

type RawScanResult = {
    readonly documentKind?: unknown;
    readonly transactions?: unknown;
    readonly warnings?: unknown;
};

type PromptCategory = Pick<
    Category,
    'displayName' | 'id' | 'kind' | 'name' | 'parentId' | 'parentName' | 'type'
> & {
    readonly effectiveType: TransactionType;
};

type PromptVendor = Pick<
    Vendor,
    | 'displayName'
    | 'domain'
    | 'id'
    | 'name'
    | 'resolvedName'
    | 'suggestedCategoryDisplayName'
    | 'suggestedCategoryId'
    | 'transactionCount'
>;

type CorrectionExample = {
    readonly decision: string;
    readonly draft: unknown;
    readonly corrected: unknown;
};

type TransactionScanItemQuery = Promise<TransactionScanItemDb[]> & {
    readonly first: () => Promise<TransactionScanItemDb | undefined>;
    readonly update: (
        values: Partial<TransactionScanItemDb>
    ) => Promise<TransactionScanItemDb[]>;
    readonly where: <TValue>(
        selector: (row: TransactionScanItemDb) => TValue,
        value: TValue
    ) => TransactionScanItemQuery;
};

type TransactionScanItemTable = {
    readonly insert: (
        value: Pick<TransactionScanItemDb, 'draftJson' | 'scanId' | 'userId'>
    ) => Promise<TransactionScanItemDb>;
    readonly where: <TValue>(
        selector: (row: TransactionScanItemDb) => TValue,
        value: TValue
    ) => TransactionScanItemQuery;
};

function scanItemTable(db: AppDb): TransactionScanItemTable {
    return db.transactionScanItems as unknown as TransactionScanItemTable;
}

const scanResultSchema = {
    additionalProperties: false,
    properties: {
        documentKind: {
            enum: ['bank_app', 'bank_statement', 'invoice', 'receipt', 'other'],
            type: 'string'
        },
        warnings: {
            items: { type: 'string' },
            type: 'array'
        },
        transactions: {
            items: {
                additionalProperties: false,
                properties: {
                    amount: { type: ['number', 'null'] },
                    categoryId: { type: ['number', 'null'] },
                    confidence: {
                        additionalProperties: false,
                        properties: {
                            amount: {
                                enum: ['high', 'medium', 'low'],
                                type: 'string'
                            },
                            category: {
                                enum: ['high', 'medium', 'low'],
                                type: 'string'
                            },
                            currency: {
                                enum: ['high', 'medium', 'low'],
                                type: 'string'
                            },
                            date: {
                                enum: ['high', 'medium', 'low'],
                                type: 'string'
                            },
                            overall: {
                                enum: ['high', 'medium', 'low'],
                                type: 'string'
                            },
                            vendor: {
                                enum: ['high', 'medium', 'low'],
                                type: 'string'
                            }
                        },
                        required: [
                            'amount',
                            'category',
                            'currency',
                            'date',
                            'overall',
                            'vendor'
                        ],
                        type: 'object'
                    },
                    currency: { type: ['string', 'null'] },
                    evidence: { type: 'string' },
                    note: { type: ['string', 'null'] },
                    occurredDate: { type: ['string', 'null'] },
                    occurredTime: { type: ['string', 'null'] },
                    suggestedCategoryKind: {
                        enum: ['normal', 'offset', null]
                    },
                    suggestedCategoryName: { type: ['string', 'null'] },
                    suggestedCategoryParentId: { type: ['number', 'null'] },
                    suggestedCategoryReason: { type: ['string', 'null'] },
                    suggestedCategoryType: {
                        enum: ['expense', 'income', null]
                    },
                    suggestedVendorName: { type: ['string', 'null'] },
                    transactionType: {
                        enum: ['expense', 'income']
                    },
                    vendorId: { type: ['number', 'null'] }
                },
                required: [
                    'amount',
                    'categoryId',
                    'confidence',
                    'currency',
                    'evidence',
                    'note',
                    'occurredDate',
                    'occurredTime',
                    'suggestedCategoryKind',
                    'suggestedCategoryName',
                    'suggestedCategoryParentId',
                    'suggestedCategoryReason',
                    'suggestedCategoryType',
                    'suggestedVendorName',
                    'transactionType',
                    'vendorId'
                ],
                type: 'object'
            },
            type: 'array'
        }
    },
    required: ['documentKind', 'warnings', 'transactions'],
    type: 'object'
} as const;

function stripDataUrl(value: string): string {
    const commaIndex = value.indexOf(',');
    return value.startsWith('data:') && commaIndex >= 0
        ? value.slice(commaIndex + 1)
        : value;
}

function imageBuffer(body: TransactionScanBody): Buffer {
    try {
        const buffer = Buffer.from(stripDataUrl(body.imageBase64), 'base64');
        if (buffer.length === 0) {
            throw new TransactionScanInputError('Upload a non-empty image.');
        }
        if (buffer.length > maxImageBytes) {
            throw new TransactionScanInputError(
                'Image must be 10 MB or smaller.'
            );
        }
        return buffer;
    } catch (err) {
        if (err instanceof TransactionScanInputError) {
            throw err;
        }
        throw new TransactionScanInputError('Upload a valid image.');
    }
}

function oneLine(value: string, maxLength: number): string {
    return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function stringValue(value: unknown, maxLength = 200): string | null {
    return typeof value === 'string' && value.trim()
        ? oneLine(value, maxLength)
        : null;
}

function numberValue(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return null;
    }
    return value;
}

function idValue(
    value: unknown,
    allowedIds: ReadonlySet<number>
): number | null {
    const id = numberValue(value);
    return id !== null && allowedIds.has(id) ? id : null;
}

function confidence(value: unknown): Confidence {
    return typeof value === 'string' && confidenceValues.has(value)
        ? (value as Confidence)
        : 'low';
}

function effectiveCategoryType(category: Pick<Category, 'kind' | 'type'>) {
    if (category.kind !== 'offset') {
        return category.type;
    }
    return category.type === 'expense' ? 'income' : 'expense';
}

function categoryById(
    categories: readonly Category[],
    categoryId: number | null
): Category | undefined {
    return categoryId === null
        ? undefined
        : categories.find(category => category.id === categoryId);
}

function transactionType(
    value: unknown,
    category: Category | undefined
): TransactionType {
    if (category) {
        return effectiveCategoryType(category);
    }
    return value === 'income' ? 'income' : 'expense';
}

function currencyValue(value: unknown, fallback: string): string {
    const currency = stringValue(value, 3)?.toUpperCase();
    return currency && /^[A-Z]{3}$/.test(currency) ? currency : fallback;
}

function dateValue(
    rawDate: unknown,
    rawTime: unknown,
    timezone: string
): Date | null {
    const date = stringValue(rawDate, 10);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return null;
    }
    const time = stringValue(rawTime, 5);
    const localTime = time && /^\d{2}:\d{2}$/.test(time) ? time : '12:00';
    return localDateTimeInputToDate(`${date}T${localTime}`, timezone) ?? null;
}

function suggestedCategory(
    raw: RawScannedTransaction,
    type: TransactionType,
    categories: readonly Category[]
): TransactionScanDraft['suggestedCategory'] {
    const name = stringValue(
        raw.suggestedCategoryName,
        FieldLimits.categoryName
    );
    if (!name) {
        return null;
    }
    const suggestedType =
        raw.suggestedCategoryType === 'income' ||
        raw.suggestedCategoryType === 'expense'
            ? raw.suggestedCategoryType
            : type;
    const parentId = idValue(
        raw.suggestedCategoryParentId,
        new Set(
            categories
                .filter(
                    category =>
                        category.parentId === null &&
                        category.type === suggestedType
                )
                .map(category => category.id)
        )
    );

    return {
        name,
        type: suggestedType,
        parentId,
        kind:
            parentId !== null && raw.suggestedCategoryKind === 'offset'
                ? 'offset'
                : 'normal',
        reason:
            stringValue(raw.suggestedCategoryReason, 160) ??
            'No existing category looked like a strong fit.'
    };
}

function possibleDuplicates({
    categories,
    draft,
    recentTransactions,
    timezone
}: {
    readonly categories: readonly Category[];
    readonly draft: Omit<TransactionScanDraft, 'id'>;
    readonly recentTransactions: readonly Transaction[];
    readonly timezone: string;
}): number[] {
    if (!draft.amount || !draft.currency || !draft.occurredAt) {
        return [];
    }

    const draftDate = dateToLocalDateParam(draft.occurredAt, timezone);
    const category = categoryById(categories, draft.categoryId);
    const type = category
        ? effectiveCategoryType(category)
        : draft.transactionType;

    return recentTransactions
        .filter(transaction => {
            if (Math.abs(transaction.amount - draft.amount!) > 0.005) {
                return false;
            }
            if (transaction.currency !== draft.currency) {
                return false;
            }
            if (
                dateToLocalDateParam(transaction.occurredAt, timezone) !==
                draftDate
            ) {
                return false;
            }
            if (transaction.type !== type) {
                return false;
            }
            if (
                draft.vendorId !== null &&
                transaction.vendorId !== draft.vendorId
            ) {
                return false;
            }
            return true;
        })
        .slice(0, 3)
        .map(transaction => transaction.id);
}

function sanitizeDraft({
    categories,
    defaultCurrency,
    raw,
    recentTransactions,
    timezone,
    vendors
}: {
    readonly categories: readonly Category[];
    readonly defaultCurrency: string;
    readonly raw: RawScannedTransaction;
    readonly recentTransactions: readonly Transaction[];
    readonly timezone: string;
    readonly vendors: readonly Vendor[];
}): Omit<TransactionScanDraft, 'id'> | undefined {
    const categoryIds = new Set(categories.map(category => category.id));
    const vendorIds = new Set(vendors.map(vendor => vendor.id));
    const categoryId = idValue(raw.categoryId, categoryIds);
    const vendorId = idValue(raw.vendorId, vendorIds);
    const category = categoryById(categories, categoryId);
    const type = transactionType(raw.transactionType, category);
    const amount = numberValue(raw.amount);
    const safeAmount = amount !== null && amount > 0 ? amount : null;
    const fieldConfidence = raw.confidence ?? {};
    const draft = {
        amount: safeAmount,
        categoryId,
        suggestedCategory:
            categoryId === null
                ? suggestedCategory(raw, type, categories)
                : null,
        currency: currencyValue(raw.currency, defaultCurrency),
        occurredAt: dateValue(raw.occurredDate, raw.occurredTime, timezone),
        vendorId,
        suggestedVendorName:
            vendorId === null
                ? stringValue(raw.suggestedVendorName, FieldLimits.vendorName)
                : null,
        transactionType: type,
        note: stringValue(raw.note, FieldLimits.transactionNote),
        evidence: stringValue(raw.evidence, 500) ?? '',
        confidence: {
            amount: confidence(fieldConfidence.amount),
            category: confidence(fieldConfidence.category),
            currency: raw.currency
                ? confidence(fieldConfidence.currency)
                : 'low',
            date: raw.occurredDate ? confidence(fieldConfidence.date) : 'low',
            overall: confidence(fieldConfidence.overall),
            vendor: confidence(fieldConfidence.vendor)
        },
        possibleDuplicateTransactionIds: []
    } satisfies Omit<TransactionScanDraft, 'id'>;

    if (!draft.evidence && !draft.amount && !draft.note) {
        return undefined;
    }

    return {
        ...draft,
        possibleDuplicateTransactionIds: possibleDuplicates({
            categories,
            draft,
            recentTransactions,
            timezone
        })
    };
}

function parseJson(value: string): unknown {
    try {
        return JSON.parse(value) as unknown;
    } catch {
        return null;
    }
}

async function getUser(db: AppDb, userId: number): Promise<UserDb> {
    const user = await db.users.find(userId);
    if (!user) {
        throw new TransactionScanInputError('User was not found.');
    }
    return user as UserDb;
}

async function correctionExamples(
    db: AppDb,
    userId: number
): Promise<CorrectionExample[]> {
    const rows = await scanItemTable(db).where(item => item.userId, userId);

    return rows
        .filter(row => row.decision)
        .sort(
            (left, right) =>
                (right.decidedAt?.getTime() ?? 0) -
                (left.decidedAt?.getTime() ?? 0)
        )
        .slice(0, maxCorrectionExamples)
        .map(row => ({
            decision: row.decision ?? '',
            draft: parseJson(row.draftJson),
            corrected: row.correctedJson ? parseJson(row.correctedJson) : null
        }));
}

function promptCategories(categories: readonly Category[]): PromptCategory[] {
    return categories.map(category => ({
        id: category.id,
        name: category.name,
        displayName: category.displayName,
        parentId: category.parentId,
        parentName: category.parentName,
        type: category.type,
        kind: category.kind,
        effectiveType: effectiveCategoryType(category)
    }));
}

function promptVendors(vendors: readonly Vendor[]): PromptVendor[] {
    return vendors.map(vendor => ({
        id: vendor.id,
        name: vendor.name,
        displayName: vendor.displayName,
        resolvedName: vendor.resolvedName,
        domain: vendor.domain,
        suggestedCategoryId: vendor.suggestedCategoryId,
        suggestedCategoryDisplayName: vendor.suggestedCategoryDisplayName,
        transactionCount: vendor.transactionCount
    }));
}

function promptTransactions(
    transactions: readonly Transaction[],
    timezone: string
) {
    return transactions.map(transaction => ({
        id: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
        localDate: dateToLocalDateParam(transaction.occurredAt, timezone),
        type: transaction.type,
        categoryId: transaction.categoryId,
        category: transaction.categoryDisplayName,
        vendorId: transaction.vendorId,
        vendorName: transaction.vendorName,
        note: transaction.note
    }));
}

function scanPrompt() {
    return [
        'You extract draft personal-finance transactions from one uploaded image.',
        'The image may be a receipt, invoice, bank app screenshot, or bank statement.',
        'Return one or more transactions. Split one receipt into multiple transactions when visible line items clearly belong to different categories or vendors.',
        'Do not create transactions, categories, or vendors. Only choose existing IDs from context or suggest names for the user to create later.',
        'Prefer existing category IDs and vendor IDs when they are plausible. Suggest a new category or vendor only when no existing record is a good fit.',
        'Use positive amounts only. Infer expense/income through transactionType and category fit; do not encode signs in amount.',
        'If a field is not visible or not reliable, return null for that field and low confidence.',
        'Use correction examples as user-specific preferences and avoid repeating prior mistakes.',
        'Use only facts visible in the image and the provided context. Do not invent vendors, dates, currencies, amounts, or line items.'
    ].join(' ');
}

function promptInput({
    categories,
    correctionExamples,
    recentTransactions,
    user,
    vendors
}: {
    readonly categories: readonly Category[];
    readonly correctionExamples: readonly CorrectionExample[];
    readonly recentTransactions: readonly Transaction[];
    readonly user: UserDb;
    readonly vendors: readonly Vendor[];
}) {
    return {
        user: {
            defaultCurrency: user.defaultCurrency,
            timezone: user.timezone,
            localToday: dateToLocalDateParam(new Date(), user.timezone)
        },
        categories: promptCategories(categories),
        vendors: promptVendors(vendors),
        recentTransactions: promptTransactions(
            recentTransactions,
            user.timezone
        ),
        correctionExamples,
        outputRules: {
            occurredDate:
                'Use YYYY-MM-DD when visible or inferable from the document; otherwise null.',
            occurredTime: 'Use HH:mm when visible; otherwise null.',
            categoryId: 'Use only IDs from categories.',
            vendorId: 'Use only IDs from vendors.',
            suggestedCategoryParentId:
                'Use only a parent category ID from categories, or null.',
            maxTransactions: maxDrafts
        }
    };
}

function documentKind(value: unknown): TransactionScanResponse['documentKind'] {
    return typeof value === 'string' && documentKinds.has(value)
        ? (value as TransactionScanResponse['documentKind'])
        : 'other';
}

function warnings(value: unknown): string[] {
    return Array.isArray(value)
        ? value
              .map(item => stringValue(item, 200))
              .filter((item): item is string => item !== null)
              .slice(0, 8)
        : [];
}

export async function scanTransactionsFromImage(
    db: AppDb,
    config: Config,
    userId: number,
    body: TransactionScanBody
): Promise<TransactionScanResponse> {
    const buffer = imageBuffer(body);
    const imageHash = createHash('sha256').update(buffer).digest('hex');
    const user = await getUser(db, userId);
    const [categories, vendors, recentTransactions, examples] =
        await Promise.all([
            listCategories(db, userId, { activeOnly: true }),
            listVendors(db, userId, { limit: maxContextVendors }),
            listTransactions(db, userId, {
                direction: 'desc',
                limit: maxRecentTransactions,
                page: 1
            }).then(response => response.items),
            correctionExamples(db, userId)
        ]);

    const parsed = await generateStructuredJsonFromContent<RawScanResult>(
        config,
        {
            content: [
                {
                    type: 'input_text',
                    text: JSON.stringify(
                        promptInput({
                            categories,
                            correctionExamples: examples,
                            recentTransactions,
                            user,
                            vendors
                        })
                    )
                },
                {
                    type: 'input_image',
                    image_url: `data:${body.mimeType};base64,${stripDataUrl(
                        body.imageBase64
                    )}`,
                    detail: 'original'
                }
            ],
            model: config.openai.transactionScanModel,
            schema: scanResultSchema,
            schemaName: 'transaction_image_scan',
            system: scanPrompt()
        }
    );

    const scan = await db.transactionScans.insert({
        userId,
        documentKind: documentKind(parsed.documentKind),
        imageHash,
        model: config.openai.transactionScanModel,
        warningsJson: JSON.stringify(warnings(parsed.warnings))
    });

    const rawTransactions = Array.isArray(parsed.transactions)
        ? (parsed.transactions as RawScannedTransaction[])
        : [];
    const drafts: TransactionScanDraft[] = [];

    for (const raw of rawTransactions.slice(0, maxDrafts)) {
        const sanitized = sanitizeDraft({
            categories,
            defaultCurrency: user.defaultCurrency,
            raw,
            recentTransactions,
            timezone: user.timezone,
            vendors
        });
        if (!sanitized) {
            continue;
        }

        const item = await scanItemTable(db).insert({
            scanId: scan.id,
            userId,
            draftJson: JSON.stringify(sanitized)
        });
        drafts.push({ ...sanitized, id: item.id });
    }

    return {
        scanId: scan.id,
        documentKind: documentKind(parsed.documentKind),
        warnings: warnings(parsed.warnings),
        drafts
    };
}

async function ensureTransactionOwner(
    db: AppDb,
    userId: number,
    transactionId: number
): Promise<void> {
    const transaction = await db.transactions
        .where(row => row.id, transactionId)
        .where(row => row.userId, userId)
        .first();
    if (!transaction) {
        throw new TransactionScanInputError('Transaction was not found.');
    }
}

export async function recordTransactionScanDecision(
    db: AppDb,
    userId: number,
    scanId: number,
    itemId: number,
    body: TransactionScanDecisionBody
): Promise<void> {
    const item = await scanItemTable(db)
        .where(row => row.id, itemId)
        .where(row => row.scanId, scanId)
        .where(row => row.userId, userId)
        .first();
    if (!item) {
        throw new TransactionScanNotFoundError('Scan item was not found.');
    }

    if (body.decision === 'confirmed') {
        if (!body.transactionId || !body.correctedTransaction) {
            throw new TransactionScanInputError(
                'Confirmed scan items require a transaction and corrected values.'
            );
        }
        await ensureTransactionOwner(db, userId, body.transactionId);
    }

    await scanItemTable(db)
        .where(row => row.id, itemId)
        .where(row => row.userId, userId)
        .update({
            decision: body.decision,
            correctedJson: body.correctedTransaction
                ? JSON.stringify(body.correctedTransaction)
                : (null as never),
            transactionId: (body.transactionId ?? null) as never,
            createdCategoryId: (body.createdCategoryId ?? null) as never,
            createdVendorId: (body.createdVendorId ?? null) as never,
            decidedAt: new Date(),
            updatedAt: new Date()
        });
}
