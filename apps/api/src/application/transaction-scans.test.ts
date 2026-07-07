import type {
    Category,
    Transaction,
    TransactionScanDecisionBody,
    Vendor
} from '@xpenser/contracts';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config.js';
import type {
    AppDb,
    TransactionDb,
    TransactionScanDb,
    TransactionScanImageDb,
    TransactionScanItemDb,
    UserDb
} from '../db/schemas.js';
import {
    prepareScanImagesForVision,
    recordTransactionScanDecision,
    scanTransactionsFromImage
} from './transaction-scans.js';

const mocks = vi.hoisted(() => ({
    generateStructuredJsonFromContent: vi.fn(),
    listCategories: vi.fn(),
    listTransactions: vi.fn(),
    listVendors: vi.fn()
}));

vi.mock('./categories.js', () => ({
    listCategories: mocks.listCategories
}));

vi.mock('./openai.js', () => ({
    generateStructuredJsonFromContent: mocks.generateStructuredJsonFromContent
}));

vi.mock('./transactions.js', () => ({
    listTransactions: mocks.listTransactions
}));

vi.mock('./vendors.js', () => ({
    listVendors: mocks.listVendors
}));

const timestamp = new Date('2026-06-01T12:00:00.000Z');

type TestQuery<T extends object> = Promise<T[]> & {
    first: () => Promise<T | undefined>;
    update: (values: Partial<T>) => Promise<T[]>;
    where: <TValue>(
        selector: (row: T) => TValue,
        value: TValue
    ) => TestQuery<T>;
};

function testQuery<T extends object>(rows: T[]): TestQuery<T> {
    const query = Promise.resolve(rows) as TestQuery<T>;
    query.where = <TValue>(selector: (row: T) => TValue, value: TValue) =>
        testQuery(rows.filter(row => selector(row) === value));
    query.first = async () => rows[0];
    query.update = async (values: Partial<T>) => {
        for (const row of rows) {
            Object.assign(row, values);
        }
        return rows;
    };
    return query;
}

function user(overrides: Partial<UserDb> = {}): UserDb {
    return {
        id: 1,
        email: 'jane@example.com',
        emailVerified: true,
        role: 'user',
        authProvider: 'local',
        defaultCurrency: 'USD',
        countryCode: 'US',
        timezone: 'UTC',
        mainBudgetId: 1,
        weeklyEmailReportEnabled: true,
        monthlyEmailReportEnabled: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function category(overrides: Partial<Category> = {}): Category {
    return {
        id: 7,
        budgetId: 1,
        name: 'Groceries',
        type: 'expense',
        kind: 'normal',
        parentId: null,
        displayName: 'Groceries',
        inUse: true,
        hasChildren: false,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function vendor(overrides: Partial<Vendor> = {}): Vendor {
    return {
        id: 5,
        budgetId: 1,
        name: 'Walmart',
        displayName: 'Walmart',
        domain: 'walmart.com',
        transactionCount: 3,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
    return {
        id: 99,
        budgetId: 1,
        categoryId: 7,
        vendorId: 5,
        vendorName: 'Walmart',
        categoryName: 'Groceries',
        categoryDisplayName: 'Groceries',
        categoryParentId: null,
        categoryKind: 'normal',
        type: 'expense',
        amount: 12.34,
        currency: 'USD',
        defaultCurrencyAmount: 12.34,
        defaultCurrency: 'USD',
        exchangeRate: 1,
        exchangeRateDate: '2026-06-01',
        occurredAt: timestamp,
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function transactionRow(overrides: Partial<TransactionDb> = {}): TransactionDb {
    return {
        id: 99,
        userId: 1,
        budgetId: 1,
        categoryId: 7,
        vendorId: 5,
        type: 'expense',
        amount: 12.34,
        currency: 'USD',
        defaultCurrencyAmount: 12.34,
        defaultCurrency: 'USD',
        exchangeRate: 1,
        exchangeRateDate: '2026-06-01',
        occurredAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function scanItem(
    overrides: Partial<TransactionScanItemDb> = {}
): TransactionScanItemDb {
    return {
        id: 20,
        scanId: 10,
        userId: 1,
        budgetId: 1,
        draftJson: '{}',
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function scan(overrides: Partial<TransactionScanDb> = {}): TransactionScanDb {
    return {
        id: 10,
        userId: 1,
        budgetId: 1,
        documentKind: 'receipt',
        imageHash:
            '6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d',
        model: 'gpt-5.5',
        warningsJson: '[]',
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function scanImage(
    overrides: Partial<TransactionScanImageDb> = {}
): TransactionScanImageDb {
    return {
        id: 30,
        scanId: 10,
        userId: 1,
        budgetId: 1,
        imageHash:
            '6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d',
        mimeType: 'image/png',
        fileName: 'receipt.png',
        sizeBytes: 5,
        imageBase64: Buffer.from('image').toString('base64'),
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

function testDb({
    scanImages = [],
    scanItems = [],
    scans = [scan()],
    transactions = [],
    users = [user()]
}: {
    readonly scanImages?: TransactionScanImageDb[];
    readonly scanItems?: TransactionScanItemDb[];
    readonly scans?: TransactionScanDb[];
    readonly transactions?: TransactionDb[];
    readonly users?: UserDb[];
} = {}): AppDb {
    return {
        users: {
            find: vi.fn(async (id: number) =>
                users.find(candidate => candidate.id === id)
            )
        },
        budgets: {
            find: vi.fn(async (id: number) => ({
                id,
                name: 'Main',
                defaultCurrency: 'USD',
                countryCode: 'US',
                createdByUserId: 1,
                createdAt: timestamp,
                updatedAt: timestamp
            }))
        },
        budgetMembers: {
            where: vi.fn(() => ({
                where: vi.fn(() => ({
                    first: vi.fn(async () => ({
                        budgetId: 1,
                        userId: 1,
                        role: 'admin',
                        canCreateTransactions: true,
                        canUpdateTransactions: true,
                        canDeleteTransactions: true,
                        canManageCategories: true,
                        canManageVendors: true,
                        canManageTags: true,
                        canManageMembers: true,
                        createdAt: timestamp,
                        updatedAt: timestamp
                    }))
                }))
            }))
        },
        transactionScans: {
            where: vi.fn(
                <TValue>(
                    selector: (row: TransactionScanDb) => TValue,
                    value: TValue
                ) => testQuery(scans).where(selector, value)
            ),
            insert: vi.fn(async value => {
                const created = scan({
                    id: 10,
                    ...value
                });
                scans.push(created);
                return created;
            })
        },
        transactionScanItems: {
            where: vi.fn(
                <TValue>(
                    selector: (row: TransactionScanItemDb) => TValue,
                    value: TValue
                ) => testQuery(scanItems).where(selector, value)
            ),
            insert: vi.fn(async value => {
                const created = scanItem({
                    id: scanItems.length + 20,
                    ...value
                });
                scanItems.push(created);
                return created;
            })
        },
        transactionScanImages: {
            where: vi.fn(
                <TValue>(
                    selector: (row: TransactionScanImageDb) => TValue,
                    value: TValue
                ) => testQuery(scanImages).where(selector, value)
            ),
            insert: vi.fn(async value => {
                const created = scanImage({
                    id: scanImages.length + 30,
                    ...value
                });
                scanImages.push(created);
                return created;
            })
        },
        transactions: {
            where: vi.fn(
                <TValue>(
                    selector: (row: TransactionDb) => TValue,
                    value: TValue
                ) => testQuery(transactions).where(selector, value)
            )
        }
    } as unknown as AppDb;
}

const config = {
    openai: {
        apiKey: 'sk-test',
        reportModel: 'gpt-5-mini',
        transactionScanModel: 'gpt-5.5'
    }
} as Config;

describe('transaction image scans', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        mocks.generateStructuredJsonFromContent.mockReset();
        mocks.listCategories.mockReset();
        mocks.listTransactions.mockReset();
        mocks.listVendors.mockReset();
    });

    it('creates sanitized draft transactions from image scan output', async () => {
        mocks.listCategories.mockResolvedValue([category()]);
        mocks.listVendors.mockResolvedValue([vendor()]);
        mocks.listTransactions.mockResolvedValue({ items: [transaction()] });
        mocks.generateStructuredJsonFromContent.mockResolvedValue({
            documentKind: 'receipt',
            warnings: ['Check tax lines.'],
            visibleTotal: 12.34,
            visibleTotalCurrency: 'USD',
            transactions: [
                {
                    amount: 12.34,
                    categoryId: 7,
                    confidence: {
                        amount: 'high',
                        category: 'medium',
                        currency: 'high',
                        date: 'medium',
                        overall: 'medium',
                        vendor: 'high'
                    },
                    currency: 'usd',
                    evidence: 'Walmart 12.34',
                    lineItemSubtotal: 12.34,
                    lineItems: [],
                    note: 'Milk - 4.34\nBread - 8.00',
                    occurredDate: '2026-06-01',
                    occurredTime: null,
                    suggestedCategoryKind: null,
                    suggestedCategoryName: null,
                    suggestedCategoryParentId: null,
                    suggestedCategoryReason: null,
                    suggestedCategoryType: null,
                    suggestedVendorName: null,
                    transactionType: 'expense',
                    vendorId: 5
                }
            ]
        });

        const scanItems: TransactionScanItemDb[] = [];
        const db = testDb({ scanItems });
        const result = await scanTransactionsFromImage(db, config, 1, {
            imageBase64: Buffer.from('image').toString('base64'),
            mimeType: 'image/png',
            fileName: 'receipt.png'
        });

        expect(result).toMatchObject({
            scanId: 10,
            documentKind: 'receipt',
            warnings: ['Check tax lines.'],
            drafts: [
                {
                    id: 20,
                    amount: 12.34,
                    categoryId: 7,
                    currency: 'USD',
                    vendorId: 5,
                    possibleDuplicateTransactionIds: [99]
                }
            ]
        });
        expect(scanItems).toHaveLength(1);
        expect(JSON.parse(scanItems[0]?.draftJson ?? '{}')).toMatchObject({
            amount: 12.34,
            categoryId: 7,
            currency: 'USD',
            note: 'Milk - 4.34\nBread - 8.00',
            vendorId: 5
        });
        expect(
            mocks.generateStructuredJsonFromContent.mock.calls[0]?.[1].content
        ).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    image_url: expect.stringContaining(
                        'data:image/png;base64,'
                    ),
                    type: 'input_image'
                })
            ])
        );
        expect(
            JSON.parse(
                String(
                    mocks.generateStructuredJsonFromContent.mock.calls[0]?.[1]
                        .content[0]?.text
                )
            ).outputRules.note
        ).toContain('multiline notes');
    });

    it('suggests category creation instead of trusting low-confidence category IDs', async () => {
        mocks.listCategories.mockResolvedValue([category()]);
        mocks.listVendors.mockResolvedValue([vendor()]);
        mocks.listTransactions.mockResolvedValue({ items: [] });
        mocks.generateStructuredJsonFromContent.mockResolvedValue({
            documentKind: 'receipt',
            warnings: [],
            visibleTotal: 18.5,
            visibleTotalCurrency: 'USD',
            transactions: [
                {
                    amount: 18.5,
                    categoryId: 7,
                    confidence: {
                        amount: 'high',
                        category: 'low',
                        currency: 'high',
                        date: 'medium',
                        overall: 'medium',
                        vendor: 'low'
                    },
                    currency: 'USD',
                    evidence: 'Hardware supplies 18.50',
                    lineItemSubtotal: 18.5,
                    lineItems: [
                        {
                            amount: 18.5,
                            description: 'Hardware supplies',
                            quantity: 1
                        }
                    ],
                    note: null,
                    occurredDate: '2026-06-01',
                    occurredTime: null,
                    suggestedCategoryKind: 'normal',
                    suggestedCategoryName: 'Home supplies',
                    suggestedCategoryParentId: null,
                    suggestedCategoryReason:
                        'No existing category matches hardware supplies.',
                    suggestedCategoryType: 'expense',
                    suggestedVendorName: 'Hardware Shop',
                    transactionType: 'expense',
                    vendorId: null
                }
            ]
        });

        const result = await scanTransactionsFromImage(testDb(), config, 1, {
            imageBase64: Buffer.from('image').toString('base64'),
            mimeType: 'image/png'
        });

        expect(result.drafts[0]).toMatchObject({
            categoryId: null,
            suggestedCategory: {
                name: 'Home supplies',
                type: 'expense',
                parentId: null,
                kind: 'normal',
                reason: 'No existing category matches hardware supplies.'
            },
            confidence: {
                category: 'low'
            }
        });
    });

    it('keeps split invoice drafts linked to one scan with itemized notes', async () => {
        mocks.listCategories.mockResolvedValue([
            category({ id: 7, name: 'Groceries', displayName: 'Groceries' }),
            category({ id: 8, name: 'Medicine', displayName: 'Medicine' })
        ]);
        mocks.listVendors.mockResolvedValue([vendor()]);
        mocks.listTransactions.mockResolvedValue({ items: [] });
        mocks.generateStructuredJsonFromContent.mockResolvedValue({
            documentKind: 'invoice',
            warnings: [],
            visibleTotal: 33.0,
            visibleTotalCurrency: 'USD',
            transactions: [
                {
                    amount: 21.0,
                    categoryId: 7,
                    confidence: {
                        amount: 'high',
                        category: 'high',
                        currency: 'high',
                        date: 'high',
                        overall: 'high',
                        vendor: 'high'
                    },
                    currency: 'USD',
                    evidence: 'Apples 10.00 Milk 11.00',
                    lineItemSubtotal: 21,
                    lineItems: [
                        {
                            amount: 10,
                            description: 'Apples',
                            quantity: 1
                        },
                        { amount: 11, description: 'Milk', quantity: 1 }
                    ],
                    note: 'Apples - 10.00\nMilk - 11.00',
                    occurredDate: '2026-06-02',
                    occurredTime: null,
                    suggestedCategoryKind: null,
                    suggestedCategoryName: null,
                    suggestedCategoryParentId: null,
                    suggestedCategoryReason: null,
                    suggestedCategoryType: null,
                    suggestedVendorName: null,
                    transactionType: 'expense',
                    vendorId: 5
                },
                {
                    amount: 12.0,
                    categoryId: 8,
                    confidence: {
                        amount: 'high',
                        category: 'high',
                        currency: 'high',
                        date: 'high',
                        overall: 'high',
                        vendor: 'high'
                    },
                    currency: 'USD',
                    evidence: 'Bandages 12.00',
                    lineItemSubtotal: 12,
                    lineItems: [
                        { amount: 12, description: 'Bandages', quantity: 1 }
                    ],
                    note: 'Bandages - 12.00',
                    occurredDate: '2026-06-02',
                    occurredTime: null,
                    suggestedCategoryKind: null,
                    suggestedCategoryName: null,
                    suggestedCategoryParentId: null,
                    suggestedCategoryReason: null,
                    suggestedCategoryType: null,
                    suggestedVendorName: null,
                    transactionType: 'expense',
                    vendorId: 5
                }
            ]
        });

        const scanItems: TransactionScanItemDb[] = [];
        const result = await scanTransactionsFromImage(
            testDb({ scanItems }),
            config,
            1,
            {
                imageBase64: Buffer.from('image').toString('base64'),
                mimeType: 'image/png',
                fileName: 'invoice.png'
            }
        );

        expect(result).toMatchObject({
            scanId: 10,
            documentKind: 'invoice',
            drafts: [
                {
                    amount: 21,
                    categoryId: 7,
                    note: 'Apples - 10.00\nMilk - 11.00'
                },
                {
                    amount: 12,
                    categoryId: 8,
                    note: 'Bandages - 12.00'
                }
            ]
        });
        expect(scanItems).toHaveLength(2);
        expect(scanItems.map(item => item.scanId)).toEqual([10, 10]);
    });

    it('splits very tall images into ordered vision tiles', async () => {
        const buffer = await sharp({
            create: {
                background: '#ffffff',
                channels: 3,
                height: 7661,
                width: 1440
            }
        })
            .png()
            .toBuffer();

        const prepared = await prepareScanImagesForVision(buffer, 'image/png');

        expect(prepared.images).toHaveLength(4);
        expect(prepared.images[0]).toMatchObject({
            description: 'tile 1 of 4',
            mimeType: 'image/jpeg',
            width: 1440
        });
        expect(prepared.promptContext.preprocessing).toContain(
            'ordered overlapping tiles'
        );
        expect(prepared.warnings[0]).toContain('split into 4 ordered tiles');
    });

    it('records confirmed scan corrections', async () => {
        const item = scanItem();
        const db = testDb({
            scanItems: [item],
            transactions: [transactionRow({ id: 42 })]
        });
        const body: TransactionScanDecisionBody = {
            decision: 'confirmed',
            transactionId: 42,
            correctedTransaction: {
                amount: 19.99,
                categoryId: 7,
                currency: 'USD',
                occurredAt: timestamp,
                vendorId: 5,
                note: 'Corrected'
            }
        };

        await recordTransactionScanDecision(db, 1, 10, 20, body);

        expect(item).toMatchObject({
            decision: 'confirmed',
            transactionId: 42
        });
        expect(JSON.parse(item.correctedJson ?? '{}')).toMatchObject({
            amount: 19.99,
            categoryId: 7,
            note: 'Corrected'
        });
        expect(item.decidedAt).toBeInstanceOf(Date);
    });

    it('stores the original image for confirmed scan transactions', async () => {
        const item = scanItem();
        const scanImages: TransactionScanImageDb[] = [];
        const db = testDb({
            scanImages,
            scanItems: [item],
            transactions: [transactionRow({ id: 42 })]
        });

        await recordTransactionScanDecision(db, 1, 10, 20, {
            decision: 'confirmed',
            transactionId: 42,
            correctedTransaction: {
                amount: 19.99,
                categoryId: 7,
                currency: 'USD',
                occurredAt: timestamp,
                vendorId: null,
                note: null
            },
            attachment: {
                imageBase64: Buffer.from('image').toString('base64'),
                mimeType: 'image/png',
                fileName: 'receipt.png'
            }
        });

        expect(scanImages).toHaveLength(1);
        expect(scanImages[0]).toMatchObject({
            scanId: 10,
            userId: 1,
            mimeType: 'image/png',
            fileName: 'receipt.png',
            sizeBytes: 5,
            imageBase64: Buffer.from('image').toString('base64')
        });
    });

    it('rejects scan attachments that do not match the original scan hash', async () => {
        const item = scanItem();
        const scanImages: TransactionScanImageDb[] = [];
        const db = testDb({
            scanImages,
            scanItems: [item],
            transactions: [transactionRow({ id: 42 })]
        });

        await expect(
            recordTransactionScanDecision(db, 1, 10, 20, {
                decision: 'confirmed',
                transactionId: 42,
                correctedTransaction: {
                    amount: 19.99,
                    categoryId: 7,
                    currency: 'USD',
                    occurredAt: timestamp,
                    vendorId: null,
                    note: null
                },
                attachment: {
                    imageBase64: Buffer.from('other').toString('base64'),
                    mimeType: 'image/png',
                    fileName: 'receipt.png'
                }
            })
        ).rejects.toThrow('Confirmed scan image did not match');
        expect(scanImages).toHaveLength(0);
    });
});
