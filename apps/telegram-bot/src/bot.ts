import { Readable } from 'node:stream';
import type { Logger } from '@cleverbrush/log';
import { createXpenserClient, type XpenserClient } from '@xpenser/client';
import type {
    Budget,
    Category,
    Currency,
    Transaction,
    TransactionScanBody,
    TransactionScanDraft,
    TransactionScanJobResponse,
    TransactionScanProgressEvent,
    TransactionScanResponse,
    UserPreference,
    Vendor
} from '@xpenser/contracts';
import { FieldLimits, TransactionScanLimits } from '@xpenser/contracts';
import {
    dateToLocalDateTimeInput,
    formatDateInTimeZone
} from '@xpenser/timezone';
import TelegramBot from 'node-telegram-bot-api';
import type { BotConfig } from './config.js';
import {
    addCommand,
    budgetCommand,
    budgetSelectCallbackPrefix,
    cancelCallback,
    categoriesByRecentUse,
    categoriesWithPreferredFirst,
    currencyKeyboard,
    draftCategoryType,
    filteredVendors,
    isAddButtonText,
    isAllowedScanImageMimeType,
    noteAddCallback,
    noteLengthError,
    noteSkipCallback,
    parseAmount,
    parseStartToken,
    parseTelegramDateTime,
    preferredCurrencies,
    quickAddReplyKeyboard,
    scanConfirmCallback,
    scanDiscardCallback,
    scanEditAmountCallback,
    scanEditCategoryCallback,
    scanEditCurrencyCallback,
    scanEditDateCallback,
    scanEditNoteCallback,
    scanEditVendorCallback,
    scanImageSizeError,
    scanNextCallback,
    scanPreviousCallback,
    vendorKeyboard,
    vendorLabel,
    vendorNoneCallback,
    vendorPageCallbackPrefix,
    vendorSearchCallback,
    vendorSelectCallbackPrefix
} from './flow.js';
import { TelegramPollingError } from './log-templates.js';
import {
    telegramCallbackAction,
    telegramCommand,
    traceTelegramUpdate
} from './tracing.js';

type TelegramUserBody = {
    readonly telegramUserId: string;
    readonly telegramUsername?: string;
    readonly telegramFirstName?: string;
    readonly telegramLastName?: string;
};

type BudgetContext = {
    readonly budgetId: number;
    readonly budgetName: string;
};

type ManualDraft =
    | (BudgetContext & {
          readonly kind: 'manual';
          readonly step: 'amount';
          readonly me: UserPreference;
          readonly categories: readonly Category[];
          readonly currencies: readonly Currency[];
          readonly vendors: readonly Vendor[];
      })
    | (BudgetContext & {
          readonly kind: 'manual';
          readonly step: 'currency';
          readonly me: UserPreference;
          readonly categories: readonly Category[];
          readonly currencies: readonly Currency[];
          readonly vendors: readonly Vendor[];
          readonly amount: number;
      })
    | (BudgetContext & {
          readonly kind: 'manual';
          readonly step: 'vendor';
          readonly me: UserPreference;
          readonly categories: readonly Category[];
          readonly currencies: readonly Currency[];
          readonly vendors: readonly Vendor[];
          readonly amount: number;
          readonly currency: string;
          readonly page: number;
          readonly query?: string;
      })
    | (BudgetContext & {
          readonly kind: 'manual';
          readonly step: 'vendor-search';
          readonly me: UserPreference;
          readonly categories: readonly Category[];
          readonly currencies: readonly Currency[];
          readonly vendors: readonly Vendor[];
          readonly amount: number;
          readonly currency: string;
      })
    | (BudgetContext & {
          readonly kind: 'manual';
          readonly step: 'category';
          readonly me: UserPreference;
          readonly categories: readonly Category[];
          readonly currencies: readonly Currency[];
          readonly amount: number;
          readonly currency: string;
          readonly vendorId: number | null;
          readonly page: number;
      })
    | (BudgetContext & {
          readonly kind: 'manual';
          readonly step: 'note-choice';
          readonly category: Category;
          readonly currency: string;
          readonly amount: number;
          readonly vendorId: number | null;
      })
    | (BudgetContext & {
          readonly kind: 'manual';
          readonly step: 'note-text';
          readonly category: Category;
          readonly currency: string;
          readonly amount: number;
          readonly vendorId: number | null;
      });

type ScanEditStep =
    | 'edit-amount'
    | 'edit-category'
    | 'edit-currency'
    | 'edit-date'
    | 'edit-note'
    | 'edit-vendor'
    | 'edit-vendor-search';

type ScanDraftValues = {
    readonly amount: number | null;
    readonly categoryId: number | null;
    readonly currency: string;
    readonly occurredAt: Date;
    readonly note: string;
    readonly transactionType: Category['type'];
    readonly vendorId: number | null;
};

type ScanDraftDecision = 'confirmed' | 'discarded';

type ScanDraftSession = BudgetContext & {
    readonly kind: 'scan';
    readonly step: 'review' | ScanEditStep;
    readonly me: UserPreference;
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly vendors: readonly Vendor[];
    readonly scan: TransactionScanResponse;
    readonly attachment: TransactionScanBody;
    readonly values: Readonly<Record<number, ScanDraftValues>>;
    readonly decisions: Readonly<Record<number, ScanDraftDecision>>;
    readonly index: number;
    readonly attachmentSubmitted: boolean;
    readonly categoryPage: number;
    readonly vendorPage: number;
    readonly vendorQuery?: string;
};

type Draft = ManualDraft | ScanDraftSession;

type TelegramScanMedia = {
    readonly fileId: string;
    readonly fileName?: string;
    readonly fileSize?: number;
    readonly mimeType: TransactionScanBody['mimeType'];
};

const categoryPageSize = 8;
const pollingErrorLogIntervalMs = 60_000;

function telegramUser(
    from: TelegramBot.User | undefined
): TelegramUserBody | undefined {
    if (!from) {
        return undefined;
    }

    return {
        telegramUserId: String(from.id),
        telegramUsername: from.username,
        telegramFirstName: from.first_name,
        telegramLastName: from.last_name
    };
}

function sessionKey(chatId: number, userId: string): string {
    return `${chatId}:${userId}`;
}

function displayCategory(category: Category): string {
    return `${category.type === 'income' ? '💰' : '💸'} ${category.displayName}`;
}

function categoryKeyboard(categories: readonly Category[], page: number) {
    const pageCount = Math.max(
        1,
        Math.ceil(categories.length / categoryPageSize)
    );
    const safePage = Math.min(Math.max(page, 0), pageCount - 1);
    const start = safePage * categoryPageSize;
    const rows = categories
        .slice(start, start + categoryPageSize)
        .map(category => [
            {
                text: displayCategory(category),
                callback_data: `cat:${category.id}`
            }
        ]);

    const navigation = [];
    if (safePage > 0) {
        navigation.push({
            text: 'Previous',
            callback_data: `catpage:${safePage - 1}`
        });
    }
    if (safePage < pageCount - 1) {
        navigation.push({
            text: 'Next',
            callback_data: `catpage:${safePage + 1}`
        });
    }
    if (navigation.length > 0) {
        rows.push(navigation);
    }
    rows.push([{ text: 'Cancel', callback_data: cancelCallback }]);

    return { inline_keyboard: rows };
}

function noteKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: 'No description', callback_data: noteSkipCallback },
                { text: 'Add description', callback_data: noteAddCallback }
            ],
            [{ text: 'Cancel', callback_data: cancelCallback }]
        ]
    };
}

function scanReviewKeyboard(session: ScanDraftSession) {
    const draft = session.scan.drafts[session.index];
    const rows =
        draft && session.decisions[draft.id]
            ? []
            : [
                  [
                      {
                          text: 'Confirm and save',
                          callback_data: scanConfirmCallback
                      },
                      { text: 'Discard', callback_data: scanDiscardCallback }
                  ],
                  [
                      { text: 'Amount', callback_data: scanEditAmountCallback },
                      {
                          text: 'Currency',
                          callback_data: scanEditCurrencyCallback
                      }
                  ],
                  [
                      {
                          text: 'Category',
                          callback_data: scanEditCategoryCallback
                      },
                      { text: 'Vendor', callback_data: scanEditVendorCallback }
                  ],
                  [
                      { text: 'Date', callback_data: scanEditDateCallback },
                      { text: 'Note', callback_data: scanEditNoteCallback }
                  ]
              ];

    const navigation = [];
    if (session.index > 0) {
        navigation.push({
            text: 'Previous',
            callback_data: scanPreviousCallback
        });
    }
    if (session.index < session.scan.drafts.length - 1) {
        navigation.push({ text: 'Next', callback_data: scanNextCallback });
    }
    if (navigation.length > 0) {
        rows.push(navigation);
    }
    rows.push([{ text: 'Cancel', callback_data: cancelCallback }]);

    return { inline_keyboard: rows };
}

function formatTelegramAmount(amount: number, currency: string): string {
    return `${amount.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    })} ${currency}`;
}

function formatTelegramDate(value: Date, timeZone: string): string {
    return formatDateInTimeZone(value, timeZone, {
        dateStyle: 'short',
        timeStyle: 'short'
    });
}

function rateDate(value = new Date()): string {
    return value.toISOString().slice(0, 10);
}

function apiErrorMessage(err: unknown): string | undefined {
    const body =
        typeof err === 'object' && err !== null && 'body' in err
            ? (err as { readonly body?: unknown }).body
            : undefined;
    if (
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body.message === 'string'
    ) {
        return body.message;
    }
    return undefined;
}

function toError(err: unknown): Error {
    return err instanceof Error ? err : new Error(String(err));
}

function photoMedia(msg: TelegramBot.Message): TelegramScanMedia | undefined {
    const photo = [...(msg.photo ?? [])].sort((left, right) => {
        const rightSize = right.file_size ?? 0;
        const leftSize = left.file_size ?? 0;
        return (
            rightSize - leftSize ||
            right.width * right.height - left.width * left.height
        );
    })[0];
    if (!photo) {
        return undefined;
    }

    return {
        fileId: photo.file_id,
        fileName: `telegram-photo-${msg.message_id}.jpg`,
        fileSize: photo.file_size,
        mimeType: 'image/jpeg'
    };
}

function documentMedia(
    msg: TelegramBot.Message
): TelegramScanMedia | undefined {
    const document = msg.document;
    const mimeType = document?.mime_type;
    if (!document || !isAllowedScanImageMimeType(mimeType)) {
        return undefined;
    }

    return {
        fileId: document.file_id,
        fileName: document.file_name,
        fileSize: document.file_size,
        mimeType
    };
}

function scanMedia(msg: TelegramBot.Message): TelegramScanMedia | undefined {
    return photoMedia(msg) ?? documentMedia(msg);
}

function scanProgressMessage(event: TransactionScanProgressEvent): string {
    return `${event.message} ${Math.max(0, Math.min(100, Math.round(event.progress)))}%`;
}

function categoryById(
    categories: readonly Category[],
    categoryId: number | null
): Category | undefined {
    return categoryId
        ? categories.find(category => category.id === categoryId)
        : undefined;
}

function vendorById(
    vendors: readonly Vendor[],
    vendorId: number | null
): Vendor | undefined {
    return vendorId
        ? vendors.find(vendor => vendor.id === vendorId)
        : undefined;
}

function preferredCurrency(
    me: UserPreference,
    currencies: readonly Currency[],
    value: string | null | undefined,
    budgetId?: number
): string {
    const options = preferredCurrencies(me, currencies, budgetId);
    const budget = budgetId
        ? me.budgets.find(candidate => candidate.id === budgetId)
        : undefined;
    const normalized = value?.trim().toUpperCase();
    return normalized && options.includes(normalized)
        ? normalized
        : (options[0] ?? budget?.defaultCurrency ?? me.defaultCurrency);
}

function initialScanValues(
    draft: TransactionScanDraft,
    me: UserPreference,
    categories: readonly Category[],
    currencies: readonly Currency[],
    budgetId: number
): ScanDraftValues {
    const transactionType = draftCategoryType(draft, categories);
    return {
        amount: draft.amount,
        categoryId: draft.categoryId,
        currency: preferredCurrency(me, currencies, draft.currency, budgetId),
        occurredAt: draft.occurredAt ?? new Date(),
        note: draft.note ?? '',
        transactionType,
        vendorId: draft.vendorId
    };
}

function valuesForScan(
    scan: TransactionScanResponse,
    me: UserPreference,
    categories: readonly Category[],
    currencies: readonly Currency[],
    budgetId: number
): Record<number, ScanDraftValues> {
    return Object.fromEntries(
        scan.drafts.map(draft => [
            draft.id,
            initialScanValues(draft, me, categories, currencies, budgetId)
        ])
    );
}

function scanDraftAt(
    session: ScanDraftSession
): TransactionScanDraft | undefined {
    return session.scan.drafts[session.index];
}

function scanValuesAt(session: ScanDraftSession): ScanDraftValues | undefined {
    const draft = scanDraftAt(session);
    return draft ? session.values[draft.id] : undefined;
}

function updateScanValues(
    session: ScanDraftSession,
    draftId: number,
    values: ScanDraftValues
): ScanDraftSession {
    return {
        ...session,
        values: {
            ...session.values,
            [draftId]: values
        }
    };
}

function nextPendingScanIndex(session: ScanDraftSession): number | undefined {
    const afterCurrent = session.scan.drafts.findIndex(
        (draft, index) => index > session.index && !session.decisions[draft.id]
    );
    if (afterCurrent >= 0) {
        return afterCurrent;
    }

    const beforeCurrent = session.scan.drafts.findIndex(
        draft => !session.decisions[draft.id]
    );
    return beforeCurrent >= 0 ? beforeCurrent : undefined;
}

function savedTransactionSummary(transaction: Transaction): string {
    const vendor = transaction.vendorName ? `${transaction.vendorName}, ` : '';
    return `${transaction.type}: ${vendor}${transaction.categoryDisplayName}, ${formatTelegramAmount(transaction.amount, transaction.currency)} (${formatTelegramAmount(transaction.defaultCurrencyAmount, transaction.defaultCurrency)}).`;
}

function activeBudget(
    me: UserPreference,
    selectedBudgetId: number | undefined
): Budget | undefined {
    return (
        me.budgets.find(budget => budget.id === selectedBudgetId) ??
        me.budgets.find(budget => budget.id === me.mainBudgetId) ??
        me.budgets[0]
    );
}

function budgetKeyboard(me: UserPreference, selectedBudgetId: number) {
    return {
        inline_keyboard: me.budgets.map(budget => [
            {
                text: `${budget.id === selectedBudgetId ? 'Current: ' : ''}${budget.name}`,
                callback_data: `${budgetSelectCallbackPrefix}${budget.id}`
            }
        ])
    };
}

function fileSizeLabel(size: number): string {
    if (size >= 1024 * 1024) {
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.ceil(size / 1024)} KB`;
}

export class XpenserTelegramBot {
    readonly #bot: TelegramBot;
    readonly #serviceClient: XpenserClient;
    readonly #sessions = new Map<string, Draft>();
    readonly #selectedBudgets = new Map<string, number>();
    readonly #logger: Logger;
    #lastPollingErrorMessage: string | undefined;
    #lastPollingErrorLoggedAt = 0;
    #suppressedPollingErrorCount = 0;

    constructor(
        private readonly config: BotConfig,
        logger: Logger
    ) {
        this.#logger = logger.forContext('SourceContext', 'XpenserTelegramBot');
        this.#bot = new TelegramBot(config.telegram.token, { polling: true });
        this.#serviceClient = createXpenserClient({
            baseUrl: config.apiBaseUrl,
            headers: {
                'X-Xpenser-Bot-Secret': config.serviceSecret
            }
        });
    }

    start(): void {
        void this.configureBotCommands();

        this.#bot.onText(/^\/start(?:@\S+)?(?:\s+\S+)?$/, msg => {
            void traceTelegramUpdate(
                {
                    updateType: 'command',
                    command: telegramCommand(msg.text),
                    chatType: msg.chat.type,
                    messageId: msg.message_id
                },
                () => this.handleStart(msg)
            );
        });
        this.#bot.onText(/^\/add(?:@\S+)?$/, msg => {
            void traceTelegramUpdate(
                {
                    updateType: 'command',
                    command: telegramCommand(msg.text),
                    chatType: msg.chat.type,
                    messageId: msg.message_id
                },
                () => this.beginAdd(msg)
            );
        });
        this.#bot.onText(/^\/budget(?:@\S+)?$/, msg => {
            void traceTelegramUpdate(
                {
                    updateType: 'command',
                    command: telegramCommand(msg.text),
                    chatType: msg.chat.type,
                    messageId: msg.message_id
                },
                () => this.handleBudget(msg)
            );
        });
        this.#bot.onText(/^\/cancel(?:@\S+)?$/, msg => {
            void traceTelegramUpdate(
                {
                    updateType: 'command',
                    command: telegramCommand(msg.text),
                    chatType: msg.chat.type,
                    messageId: msg.message_id
                },
                () => this.cancel(msg)
            );
        });
        this.#bot.on('callback_query', query => {
            void traceTelegramUpdate(
                {
                    updateType: 'callback_query',
                    callbackAction: telegramCallbackAction(query.data),
                    chatType: query.message?.chat.type,
                    messageId: query.message?.message_id
                },
                () => this.handleCallback(query)
            );
        });
        this.#bot.on('message', msg => {
            if (msg.photo || msg.document) {
                void traceTelegramUpdate(
                    {
                        updateType: 'message',
                        chatType: msg.chat.type,
                        messageId: msg.message_id
                    },
                    () => this.handleScanImage(msg)
                );
                return;
            }

            if (!msg.text || msg.text.startsWith('/')) {
                return;
            }
            if (isAddButtonText(msg.text)) {
                void traceTelegramUpdate(
                    {
                        updateType: 'message',
                        chatType: msg.chat.type,
                        messageId: msg.message_id
                    },
                    () => this.beginAdd(msg)
                );
                return;
            }

            void traceTelegramUpdate(
                {
                    updateType: 'message',
                    chatType: msg.chat.type,
                    messageId: msg.message_id
                },
                () => this.handleText(msg)
            );
        });
        this.#bot.on('polling_error', err => {
            this.logPollingError(toError(err));
        });
        this.#bot.on('error', err => {
            this.#logger.error(toError(err), 'Telegram bot error', {});
        });
    }

    async stop(): Promise<void> {
        await this.#bot.stopPolling();
    }

    logPollingError(err: Error): void {
        const now = Date.now();
        const shouldLog =
            err.message !== this.#lastPollingErrorMessage ||
            now - this.#lastPollingErrorLoggedAt >= pollingErrorLogIntervalMs;

        if (!shouldLog) {
            this.#suppressedPollingErrorCount += 1;
            return;
        }

        this.#logger.error(err, TelegramPollingError, {
            SuppressedCount: this.#suppressedPollingErrorCount
        });
        this.#lastPollingErrorMessage = err.message;
        this.#lastPollingErrorLoggedAt = now;
        this.#suppressedPollingErrorCount = 0;
    }

    async handleStart(msg: TelegramBot.Message): Promise<void> {
        if (!this.isPrivateChat(msg.chat)) {
            await this.#bot.sendMessage(
                msg.chat.id,
                'Please open a private chat with this bot.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
            return;
        }

        const user = telegramUser(msg.from);
        if (!user) {
            await this.#bot.sendMessage(
                msg.chat.id,
                'Could not read Telegram user.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
            return;
        }

        const token = parseStartToken(msg.text);
        if (!token) {
            await this.#bot.sendMessage(
                msg.chat.id,
                'Hi! Tap Add for a manual transaction, or send an invoice/receipt image to scan it.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
            return;
        }

        try {
            const result = await this.#serviceClient.telegram.link({
                body: { token, telegramUser: user }
            });
            await this.#bot.sendMessage(
                msg.chat.id,
                `✅ Telegram connected to xpenser account ${result.email}. Tap Add for a manual transaction, or send an invoice/receipt image to scan it.`,
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
        } catch (err) {
            await this.#bot.sendMessage(
                msg.chat.id,
                apiErrorMessage(err) ??
                    'Could not connect Telegram. Create a fresh link in xpenser Preferences.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
        }
    }

    async handleBudget(msg: TelegramBot.Message): Promise<void> {
        if (!this.isPrivateChat(msg.chat)) {
            await this.#bot.sendMessage(
                msg.chat.id,
                'Please open a private chat with this bot.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
            return;
        }

        const user = telegramUser(msg.from);
        if (!user) {
            await this.#bot.sendMessage(
                msg.chat.id,
                'Could not read Telegram user.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
            return;
        }

        try {
            const key = sessionKey(msg.chat.id, user.telegramUserId);
            const client = await this.userClient(user);
            const me = await client.auth.me();
            const budget = activeBudget(me, this.#selectedBudgets.get(key));
            if (!budget) {
                await this.#bot.sendMessage(
                    msg.chat.id,
                    'No budgets are available for this account.',
                    {
                        reply_markup: quickAddReplyKeyboard()
                    }
                );
                return;
            }

            this.#selectedBudgets.set(key, budget.id);
            await this.#bot.sendMessage(
                msg.chat.id,
                `Active budget: ${budget.name}`,
                {
                    reply_markup: budgetKeyboard(me, budget.id)
                }
            );
        } catch (err) {
            await this.#bot.sendMessage(
                msg.chat.id,
                apiErrorMessage(err) ??
                    'Telegram is not connected. Connect it from xpenser Preferences.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
        }
    }

    async beginAdd(msg: TelegramBot.Message): Promise<void> {
        if (!this.isPrivateChat(msg.chat)) {
            await this.#bot.sendMessage(
                msg.chat.id,
                'Please open a private chat with this bot.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
            return;
        }

        const user = telegramUser(msg.from);
        if (!user) {
            await this.#bot.sendMessage(
                msg.chat.id,
                'Could not read Telegram user.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
            return;
        }

        try {
            const client = await this.userClient(user);
            const me = await client.auth.me();
            const key = sessionKey(msg.chat.id, user.telegramUserId);
            const budget = activeBudget(me, this.#selectedBudgets.get(key));
            if (!budget) {
                await this.#bot.sendMessage(
                    msg.chat.id,
                    'No budgets are available for this account.',
                    {
                        reply_markup: quickAddReplyKeyboard()
                    }
                );
                return;
            }

            this.#selectedBudgets.set(key, budget.id);
            const budgetQuery = { budgetId: budget.id };
            const [categories, currencies, vendors, recentTransactions] =
                await Promise.all([
                    client.categories.list({ query: budgetQuery }),
                    client.currencies.list(),
                    client.vendors.list({
                        query: { ...budgetQuery, limit: 100 }
                    }),
                    client.transactions.list({
                        query: {
                            ...budgetQuery,
                            direction: 'desc',
                            limit: 100,
                            page: 1
                        }
                    })
                ]);

            if (categories.length === 0) {
                await this.#bot.sendMessage(
                    msg.chat.id,
                    '🏷 Create at least one category in xpenser first.',
                    {
                        reply_markup: quickAddReplyKeyboard()
                    }
                );
                return;
            }

            if (preferredCurrencies(me, currencies, budget.id).length === 0) {
                await this.#bot.sendMessage(
                    msg.chat.id,
                    '💱 Set a primary or favorite currency for this budget in xpenser first.',
                    {
                        reply_markup: quickAddReplyKeyboard()
                    }
                );
                return;
            }

            const draft: Draft = {
                kind: 'manual',
                step: 'amount',
                budgetId: budget.id,
                budgetName: budget.name,
                me,
                categories: categoriesByRecentUse(
                    categories,
                    recentTransactions.items
                ),
                currencies,
                vendors
            };
            this.#sessions.set(key, draft);
            await this.#bot.sendMessage(
                msg.chat.id,
                `Budget: ${budget.name}\n💸 How much is the transaction? Send a number like 12.50.`
            );
        } catch (err) {
            await this.#bot.sendMessage(
                msg.chat.id,
                apiErrorMessage(err) ??
                    'Telegram is not connected. Connect it from xpenser Preferences.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
        }
    }

    async handleScanImage(msg: TelegramBot.Message): Promise<void> {
        if (!this.isPrivateChat(msg.chat)) {
            await this.#bot.sendMessage(
                msg.chat.id,
                'Please open a private chat with this bot.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
            return;
        }

        const user = telegramUser(msg.from);
        if (!user) {
            await this.#bot.sendMessage(
                msg.chat.id,
                'Could not read Telegram user.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
            return;
        }

        const media = scanMedia(msg);
        if (!media) {
            await this.#bot.sendMessage(
                msg.chat.id,
                'Upload a PNG, JPEG, or WebP image.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
            return;
        }

        const sizeError = scanImageSizeError(media.fileSize);
        if (sizeError) {
            await this.#bot.sendMessage(msg.chat.id, sizeError, {
                reply_markup: quickAddReplyKeyboard()
            });
            return;
        }

        const progressMessage = await this.#bot.sendMessage(
            msg.chat.id,
            media.fileSize
                ? `Downloading ${fileSizeLabel(media.fileSize)} image.`
                : 'Downloading image.'
        );

        try {
            const client = await this.userClient(user);
            const me = await client.auth.me();
            const key = sessionKey(msg.chat.id, user.telegramUserId);
            const budget = activeBudget(me, this.#selectedBudgets.get(key));
            if (!budget) {
                await this.updateProgressMessage(
                    msg.chat.id,
                    progressMessage.message_id,
                    'No budgets are available for this account.'
                );
                return;
            }

            this.#selectedBudgets.set(key, budget.id);
            const budgetQuery = { budgetId: budget.id };
            const [categories, currencies, vendors] = await Promise.all([
                client.categories.list({
                    query: { ...budgetQuery, activeOnly: true }
                }),
                client.currencies.list(),
                client.vendors.list({
                    query: { ...budgetQuery, limit: 100 }
                })
            ]);

            if (categories.length === 0) {
                await this.updateProgressMessage(
                    msg.chat.id,
                    progressMessage.message_id,
                    '🏷 Create at least one category in xpenser first.'
                );
                return;
            }

            const image = await this.downloadTelegramFile(media);
            const body: TransactionScanBody = {
                budgetId: budget.id,
                fileName: media.fileName,
                imageBase64: image.toString('base64'),
                mimeType: media.mimeType
            };
            await this.updateProgressMessage(
                msg.chat.id,
                progressMessage.message_id,
                'Scan queued.'
            );
            const job = await client.transactionScans.start({ body });
            const scan = await this.waitForScanJob(client, job, async event => {
                await this.updateProgressMessage(
                    msg.chat.id,
                    progressMessage.message_id,
                    scanProgressMessage(event)
                );
            });

            if (scan.drafts.length === 0) {
                await this.updateProgressMessage(
                    msg.chat.id,
                    progressMessage.message_id,
                    'No transactions found. Try a clearer receipt, invoice, or banking screenshot.'
                );
                return;
            }

            const session: ScanDraftSession = {
                kind: 'scan',
                step: 'review',
                budgetId: budget.id,
                budgetName: budget.name,
                me,
                categories,
                currencies,
                vendors,
                scan,
                attachment: body,
                values: valuesForScan(
                    scan,
                    me,
                    categories,
                    currencies,
                    budget.id
                ),
                decisions: {},
                index: 0,
                attachmentSubmitted: false,
                categoryPage: 0,
                vendorPage: 0
            };
            this.#sessions.set(key, session);
            await this.updateProgressMessage(
                msg.chat.id,
                progressMessage.message_id,
                scan.drafts.length === 1
                    ? 'Found 1 transaction for review.'
                    : `Found ${scan.drafts.length} transactions for review.`
            );
            await this.sendScanReviewPrompt(msg.chat.id, session);
        } catch (err) {
            await this.updateProgressMessage(
                msg.chat.id,
                progressMessage.message_id,
                apiErrorMessage(err) ??
                    (err instanceof Error
                        ? err.message
                        : 'Could not scan the image. Try again.')
            );
        }
    }

    async cancel(msg: TelegramBot.Message): Promise<void> {
        const user = telegramUser(msg.from);
        if (user) {
            this.#sessions.delete(sessionKey(msg.chat.id, user.telegramUserId));
        }
        await this.#bot.sendMessage(msg.chat.id, 'Cancelled.', {
            reply_markup: quickAddReplyKeyboard()
        });
    }

    async handleCallback(query: TelegramBot.CallbackQuery): Promise<void> {
        const chatId = query.message?.chat.id;
        const data = query.data;
        const user = telegramUser(query.from);
        if (!chatId || !data || !user) {
            return;
        }

        await this.#bot.answerCallbackQuery(query.id).catch(() => undefined);
        const key = sessionKey(chatId, user.telegramUserId);

        if (data === cancelCallback) {
            this.#sessions.delete(key);
            await this.#bot.sendMessage(chatId, 'Cancelled.', {
                reply_markup: quickAddReplyKeyboard()
            });
            return;
        }

        if (data.startsWith(budgetSelectCallbackPrefix)) {
            await this.selectBudget(chatId, user, key, data);
            return;
        }

        const draft = this.#sessions.get(key);
        if (!draft) {
            await this.#bot.sendMessage(
                chatId,
                'Tap Add to start, or send an image to scan.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
            return;
        }

        if (draft.kind === 'scan') {
            await this.handleScanCallback(chatId, user, key, draft, data);
            return;
        }

        await this.handleManualCallback(chatId, user, key, draft, data);
    }

    async selectBudget(
        chatId: number,
        user: TelegramUserBody,
        key: string,
        data: string
    ): Promise<void> {
        const budgetId = Number(data.slice(budgetSelectCallbackPrefix.length));
        if (!Number.isSafeInteger(budgetId) || budgetId <= 0) {
            await this.#bot.sendMessage(
                chatId,
                'Budget is no longer available.'
            );
            return;
        }

        try {
            const me = await (await this.userClient(user)).auth.me();
            const budget = me.budgets.find(item => item.id === budgetId);
            if (!budget) {
                await this.#bot.sendMessage(
                    chatId,
                    'Budget is no longer available.'
                );
                return;
            }

            this.#selectedBudgets.set(key, budget.id);
            this.#sessions.delete(key);
            await this.#bot.sendMessage(
                chatId,
                `Active budget: ${budget.name}. Tap Add or send an image to continue.`,
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
        } catch (err) {
            await this.#bot.sendMessage(
                chatId,
                apiErrorMessage(err) ?? 'Could not change budget.'
            );
        }
    }

    async handleManualCallback(
        chatId: number,
        user: TelegramUserBody,
        key: string,
        draft: ManualDraft,
        data: string
    ): Promise<void> {
        if (
            draft.step === 'vendor' &&
            data.startsWith(vendorPageCallbackPrefix)
        ) {
            const page = Number(data.slice(vendorPageCallbackPrefix.length));
            const next: ManualDraft = { ...draft, page };
            this.#sessions.set(key, next);
            await this.sendVendorPrompt(chatId, next);
            return;
        }

        if (draft.step === 'vendor' && data === vendorSearchCallback) {
            this.#sessions.set(key, { ...draft, step: 'vendor-search' });
            await this.#bot.sendMessage(
                chatId,
                '🏬 Send vendor search text, or /cancel to stop.'
            );
            return;
        }

        if (draft.step === 'vendor' && data === vendorNoneCallback) {
            await this.setManualVendor(chatId, key, draft, null);
            return;
        }

        if (
            draft.step === 'vendor' &&
            data.startsWith(vendorSelectCallbackPrefix)
        ) {
            const vendorId = Number(
                data.slice(vendorSelectCallbackPrefix.length)
            );
            if (!draft.vendors.some(vendor => vendor.id === vendorId)) {
                await this.#bot.sendMessage(
                    chatId,
                    'Vendor is no longer available.'
                );
                return;
            }
            await this.setManualVendor(chatId, key, draft, vendorId);
            return;
        }

        if (draft.step === 'category' && data.startsWith('catpage:')) {
            const page = Number(data.slice('catpage:'.length));
            const next: ManualDraft = { ...draft, page };
            this.#sessions.set(key, next);
            await this.sendCategoryPrompt(chatId, next);
            return;
        }

        if (draft.step === 'category' && data.startsWith('cat:')) {
            const categoryId = Number(data.slice('cat:'.length));
            const category = draft.categories.find(
                item => item.id === categoryId
            );
            if (!category) {
                await this.#bot.sendMessage(
                    chatId,
                    'Category is no longer available.'
                );
                return;
            }

            this.#sessions.set(key, {
                kind: 'manual',
                step: 'note-choice',
                budgetId: draft.budgetId,
                budgetName: draft.budgetName,
                amount: draft.amount,
                currency: draft.currency,
                vendorId: draft.vendorId,
                category
            });
            await this.askForDescription(chatId);
            return;
        }

        if (draft.step === 'currency' && data.startsWith('cur:')) {
            await this.setCurrency(
                chatId,
                key,
                user,
                draft,
                data.slice('cur:'.length)
            );
            return;
        }

        if (draft.step === 'note-choice' && data === noteSkipCallback) {
            await this.saveTransaction(chatId, user, key, draft);
            return;
        }

        if (draft.step === 'note-choice' && data === noteAddCallback) {
            this.#sessions.set(key, {
                ...draft,
                step: 'note-text'
            });
            await this.#bot.sendMessage(
                chatId,
                `📝 Send the description. Keep it under ${FieldLimits.transactionNote} characters.`
            );
            return;
        }

        if (draft.step === 'amount') {
            await this.#bot.sendMessage(
                chatId,
                '💸 Send the amount first, for example 12.50.'
            );
            return;
        }

        if (draft.step === 'currency') {
            await this.#bot.sendMessage(chatId, '💱 Choose a currency.', {
                reply_markup: currencyKeyboard(
                    draft.me,
                    draft.currencies,
                    draft.budgetId
                )
            });
            return;
        }

        if (draft.step === 'vendor' || draft.step === 'vendor-search') {
            await this.sendVendorPrompt(chatId, {
                ...draft,
                step: 'vendor',
                page: 0
            });
            return;
        }

        if (draft.step === 'category') {
            await this.sendCategoryPrompt(chatId, draft);
            return;
        }

        if (draft.step === 'note-choice') {
            await this.askForDescription(chatId);
            return;
        }

        if (draft.step === 'note-text') {
            await this.#bot.sendMessage(
                chatId,
                '📝 Send the description text, or /cancel to stop.'
            );
        }
    }

    async handleScanCallback(
        chatId: number,
        user: TelegramUserBody,
        key: string,
        session: ScanDraftSession,
        data: string
    ): Promise<void> {
        const draft = scanDraftAt(session);
        const values = scanValuesAt(session);
        if (!draft || !values) {
            this.#sessions.delete(key);
            await this.#bot.sendMessage(chatId, 'Scan session expired.', {
                reply_markup: quickAddReplyKeyboard()
            });
            return;
        }

        if (
            session.decisions[draft.id] &&
            (data === scanConfirmCallback || data === scanDiscardCallback)
        ) {
            await this.#bot.sendMessage(
                chatId,
                'This scanned transaction was already reviewed.'
            );
            return;
        }

        if (data === scanConfirmCallback) {
            await this.confirmScanDraft(
                chatId,
                user,
                key,
                session,
                draft,
                values
            );
            return;
        }

        if (data === scanDiscardCallback) {
            await this.discardScanDraft(chatId, user, key, session, draft);
            return;
        }

        if (data === scanPreviousCallback || data === scanNextCallback) {
            const delta = data === scanPreviousCallback ? -1 : 1;
            const index = Math.min(
                Math.max(session.index + delta, 0),
                session.scan.drafts.length - 1
            );
            const next: ScanDraftSession = {
                ...session,
                step: 'review',
                index,
                categoryPage: 0,
                vendorPage: 0,
                vendorQuery: undefined
            };
            this.#sessions.set(key, next);
            await this.sendScanReviewPrompt(chatId, next);
            return;
        }

        if (data === scanEditAmountCallback) {
            const next: ScanDraftSession = { ...session, step: 'edit-amount' };
            this.#sessions.set(key, next);
            await this.#bot.sendMessage(
                chatId,
                '💸 Send the amount, for example 12.50.'
            );
            return;
        }

        if (data === scanEditCurrencyCallback) {
            const next: ScanDraftSession = {
                ...session,
                step: 'edit-currency'
            };
            this.#sessions.set(key, next);
            await this.#bot.sendMessage(chatId, '💱 Choose currency.', {
                reply_markup: currencyKeyboard(
                    session.me,
                    session.currencies,
                    session.budgetId
                )
            });
            return;
        }

        if (data === scanEditCategoryCallback) {
            const next: ScanDraftSession = {
                ...session,
                step: 'edit-category',
                categoryPage: 0
            };
            this.#sessions.set(key, next);
            await this.#bot.sendMessage(chatId, '🏷 Choose a category.', {
                reply_markup: categoryKeyboard(session.categories, 0)
            });
            return;
        }

        if (data === scanEditVendorCallback) {
            const next: ScanDraftSession = {
                ...session,
                step: 'edit-vendor',
                vendorPage: 0,
                vendorQuery: undefined
            };
            this.#sessions.set(key, next);
            await this.sendScanVendorPrompt(chatId, next);
            return;
        }

        if (data === scanEditDateCallback) {
            const next: ScanDraftSession = { ...session, step: 'edit-date' };
            this.#sessions.set(key, next);
            await this.#bot.sendMessage(
                chatId,
                `📅 Send date and time as YYYY-MM-DD HH:mm. Current value: ${dateToLocalDateTimeInput(values.occurredAt, session.me.timezone).replace('T', ' ')}.`
            );
            return;
        }

        if (data === scanEditNoteCallback) {
            const next: ScanDraftSession = { ...session, step: 'edit-note' };
            this.#sessions.set(key, next);
            await this.#bot.sendMessage(
                chatId,
                '📝 Send the note text, or send - to clear it.'
            );
            return;
        }

        if (session.step === 'edit-category' && data.startsWith('catpage:')) {
            const page = Number(data.slice('catpage:'.length));
            const next: ScanDraftSession = { ...session, categoryPage: page };
            this.#sessions.set(key, next);
            await this.#bot.sendMessage(chatId, '🏷 Choose a category.', {
                reply_markup: categoryKeyboard(session.categories, page)
            });
            return;
        }

        if (session.step === 'edit-category' && data.startsWith('cat:')) {
            const categoryId = Number(data.slice('cat:'.length));
            const category = session.categories.find(
                item => item.id === categoryId
            );
            if (!category) {
                await this.#bot.sendMessage(
                    chatId,
                    'Category is no longer available.'
                );
                return;
            }
            const next = updateScanValues(session, draft.id, {
                ...values,
                categoryId,
                transactionType: category.type
            });
            const review: ScanDraftSession = {
                ...next,
                step: 'review',
                categoryPage: 0
            };
            this.#sessions.set(key, review);
            await this.sendScanReviewPrompt(chatId, review);
            return;
        }

        if (session.step === 'edit-currency' && data.startsWith('cur:')) {
            const currency = data.slice('cur:'.length).trim().toUpperCase();
            if (
                !preferredCurrencies(
                    session.me,
                    session.currencies,
                    session.budgetId
                ).includes(currency)
            ) {
                await this.#bot.sendMessage(
                    chatId,
                    'Currency is no longer available.'
                );
                return;
            }
            const review: ScanDraftSession = {
                ...updateScanValues(session, draft.id, { ...values, currency }),
                step: 'review'
            };
            this.#sessions.set(key, review);
            await this.sendScanReviewPrompt(chatId, review);
            return;
        }

        if (
            session.step === 'edit-vendor' &&
            data.startsWith(vendorPageCallbackPrefix)
        ) {
            const page = Number(data.slice(vendorPageCallbackPrefix.length));
            const next: ScanDraftSession = { ...session, vendorPage: page };
            this.#sessions.set(key, next);
            await this.sendScanVendorPrompt(chatId, next);
            return;
        }

        if (session.step === 'edit-vendor' && data === vendorSearchCallback) {
            const next: ScanDraftSession = {
                ...session,
                step: 'edit-vendor-search'
            };
            this.#sessions.set(key, next);
            await this.#bot.sendMessage(
                chatId,
                '🏬 Send vendor search text, or /cancel to stop.'
            );
            return;
        }

        if (session.step === 'edit-vendor' && data === vendorNoneCallback) {
            const review: ScanDraftSession = {
                ...updateScanValues(session, draft.id, {
                    ...values,
                    vendorId: null
                }),
                step: 'review',
                vendorPage: 0,
                vendorQuery: undefined
            };
            this.#sessions.set(key, review);
            await this.sendScanReviewPrompt(chatId, review);
            return;
        }

        if (
            session.step === 'edit-vendor' &&
            data.startsWith(vendorSelectCallbackPrefix)
        ) {
            const vendorId = Number(
                data.slice(vendorSelectCallbackPrefix.length)
            );
            const vendor = session.vendors.find(item => item.id === vendorId);
            if (!vendor) {
                await this.#bot.sendMessage(
                    chatId,
                    'Vendor is no longer available.'
                );
                return;
            }
            const nextValues: ScanDraftValues = {
                ...values,
                vendorId
            };
            const category = vendor.suggestedCategoryId
                ? categoryById(session.categories, vendor.suggestedCategoryId)
                : undefined;
            const review: ScanDraftSession = {
                ...updateScanValues(session, draft.id, {
                    ...nextValues,
                    ...(category
                        ? {
                              categoryId: category.id,
                              transactionType: category.type
                          }
                        : {})
                }),
                step: 'review',
                vendorPage: 0,
                vendorQuery: undefined
            };
            this.#sessions.set(key, review);
            await this.sendScanReviewPrompt(chatId, review);
            return;
        }

        await this.sendScanReviewPrompt(chatId, session);
    }

    async handleText(msg: TelegramBot.Message): Promise<void> {
        const user = telegramUser(msg.from);
        const text = msg.text?.trim();
        if (!user || !text) {
            return;
        }

        const key = sessionKey(msg.chat.id, user.telegramUserId);
        const draft = this.#sessions.get(key);
        if (!draft) {
            await this.#bot.sendMessage(
                msg.chat.id,
                'Tap Add to start, or send an image to scan.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
            return;
        }

        if (draft.kind === 'scan') {
            await this.handleScanText(msg.chat.id, key, draft, text);
            return;
        }

        await this.handleManualText(msg.chat.id, user, key, draft, text);
    }

    async handleManualText(
        chatId: number,
        user: TelegramUserBody,
        key: string,
        draft: ManualDraft,
        text: string
    ): Promise<void> {
        if (draft.step === 'amount') {
            const amount = parseAmount(text);
            if (!amount) {
                await this.#bot.sendMessage(
                    chatId,
                    '💸 Enter a positive amount, for example 12.50.'
                );
                return;
            }
            const next: ManualDraft = {
                kind: 'manual',
                step: 'currency',
                budgetId: draft.budgetId,
                budgetName: draft.budgetName,
                me: draft.me,
                categories: draft.categories,
                currencies: draft.currencies,
                vendors: draft.vendors,
                amount
            };
            this.#sessions.set(key, next);
            await this.#bot.sendMessage(chatId, '💱 Choose currency.', {
                reply_markup: currencyKeyboard(
                    draft.me,
                    draft.currencies,
                    draft.budgetId
                )
            });
            return;
        }

        if (draft.step === 'currency') {
            await this.#bot.sendMessage(
                chatId,
                '💱 Please choose a currency button.',
                {
                    reply_markup: currencyKeyboard(
                        draft.me,
                        draft.currencies,
                        draft.budgetId
                    )
                }
            );
            return;
        }

        if (draft.step === 'vendor-search') {
            const matches = filteredVendors(draft.vendors, text);
            const next: ManualDraft = {
                ...draft,
                step: 'vendor',
                page: 0,
                query: text
            };
            this.#sessions.set(key, next);
            await this.#bot.sendMessage(
                chatId,
                matches.length === 0
                    ? 'No matching vendors. Choose No vendor or search again.'
                    : '🏬 Choose a vendor.',
                {
                    reply_markup: vendorKeyboard(matches, 0, {
                        includeSearch: true
                    })
                }
            );
            return;
        }

        if (draft.step === 'vendor') {
            await this.sendVendorPrompt(chatId, draft);
            return;
        }

        if (draft.step === 'category') {
            await this.#bot.sendMessage(
                chatId,
                '🏷 Please choose a category button.',
                {
                    reply_markup: categoryKeyboard(draft.categories, draft.page)
                }
            );
            return;
        }

        if (draft.step === 'note-choice') {
            await this.askForDescription(chatId);
            return;
        }

        if (draft.step === 'note-text') {
            const error = noteLengthError(text);
            if (error) {
                await this.#bot.sendMessage(chatId, `📝 ${error}`);
                return;
            }
            await this.saveTransaction(chatId, user, key, draft, text);
        }
    }

    async handleScanText(
        chatId: number,
        key: string,
        session: ScanDraftSession,
        text: string
    ): Promise<void> {
        const draft = scanDraftAt(session);
        const values = scanValuesAt(session);
        if (!draft || !values) {
            this.#sessions.delete(key);
            await this.#bot.sendMessage(chatId, 'Scan session expired.', {
                reply_markup: quickAddReplyKeyboard()
            });
            return;
        }

        if (session.step === 'edit-amount') {
            const amount = parseAmount(text);
            if (!amount) {
                await this.#bot.sendMessage(
                    chatId,
                    '💸 Enter a positive amount, for example 12.50.'
                );
                return;
            }
            const next: ScanDraftSession = {
                ...updateScanValues(session, draft.id, { ...values, amount }),
                step: 'review'
            };
            this.#sessions.set(key, next);
            await this.sendScanReviewPrompt(chatId, next);
            return;
        }

        if (session.step === 'edit-date') {
            const occurredAt = parseTelegramDateTime(text, session.me.timezone);
            if (!occurredAt) {
                await this.#bot.sendMessage(
                    chatId,
                    '📅 Send date and time as YYYY-MM-DD HH:mm, for example 2026-06-06 14:30.'
                );
                return;
            }
            const next: ScanDraftSession = {
                ...updateScanValues(session, draft.id, {
                    ...values,
                    occurredAt
                }),
                step: 'review'
            };
            this.#sessions.set(key, next);
            await this.sendScanReviewPrompt(chatId, next);
            return;
        }

        if (session.step === 'edit-note') {
            const note = text === '-' ? '' : text;
            const error = noteLengthError(note);
            if (error) {
                await this.#bot.sendMessage(chatId, `📝 ${error}`);
                return;
            }
            const next: ScanDraftSession = {
                ...updateScanValues(session, draft.id, { ...values, note }),
                step: 'review'
            };
            this.#sessions.set(key, next);
            await this.sendScanReviewPrompt(chatId, next);
            return;
        }

        if (session.step === 'edit-vendor-search') {
            const matches = filteredVendors(session.vendors, text);
            const next: ScanDraftSession = {
                ...session,
                step: 'edit-vendor',
                vendorPage: 0,
                vendorQuery: text
            };
            this.#sessions.set(key, next);
            await this.#bot.sendMessage(
                chatId,
                matches.length === 0
                    ? 'No matching vendors. Choose No vendor or search again.'
                    : '🏬 Choose a vendor.',
                {
                    reply_markup: vendorKeyboard(matches, 0, {
                        includeSearch: true
                    })
                }
            );
            return;
        }

        await this.sendScanReviewPrompt(chatId, session);
    }

    async setCurrency(
        chatId: number,
        key: string,
        user: TelegramUserBody,
        draft: Extract<ManualDraft, { readonly step: 'currency' }>,
        value: string
    ): Promise<void> {
        const currency = value.trim().toUpperCase();
        if (
            !preferredCurrencies(
                draft.me,
                draft.currencies,
                draft.budgetId
            ).includes(currency)
        ) {
            await this.#bot.sendMessage(
                chatId,
                '💱 Currency is no longer available. Tap Add to restart.'
            );
            return;
        }

        try {
            const budget = activeBudget(draft.me, draft.budgetId);
            const defaultCurrency = (
                budget?.defaultCurrency ?? draft.me.defaultCurrency
            )
                .trim()
                .toUpperCase();
            const conversion =
                currency === defaultCurrency
                    ? {
                          amount: draft.amount,
                          currency,
                          defaultCurrencyAmount: draft.amount,
                          defaultCurrency,
                          exchangeRate: 1,
                          exchangeRateDate: rateDate()
                      }
                    : await (await this.userClient(user)).currencies.convert({
                          query: {
                              amount: draft.amount,
                              budgetId: draft.budgetId,
                              currency,
                              occurredAt: new Date()
                          }
                      });
            await this.#bot.sendMessage(
                chatId,
                `💱 ${formatTelegramAmount(
                    conversion.amount,
                    conversion.currency
                )} is ${formatTelegramAmount(
                    conversion.defaultCurrencyAmount,
                    conversion.defaultCurrency
                )} in your primary currency.`
            );

            if (draft.vendors.length === 0) {
                await this.setManualVendor(
                    chatId,
                    key,
                    {
                        kind: 'manual',
                        step: 'vendor',
                        budgetId: draft.budgetId,
                        budgetName: draft.budgetName,
                        me: draft.me,
                        categories: draft.categories,
                        currencies: draft.currencies,
                        vendors: draft.vendors,
                        amount: draft.amount,
                        currency,
                        page: 0
                    },
                    null
                );
                return;
            }

            const next: ManualDraft = {
                kind: 'manual',
                step: 'vendor',
                budgetId: draft.budgetId,
                budgetName: draft.budgetName,
                me: draft.me,
                categories: draft.categories,
                currencies: draft.currencies,
                vendors: draft.vendors,
                amount: draft.amount,
                currency,
                page: 0
            };
            this.#sessions.set(key, next);
            await this.sendVendorPrompt(chatId, next);
        } catch (err) {
            await this.#bot.sendMessage(
                chatId,
                apiErrorMessage(err) ??
                    'Could not get this exchange rate. Choose another currency or try again.',
                {
                    reply_markup: currencyKeyboard(
                        draft.me,
                        draft.currencies,
                        draft.budgetId
                    )
                }
            );
        }
    }

    async setManualVendor(
        chatId: number,
        key: string,
        draft: Extract<ManualDraft, { readonly step: 'vendor' }>,
        vendorId: number | null
    ): Promise<void> {
        const vendor = vendorById(draft.vendors, vendorId);
        const next: ManualDraft = {
            kind: 'manual',
            step: 'category',
            budgetId: draft.budgetId,
            budgetName: draft.budgetName,
            me: draft.me,
            categories: categoriesWithPreferredFirst(
                draft.categories,
                vendor?.suggestedCategoryId
            ),
            currencies: draft.currencies,
            amount: draft.amount,
            currency: draft.currency,
            vendorId,
            page: 0
        };
        this.#sessions.set(key, next);
        await this.sendCategoryPrompt(chatId, next);
    }

    async saveTransaction(
        chatId: number,
        user: TelegramUserBody,
        key: string,
        draft: Extract<
            ManualDraft,
            { readonly step: 'note-choice' | 'note-text' }
        >,
        note?: string
    ): Promise<void> {
        try {
            const client = await this.userClient(user);
            const transaction = await client.transactions.create({
                body: {
                    budgetId: draft.budgetId,
                    categoryId: draft.category.id,
                    vendorId: draft.vendorId,
                    amount: draft.amount,
                    currency: draft.currency,
                    occurredAt: new Date(),
                    note
                }
            });
            this.#sessions.delete(key);
            await this.#bot.sendMessage(
                chatId,
                `✅ Saved ${savedTransactionSummary(transaction)}`,
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
        } catch (err) {
            await this.#bot.sendMessage(
                chatId,
                apiErrorMessage(err) ??
                    'Could not save transaction. Tap Add to try again.',
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
        }
    }

    async configureBotCommands(): Promise<void> {
        try {
            await this.#bot.setMyCommands([
                {
                    command: addCommand.slice(1),
                    description: 'Add a transaction'
                },
                {
                    command: budgetCommand.slice(1),
                    description: 'Choose the active budget'
                },
                {
                    command: 'cancel',
                    description: 'Cancel the current transaction'
                },
                {
                    command: 'start',
                    description: 'Connect or restart the bot'
                }
            ]);
        } catch (err) {
            this.#logger.error(toError(err), 'Could not set bot commands', {});
        }
    }

    async askForDescription(chatId: number): Promise<void> {
        await this.#bot.sendMessage(chatId, '📝 Add a description?', {
            reply_markup: noteKeyboard()
        });
    }

    async sendCategoryPrompt(
        chatId: number,
        draft: Extract<ManualDraft, { readonly step: 'category' }>
    ): Promise<void> {
        await this.#bot.sendMessage(chatId, '🏷 Choose a category.', {
            reply_markup: categoryKeyboard(draft.categories, draft.page)
        });
    }

    async sendVendorPrompt(
        chatId: number,
        draft: Extract<ManualDraft, { readonly step: 'vendor' }>
    ): Promise<void> {
        const vendors = filteredVendors(draft.vendors, draft.query);
        const prefix = draft.query ? ` matching "${draft.query}"` : '';
        await this.#bot.sendMessage(chatId, `🏬 Choose a vendor${prefix}.`, {
            reply_markup: vendorKeyboard(vendors, draft.page, {
                includeSearch: true
            })
        });
    }

    async sendScanVendorPrompt(
        chatId: number,
        session: ScanDraftSession
    ): Promise<void> {
        const vendors = filteredVendors(session.vendors, session.vendorQuery);
        const prefix = session.vendorQuery
            ? ` matching "${session.vendorQuery}"`
            : '';
        await this.#bot.sendMessage(chatId, `🏬 Choose a vendor${prefix}.`, {
            reply_markup: vendorKeyboard(vendors, session.vendorPage, {
                includeSearch: true
            })
        });
    }

    scanReviewText(session: ScanDraftSession): string {
        const draft = scanDraftAt(session);
        const values = scanValuesAt(session);
        if (!draft || !values) {
            return 'Scan session expired.';
        }

        const category = categoryById(session.categories, values.categoryId);
        const vendor = vendorById(session.vendors, values.vendorId);
        const suggestedCategory = draft.suggestedCategory
            ? `${draft.suggestedCategory.name} (${draft.suggestedCategory.type})`
            : undefined;
        const suggestedVendor =
            !vendor && draft.suggestedVendorName
                ? draft.suggestedVendorName
                : undefined;
        const lines = [
            `Transaction ${session.index + 1} of ${session.scan.drafts.length}`,
            `Budget: ${session.budgetName}`,
            `Source: ${session.scan.documentKind.replace('_', ' ')}`,
            `Status: ${session.decisions[draft.id] ?? 'pending'}`,
            '',
            `Amount: ${
                values.amount
                    ? formatTelegramAmount(values.amount, values.currency)
                    : 'Not set'
            }`,
            `Category: ${category?.displayName ?? 'Not set'}`,
            `Vendor: ${vendor ? vendorLabel(vendor) : 'No vendor'}`,
            `Date: ${formatTelegramDate(values.occurredAt, session.me.timezone)}`,
            `Note: ${values.note || 'None'}`,
            '',
            `Evidence: ${draft.evidence || 'No supporting text was returned.'}`,
            `Confidence: ${draft.confidence.overall}`
        ];

        if (suggestedCategory) {
            lines.push(`Suggested category: ${suggestedCategory}`);
        }
        if (suggestedVendor) {
            lines.push(`Suggested vendor: ${suggestedVendor}`);
        }
        if (draft.possibleDuplicateTransactionIds.length > 0) {
            lines.push(
                `Possible duplicate: ${draft.possibleDuplicateTransactionIds.join(', ')}`
            );
        }
        if (session.scan.warnings.length > 0) {
            lines.push(
                '',
                ...session.scan.warnings.map(warning => `Warning: ${warning}`)
            );
        }

        return lines.join('\n');
    }

    async sendScanReviewPrompt(
        chatId: number,
        session: ScanDraftSession
    ): Promise<void> {
        await this.#bot.sendMessage(chatId, this.scanReviewText(session), {
            reply_markup: scanReviewKeyboard(session)
        });
    }

    async confirmScanDraft(
        chatId: number,
        user: TelegramUserBody,
        key: string,
        session: ScanDraftSession,
        draft: TransactionScanDraft,
        values: ScanDraftValues
    ): Promise<void> {
        if (!values.amount) {
            await this.#bot.sendMessage(
                chatId,
                '💸 Set an amount before confirming.'
            );
            return;
        }
        if (!values.categoryId) {
            await this.#bot.sendMessage(
                chatId,
                '🏷 Set a category before confirming.'
            );
            return;
        }

        try {
            const client = await this.userClient(user);
            const transaction = await client.transactions.create({
                body: {
                    budgetId: session.budgetId,
                    amount: values.amount,
                    categoryId: values.categoryId,
                    currency: values.currency,
                    occurredAt: values.occurredAt,
                    vendorId: values.vendorId,
                    note: values.note.trim() || undefined
                }
            });
            await client.transactionScans.decide({
                params: {
                    scanId: session.scan.scanId,
                    itemId: draft.id
                },
                body: {
                    decision: 'confirmed',
                    transactionId: transaction.id,
                    correctedTransaction: {
                        amount: values.amount,
                        categoryId: values.categoryId,
                        currency: values.currency,
                        occurredAt: values.occurredAt,
                        vendorId: values.vendorId,
                        note: values.note.trim() || null
                    },
                    attachment: session.attachmentSubmitted
                        ? undefined
                        : session.attachment
                }
            });

            const decided: ScanDraftSession = {
                ...session,
                step: 'review',
                decisions: {
                    ...session.decisions,
                    [draft.id]: 'confirmed'
                },
                attachmentSubmitted: true
            };
            await this.#bot.sendMessage(
                chatId,
                `✅ Saved ${savedTransactionSummary(transaction)}`
            );
            await this.advanceScanAfterDecision(chatId, key, decided);
        } catch (err) {
            await this.#bot.sendMessage(
                chatId,
                apiErrorMessage(err) ??
                    'Could not save this scanned transaction.'
            );
        }
    }

    async discardScanDraft(
        chatId: number,
        user: TelegramUserBody,
        key: string,
        session: ScanDraftSession,
        draft: TransactionScanDraft
    ): Promise<void> {
        try {
            const client = await this.userClient(user);
            await client.transactionScans.decide({
                params: {
                    scanId: session.scan.scanId,
                    itemId: draft.id
                },
                body: { decision: 'discarded' }
            });
            await this.advanceScanAfterDecision(chatId, key, {
                ...session,
                step: 'review',
                decisions: {
                    ...session.decisions,
                    [draft.id]: 'discarded'
                }
            });
        } catch (err) {
            await this.#bot.sendMessage(
                chatId,
                apiErrorMessage(err) ??
                    'Could not discard this scanned transaction.'
            );
        }
    }

    async advanceScanAfterDecision(
        chatId: number,
        key: string,
        session: ScanDraftSession
    ): Promise<void> {
        const nextIndex = nextPendingScanIndex(session);
        if (nextIndex === undefined) {
            const confirmed = Object.values(session.decisions).filter(
                value => value === 'confirmed'
            ).length;
            const discarded = Object.values(session.decisions).filter(
                value => value === 'discarded'
            ).length;
            this.#sessions.delete(key);
            await this.#bot.sendMessage(
                chatId,
                `Scan reviewed. Confirmed ${confirmed} and discarded ${discarded}.`,
                {
                    reply_markup: quickAddReplyKeyboard()
                }
            );
            return;
        }

        const next: ScanDraftSession = {
            ...session,
            index: nextIndex,
            categoryPage: 0,
            vendorPage: 0,
            vendorQuery: undefined
        };
        this.#sessions.set(key, next);
        await this.sendScanReviewPrompt(chatId, next);
    }

    async downloadTelegramFile(media: TelegramScanMedia): Promise<Buffer> {
        const stream = this.#bot.getFileStream(media.fileId);
        if (!(stream instanceof Readable)) {
            throw new Error('Could not download the image. Try again.');
        }

        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of stream) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > TransactionScanLimits.maxImageBytes) {
                throw new Error('Image must be 10 MB or smaller.');
            }
            chunks.push(buffer);
        }

        if (size === 0) {
            throw new Error('Choose an image to scan.');
        }

        return Buffer.concat(chunks, size);
    }

    async waitForScanJob(
        client: XpenserClient,
        job: TransactionScanJobResponse,
        onProgress: (event: TransactionScanProgressEvent) => Promise<void>
    ): Promise<TransactionScanResponse> {
        const subscription = client.transactionScans.progress({
            query: { jobId: job.jobId, token: job.token },
            reconnect: { maxRetries: 3, backoffLimit: 5_000 }
        });

        try {
            for await (const event of subscription) {
                await onProgress(event);
                if (event.stage === 'failed') {
                    throw new Error(
                        event.error ?? 'Could not scan the image. Try again.'
                    );
                }
                if (event.stage === 'complete' && event.scan) {
                    return event.scan;
                }
            }
        } finally {
            subscription.close();
        }

        throw new Error('Could not connect to scan progress. Try again.');
    }

    async updateProgressMessage(
        chatId: number,
        messageId: number,
        text: string
    ): Promise<void> {
        try {
            await this.#bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId
            });
        } catch {
            await this.#bot.sendMessage(chatId, text);
        }
    }

    async userClient(user: TelegramUserBody): Promise<XpenserClient> {
        const response = await this.#serviceClient.telegram.token({
            body: { telegramUser: user }
        });
        return createXpenserClient({
            baseUrl: this.config.apiBaseUrl,
            getToken: () => response.token
        });
    }

    isPrivateChat(chat: TelegramBot.Chat): boolean {
        return chat.type === 'private';
    }
}
