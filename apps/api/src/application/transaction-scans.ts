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
import { FieldLimits, TransactionScanLimits } from '@xpenser/contracts';
import {
    dateToLocalDateParam,
    localDateTimeInputToDate
} from '@xpenser/timezone';
import sharp from 'sharp';
import type { Config } from '../config.js';
import type {
    AppDb,
    TransactionScanDb,
    TransactionScanItemDb,
    UserDb
} from '../db/schemas.js';
import { listCategories } from './categories.js';
import { generateStructuredJsonFromContent } from './openai.js';
import { listTransactions } from './transactions.js';
import { listVendors } from './vendors.js';

export class TransactionScanInputError extends Error {}
export class TransactionScanNotFoundError extends Error {}

const maxImageBytes = TransactionScanLimits.maxImageBytes;
const maxDrafts = 25;
const maxContextVendors = 100;
const maxRecentTransactions = 100;
const maxCorrectionExamples = 10;
const visionLongSideLimit = 6000;
const extremeAspectRatio = 4;
const tileLongSide = 2400;
const tileOverlap = 160;
const maxVisionTiles = 8;

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
    readonly lineItemSubtotal?: unknown;
    readonly lineItems?: unknown;
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
    readonly visibleTotal?: unknown;
    readonly visibleTotalCurrency?: unknown;
    readonly warnings?: unknown;
};

type ScanImageInput = {
    readonly buffer: Buffer;
    readonly description: string;
    readonly height?: number;
    readonly mimeType: TransactionScanBody['mimeType'];
    readonly width?: number;
};

type PreparedScanImages = {
    readonly images: readonly ScanImageInput[];
    readonly promptContext: {
        readonly originalHeight?: number;
        readonly originalWidth?: number;
        readonly preprocessing: string;
        readonly tiles: readonly {
            readonly description: string;
            readonly height?: number;
            readonly width?: number;
        }[];
    };
    readonly warnings: readonly string[];
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

type ScanProgressStage = 'analyzing' | 'preparing' | 'saving';

type ScanProgressOptions = {
    readonly onProgress?: (stage: ScanProgressStage) => void;
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
        visibleTotal: { type: ['number', 'null'] },
        visibleTotalCurrency: { type: ['string', 'null'] },
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
                    lineItemSubtotal: { type: ['number', 'null'] },
                    lineItems: {
                        items: {
                            additionalProperties: false,
                            properties: {
                                amount: { type: ['number', 'null'] },
                                description: { type: 'string' },
                                quantity: { type: ['number', 'null'] }
                            },
                            required: ['amount', 'description', 'quantity'],
                            type: 'object'
                        },
                        type: 'array'
                    },
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
                    'lineItemSubtotal',
                    'lineItems',
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
    required: [
        'documentKind',
        'warnings',
        'visibleTotal',
        'visibleTotalCurrency',
        'transactions'
    ],
    type: 'object'
} as const;

function stripDataUrl(value: string): string {
    const commaIndex = value.indexOf(',');
    return value.startsWith('data:') && commaIndex >= 0
        ? value.slice(commaIndex + 1)
        : value;
}

function scanImageBuffer(imageBase64: string): Buffer {
    try {
        const buffer = Buffer.from(stripDataUrl(imageBase64), 'base64');
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

function imageBuffer(body: TransactionScanBody): Buffer {
    return scanImageBuffer(body.imageBase64);
}

function tileCount(length: number): number {
    if (length <= tileLongSide) {
        return 1;
    }
    return Math.ceil((length - tileOverlap) / (tileLongSide - tileOverlap));
}

function tileRanges(
    length: number
): Array<{ readonly start: number; readonly size: number }> {
    if (length <= tileLongSide) {
        return [{ start: 0, size: length }];
    }

    const ranges: Array<{ readonly start: number; readonly size: number }> = [];
    const step = tileLongSide - tileOverlap;
    for (let start = 0; start < length; start += step) {
        const size = Math.min(tileLongSide, length - start);
        const normalizedStart =
            size < tileLongSide ? Math.max(0, length - tileLongSide) : start;
        const normalizedSize = Math.min(tileLongSide, length - normalizedStart);
        if (
            ranges.some(
                range =>
                    range.start === normalizedStart &&
                    range.size === normalizedSize
            )
        ) {
            break;
        }
        ranges.push({ start: normalizedStart, size: normalizedSize });
        if (normalizedStart + normalizedSize >= length) {
            break;
        }
    }
    return ranges;
}

function resizedDimensions({
    height,
    width
}: {
    readonly height: number;
    readonly width: number;
}) {
    const longSide = Math.max(width, height);
    const maxLongSide =
        tileLongSide + (maxVisionTiles - 1) * (tileLongSide - tileOverlap);
    if (tileCount(longSide) <= maxVisionTiles) {
        return { height, width, resized: false };
    }

    const scale = maxLongSide / longSide;
    return {
        height: Math.max(1, Math.round(height * scale)),
        width: Math.max(1, Math.round(width * scale)),
        resized: true
    };
}

function originalImageInput(
    buffer: Buffer,
    mimeType: TransactionScanBody['mimeType'],
    width?: number,
    height?: number
): PreparedScanImages {
    return {
        images: [
            {
                buffer,
                description: 'original image',
                height,
                mimeType,
                width
            }
        ],
        promptContext: {
            originalHeight: height,
            originalWidth: width,
            preprocessing: 'The model received the original uploaded image.',
            tiles: [
                {
                    description: 'original image',
                    height,
                    width
                }
            ]
        },
        warnings: []
    };
}

function needsVisionTiling(width: number, height: number): boolean {
    const longSide = Math.max(width, height);
    const shortSide = Math.max(1, Math.min(width, height));
    return (
        longSide > visionLongSideLimit ||
        longSide / shortSide >= extremeAspectRatio
    );
}

export async function prepareScanImagesForVision(
    buffer: Buffer,
    mimeType: TransactionScanBody['mimeType']
): Promise<PreparedScanImages> {
    try {
        const metadata = await sharp(buffer).metadata();
        const oriented = metadata.autoOrient;
        const width = oriented?.width ?? metadata.width;
        const height = oriented?.height ?? metadata.height;
        if (!width || !height || !needsVisionTiling(width, height)) {
            return originalImageInput(buffer, mimeType, width, height);
        }

        const nextDimensions = resizedDimensions({ height, width });
        let normalizedPipeline = sharp(buffer).autoOrient();
        if (nextDimensions.resized) {
            normalizedPipeline = normalizedPipeline.resize({
                fit: 'fill',
                height: nextDimensions.height,
                width: nextDimensions.width
            });
        }
        const normalizedBuffer = await normalizedPipeline.toBuffer();

        const vertical = nextDimensions.height >= nextDimensions.width;
        const ranges = tileRanges(
            vertical ? nextDimensions.height : nextDimensions.width
        ).slice(0, maxVisionTiles);
        const images = await Promise.all(
            ranges.map(async (range, index): Promise<ScanImageInput> => {
                const extract = vertical
                    ? {
                          left: 0,
                          top: range.start,
                          width: nextDimensions.width,
                          height: range.size
                      }
                    : {
                          left: range.start,
                          top: 0,
                          width: range.size,
                          height: nextDimensions.height
                      };
                const tile = await sharp(normalizedBuffer)
                    .extract(extract)
                    .flatten({ background: '#ffffff' })
                    .jpeg({ quality: 92 })
                    .toBuffer();
                return {
                    buffer: tile,
                    description: `tile ${index + 1} of ${ranges.length}`,
                    height: extract.height,
                    mimeType: 'image/jpeg',
                    width: extract.width
                };
            })
        );
        const warning =
            `Long image was split into ${images.length} ordered tiles for better text reading.` +
            (nextDimensions.resized
                ? ' It was downscaled before tiling to stay within scan limits.'
                : '');

        return {
            images,
            promptContext: {
                originalHeight: height,
                originalWidth: width,
                preprocessing:
                    'The uploaded image was auto-oriented and split into ordered overlapping tiles. Read tiles in order and treat them as one continuous source.',
                tiles: images.map(image => ({
                    description: image.description,
                    height: image.height,
                    width: image.width
                }))
            },
            warnings: [warning]
        };
    } catch {
        return originalImageInput(buffer, mimeType);
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

function noteValue(
    value: unknown,
    maxLength = FieldLimits.transactionNote
): string | null {
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }

    const normalized = value
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map(line => line.replace(/[ \t]+/g, ' ').trim())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return normalized ? normalized.slice(0, maxLength).trimEnd() : null;
}

function lineItemNote(value: unknown): string | null {
    if (!Array.isArray(value)) {
        return null;
    }

    const lines = value
        .map(item => {
            if (typeof item !== 'object' || item === null) {
                return null;
            }
            const record = item as Record<string, unknown>;
            const description = stringValue(record.description, 120);
            if (!description) {
                return null;
            }
            const amount = numberValue(record.amount);
            const quantity = numberValue(record.quantity);
            const amountText =
                amount !== null && amount > 0 ? ` - ${amount.toFixed(2)}` : '';
            const quantityText =
                quantity !== null && quantity > 1 ? `${quantity} x ` : '';
            return `${quantityText}${description}${amountText}`;
        })
        .filter((item): item is string => item !== null);

    return noteValue(lines.join('\n'));
}

function scanImageContentPart(image: ScanImageInput) {
    return {
        type: 'input_image' as const,
        image_url: `data:${image.mimeType};base64,${image.buffer.toString(
            'base64'
        )}`,
        detail: 'original' as const
    };
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
    const categoryConfidence = confidence(fieldConfidence.category);
    const exactCategoryId =
        categoryId !== null && categoryConfidence !== 'low' ? categoryId : null;
    const draft = {
        amount: safeAmount,
        categoryId: exactCategoryId,
        suggestedCategory:
            exactCategoryId === null
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
        note: noteValue(raw.note) ?? lineItemNote(raw.lineItems),
        evidence: stringValue(raw.evidence, 500) ?? '',
        confidence: {
            amount: confidence(fieldConfidence.amount),
            category: categoryConfidence,
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
        'When one receipt or invoice is split, each draft amount must include only the line items assigned to that draft plus a proportional share of visible shared tax, fees, tips, and discounts.',
        'Rounded split drafts should add up to the visible document total when the total is visible. Assign any one-cent rounding remainder to the largest split group.',
        'Use multiline notes to list the line items included in each split draft, one item per line when possible.',
        'Do not split when category or vendor grouping is ambiguous; return a single transaction with an itemized note and lower confidence instead.',
        'Do not create transactions, categories, or vendors. Only choose existing IDs from context or suggest names for the user to create later.',
        'Prefer existing category IDs and vendor IDs only when they are a strong fit.',
        'When no existing category is a strong fit, set categoryId to null and fill suggestedCategoryName, suggestedCategoryType, suggestedCategoryKind, optional suggestedCategoryParentId, and suggestedCategoryReason.',
        'Use positive amounts only. Infer expense/income through transactionType and category fit; do not encode signs in amount.',
        'If a field is not visible or not reliable, return null for that field and low confidence.',
        'Use correction examples as user-specific preferences and avoid repeating prior mistakes.',
        'Use only facts visible in the image and the provided context. Do not invent vendors, dates, currencies, amounts, or line items.'
    ].join(' ');
}

function promptInput({
    categories,
    correctionExamples,
    imageProcessing,
    recentTransactions,
    user,
    vendors
}: {
    readonly categories: readonly Category[];
    readonly correctionExamples: readonly CorrectionExample[];
    readonly imageProcessing: PreparedScanImages['promptContext'];
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
        imageProcessing,
        outputRules: {
            occurredDate:
                'Use YYYY-MM-DD when visible or inferable from the document; otherwise null.',
            occurredTime: 'Use HH:mm when visible; otherwise null.',
            categoryId:
                'Use only IDs from categories when the match is strong; otherwise null and provide suggested category fields.',
            vendorId: 'Use only IDs from vendors.',
            suggestedCategoryParentId:
                'Use only a parent category ID from categories, or null.',
            lineItems:
                'For each draft, include only the visible line items that belong to that draft. Leave empty for bank statement/app transaction rows.',
            lineItemSubtotal:
                'Subtotal of line items before proportional shared tax, fees, tips, and discounts, or null when not visible.',
            visibleTotal:
                'Visible receipt/invoice total after tax, fees, tips, and discounts, or null when not visible.',
            splitTotals:
                'When splitting one receipt/invoice, allocate shared adjustments proportionally by line item subtotal and make split amounts sum to the visible total within one cent.',
            note: 'Use multiline notes for split drafts and list included line items. Do not include items assigned to another draft.',
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
    body: TransactionScanBody,
    options: ScanProgressOptions = {}
): Promise<TransactionScanResponse> {
    const buffer = imageBuffer(body);
    const imageHash = createHash('sha256').update(buffer).digest('hex');
    options.onProgress?.('preparing');
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
    const preparedImages = await prepareScanImagesForVision(
        buffer,
        body.mimeType
    );

    options.onProgress?.('analyzing');
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
                            imageProcessing: preparedImages.promptContext,
                            recentTransactions,
                            user,
                            vendors
                        })
                    )
                },
                ...preparedImages.images.map(scanImageContentPart)
            ],
            model: config.openai.transactionScanModel,
            schema: scanResultSchema,
            schemaName: 'transaction_image_scan',
            system: scanPrompt()
        }
    );

    options.onProgress?.('saving');
    const scanWarnings = [
        ...warnings(parsed.warnings),
        ...preparedImages.warnings
    ].slice(0, 8);
    const scan = await db.transactionScans.insert({
        userId,
        documentKind: documentKind(parsed.documentKind),
        imageHash,
        model: config.openai.transactionScanModel,
        warningsJson: JSON.stringify(scanWarnings)
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
        warnings: scanWarnings,
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

async function storeScanAttachment({
    attachment,
    db,
    scan,
    userId
}: {
    readonly attachment: NonNullable<TransactionScanDecisionBody['attachment']>;
    readonly db: AppDb;
    readonly scan: TransactionScanDb;
    readonly userId: number;
}): Promise<void> {
    const imageBase64 = stripDataUrl(attachment.imageBase64);
    const buffer = scanImageBuffer(imageBase64);
    const imageHash = createHash('sha256').update(buffer).digest('hex');
    if (imageHash !== scan.imageHash) {
        throw new TransactionScanInputError(
            'Confirmed scan image did not match the original scan.'
        );
    }

    const existing = await db.transactionScanImages
        .where(row => row.scanId, scan.id)
        .where(row => row.userId, userId)
        .first();
    const values = {
        imageHash,
        mimeType: attachment.mimeType,
        fileName: stringValue(attachment.fileName, 255) ?? null,
        sizeBytes: buffer.length,
        imageBase64,
        updatedAt: new Date()
    };

    if (existing) {
        await db.transactionScanImages
            .where(row => row.id, existing.id)
            .where(row => row.userId, userId)
            .update(values as never);
        return;
    }

    await db.transactionScanImages.insert({
        scanId: scan.id,
        userId,
        ...values
    } as never);
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
    const scan = await db.transactionScans
        .where(row => row.id, scanId)
        .where(row => row.userId, userId)
        .first();
    if (!scan) {
        throw new TransactionScanNotFoundError('Scan was not found.');
    }

    if (body.decision === 'confirmed') {
        if (!body.transactionId || !body.correctedTransaction) {
            throw new TransactionScanInputError(
                'Confirmed scan items require a transaction and corrected values.'
            );
        }
        await ensureTransactionOwner(db, userId, body.transactionId);
        if (body.attachment) {
            await storeScanAttachment({
                attachment: body.attachment,
                db,
                scan,
                userId
            });
        }
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
