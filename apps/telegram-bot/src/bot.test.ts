import { Readable } from 'node:stream';
import type {
    Category,
    Currency,
    TransactionScanProgressEvent,
    UserPreference,
    Vendor
} from '@xpenser/contracts';
import type TelegramBot from 'node-telegram-bot-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    noteSkipCallback,
    scanConfirmCallback,
    vendorSelectCallbackPrefix
} from './flow.js';

const mocks = vi.hoisted(() => {
    const instances: MockTelegramBot[] = [];
    const serviceClient = {
        telegram: {
            link: vi.fn(),
            token: vi.fn()
        }
    };
    const userClient = {
        auth: { me: vi.fn() },
        categories: { list: vi.fn() },
        currencies: { convert: vi.fn(), list: vi.fn() },
        transactions: { create: vi.fn(), list: vi.fn() },
        transactionScans: {
            decide: vi.fn(),
            progress: vi.fn(),
            start: vi.fn()
        },
        vendors: { list: vi.fn() }
    };
    const createXpenserClient = vi.fn(
        (options?: { readonly headers?: unknown }) =>
            options?.headers ? serviceClient : userClient
    );

    class MockTelegramBot {
        answerCallbackQuery = vi.fn(async () => true);
        editMessageText = vi.fn(async () => ({}));
        getFileStream = vi.fn(() => Readable.from([]));
        on = vi.fn();
        onText = vi.fn();
        sendMessage = vi.fn(async (chatId: number, text: string) => ({
            chat: { id: chatId, type: 'private' },
            date: 0,
            message_id: this.sendMessage.mock.calls.length,
            text
        }));
        setMyCommands = vi.fn(async () => true);
        stopPolling = vi.fn(async () => true);

        constructor() {
            instances.push(this);
        }
    }

    return {
        MockTelegramBot,
        createXpenserClient,
        instances,
        serviceClient,
        userClient
    };
});

vi.mock('node-telegram-bot-api', () => ({
    default: mocks.MockTelegramBot
}));

vi.mock('@xpenser/client', () => ({
    createXpenserClient: mocks.createXpenserClient
}));

import { XpenserTelegramBot } from './bot.js';

const telegramUser = {
    first_name: 'A',
    id: 123,
    is_bot: false,
    username: 'alice'
} as TelegramBot.User;

const baseChat = { id: 456, type: 'private' } as TelegramBot.Chat;

const me = {
    countryCode: 'US',
    defaultCurrency: 'USD',
    email: 'alice@example.test',
    favoriteCurrencies: [],
    hasCategories: true,
    id: 1,
    mainBudgetId: 1,
    monthlyEmailReportEnabled: false,
    timezone: 'UTC',
    transactionCurrencies: ['USD'],
    weeklyEmailReportEnabled: false,
    budgets: [
        {
            id: 1,
            name: 'Main',
            defaultCurrency: 'USD',
            favoriteCurrencies: [],
            transactionCurrencies: ['USD'],
            countryCode: 'US',
            role: 'admin',
            permissions: {
                canCreateTransactions: true,
                canUpdateTransactions: true,
                canDeleteTransactions: true,
                canManageCategories: true,
                canManageVendors: true,
                canManageTags: true,
                canManageMembers: true
            },
            isMain: true,
            archivedAt: null,
            createdAt: new Date('2026-05-01T00:00:00.000Z'),
            updatedAt: new Date('2026-05-01T00:00:00.000Z')
        }
    ]
} as UserPreference;

const categories = [
    {
        id: 1,
        displayName: 'Groceries',
        name: 'Groceries',
        type: 'expense'
    },
    {
        id: 2,
        displayName: 'Coffee',
        name: 'Coffee',
        type: 'expense'
    }
] as Category[];

const currencies = [{ code: 'USD', name: 'US Dollar' }] as Currency[];

const vendors = [
    {
        id: 9,
        displayName: 'Market',
        name: 'Market',
        suggestedCategoryId: 1
    }
] as Vendor[];

function logger() {
    return {
        error: vi.fn(),
        forContext: vi.fn(() => logger()),
        info: vi.fn()
    };
}

function bot() {
    return new XpenserTelegramBot(
        {
            apiBaseUrl: 'http://api.test',
            logLevel: 'information',
            nodeEnv: 'test',
            serviceSecret: 'service-secret-minimum-32-characters',
            telegram: {
                token: 'telegram-token',
                username: 'xpenser_bot'
            }
        } as never,
        logger() as never
    );
}

function message(overrides: Partial<TelegramBot.Message> = {}) {
    return {
        chat: baseChat,
        date: 0,
        from: telegramUser,
        message_id: 10,
        ...overrides
    } as TelegramBot.Message;
}

function callback(data: string): TelegramBot.CallbackQuery {
    return {
        chat_instance: 'chat',
        data,
        from: telegramUser,
        id: `query-${data}`,
        message: message()
    } as TelegramBot.CallbackQuery;
}

function progressSubscription(events: readonly TransactionScanProgressEvent[]) {
    return {
        close: vi.fn(),
        async *[Symbol.asyncIterator]() {
            for (const event of events) {
                yield event;
            }
        }
    };
}

function transaction(overrides: Record<string, unknown> = {}) {
    return {
        amount: 12.5,
        categoryDisplayName: 'Groceries',
        categoryKind: 'normal',
        currency: 'USD',
        defaultCurrency: 'USD',
        defaultCurrencyAmount: 12.5,
        id: 77,
        tags: [],
        type: 'expense',
        vendorName: 'Market',
        ...overrides
    };
}

beforeEach(() => {
    mocks.instances.length = 0;
    vi.clearAllMocks();
    mocks.createXpenserClient.mockImplementation(
        (options?: { readonly headers?: unknown }) =>
            options?.headers ? mocks.serviceClient : mocks.userClient
    );
    mocks.serviceClient.telegram.token.mockResolvedValue({
        token: 'user-token'
    });
    mocks.userClient.auth.me.mockResolvedValue(me);
    mocks.userClient.categories.list.mockResolvedValue(categories);
    mocks.userClient.currencies.list.mockResolvedValue(currencies);
    mocks.userClient.transactions.list.mockResolvedValue({ items: [] });
    mocks.userClient.transactions.create.mockResolvedValue(transaction());
    mocks.userClient.vendors.list.mockResolvedValue(vendors);
});

describe('XpenserTelegramBot transaction flows', () => {
    it('adds an existing vendor to manual Telegram transactions', async () => {
        const subject = bot();

        await subject.beginAdd(message({ text: '/add' }));
        await subject.handleText(message({ text: '12.50' }));
        await subject.handleCallback(callback('cur:USD'));
        await subject.handleCallback(
            callback(`${vendorSelectCallbackPrefix}${vendors[0]?.id}`)
        );
        await subject.handleCallback(callback('cat:1'));
        await subject.handleCallback(callback(noteSkipCallback));

        expect(mocks.userClient.transactions.create).toHaveBeenCalledWith({
            body: expect.objectContaining({
                amount: 12.5,
                budgetId: 1,
                categoryId: 1,
                currency: 'USD',
                vendorId: 9
            })
        });
    });

    it('scans a Telegram photo and confirms the scanned draft with attachment', async () => {
        const subject = bot();
        const telegram = mocks.instances[0]!;
        telegram.getFileStream.mockReturnValue(
            Readable.from([Buffer.from('receipt bytes')])
        );
        mocks.userClient.transactionScans.start.mockResolvedValue({
            jobId: 'job-1',
            token: 'scan-token'
        });
        mocks.userClient.transactionScans.progress.mockReturnValue(
            progressSubscription([
                {
                    error: null,
                    jobId: 'job-1',
                    message: 'Scan queued.',
                    progress: 0,
                    scan: null,
                    stage: 'queued'
                },
                {
                    error: null,
                    jobId: 'job-1',
                    message: 'Found 1 transaction for review.',
                    progress: 100,
                    scan: {
                        drafts: [
                            {
                                amount: 12.5,
                                categoryId: 1,
                                confidence: {
                                    amount: 'high',
                                    category: 'high',
                                    currency: 'high',
                                    date: 'high',
                                    overall: 'high',
                                    vendor: 'high'
                                },
                                currency: 'USD',
                                evidence: 'Market total 12.50',
                                id: 50,
                                note: 'Scanned invoice',
                                occurredAt: new Date(
                                    '2026-06-06T12:00:00.000Z'
                                ),
                                possibleDuplicateTransactionIds: [],
                                suggestedCategory: null,
                                suggestedVendorName: null,
                                transactionType: 'expense',
                                vendorId: 9
                            }
                        ],
                        documentKind: 'invoice',
                        scanId: 40,
                        warnings: []
                    },
                    stage: 'complete'
                }
            ])
        );

        await subject.handleScanImage(
            message({
                photo: [
                    {
                        file_id: 'small',
                        file_size: 5,
                        file_unique_id: 'small-u',
                        height: 100,
                        width: 100
                    },
                    {
                        file_id: 'large',
                        file_size: 20,
                        file_unique_id: 'large-u',
                        height: 1000,
                        width: 1000
                    }
                ]
            })
        );
        await subject.handleCallback(callback(scanConfirmCallback));

        expect(telegram.getFileStream).toHaveBeenCalledWith('large');
        expect(mocks.userClient.transactionScans.start).toHaveBeenCalledWith({
            body: {
                budgetId: 1,
                fileName: 'telegram-photo-10.jpg',
                imageBase64: Buffer.from('receipt bytes').toString('base64'),
                mimeType: 'image/jpeg'
            }
        });
        expect(mocks.userClient.transactions.create).toHaveBeenCalledWith({
            body: expect.objectContaining({
                amount: 12.5,
                budgetId: 1,
                categoryId: 1,
                currency: 'USD',
                vendorId: 9
            })
        });
        expect(mocks.userClient.transactionScans.decide).toHaveBeenCalledWith({
            params: { itemId: 50, scanId: 40 },
            body: expect.objectContaining({
                attachment: expect.objectContaining({
                    budgetId: 1,
                    fileName: 'telegram-photo-10.jpg',
                    imageBase64:
                        Buffer.from('receipt bytes').toString('base64'),
                    mimeType: 'image/jpeg'
                }),
                correctedTransaction: expect.objectContaining({
                    amount: 12.5,
                    categoryId: 1,
                    currency: 'USD',
                    vendorId: 9
                }),
                decision: 'confirmed',
                transactionId: 77
            })
        });
    });

    it('rejects unsupported Telegram documents before scanning', async () => {
        const subject = bot();

        await subject.handleScanImage(
            message({
                document: {
                    file_id: 'pdf',
                    file_name: 'invoice.pdf',
                    file_size: 100,
                    file_unique_id: 'pdf-u',
                    mime_type: 'application/pdf'
                } as TelegramBot.Document
            })
        );

        expect(mocks.userClient.transactionScans.start).not.toHaveBeenCalled();
        expect(mocks.instances[0]?.sendMessage).toHaveBeenCalledWith(
            baseChat.id,
            'Upload a PNG, JPEG, or WebP image.',
            expect.anything()
        );
    });
});
