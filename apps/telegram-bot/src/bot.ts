import type { Logger } from '@cleverbrush/log';
import { createXpenserClient, type XpenserClient } from '@xpenser/client';
import type { Category, Currency, UserPreference } from '@xpenser/contracts';
import TelegramBot from 'node-telegram-bot-api';
import type { BotConfig } from './config.js';
import {
    addCommand,
    cancelCallback,
    categoriesByRecentUse,
    currencyKeyboard,
    isAddButtonText,
    noteAddCallback,
    noteSkipCallback,
    parseAmount,
    parseStartToken,
    preferredCurrencies,
    quickAddReplyKeyboard,
    reversalKeyboard,
    reversalNoCallback,
    reversalYesCallback
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

type Draft =
    | {
          readonly step: 'amount';
          readonly me: UserPreference;
          readonly categories: readonly Category[];
          readonly currencies: readonly Currency[];
      }
    | {
          readonly step: 'currency';
          readonly me: UserPreference;
          readonly categories: readonly Category[];
          readonly currencies: readonly Currency[];
          readonly amount: number;
      }
    | {
          readonly step: 'category';
          readonly me: UserPreference;
          readonly categories: readonly Category[];
          readonly currencies: readonly Currency[];
          readonly amount: number;
          readonly currency: string;
          readonly page: number;
      }
    | {
          readonly step: 'reversal';
          readonly category: Category;
          readonly currency: string;
          readonly amount: number;
      }
    | {
          readonly step: 'note-choice';
          readonly category: Category;
          readonly currency: string;
          readonly amount: number;
          readonly effect: 'normal' | 'reversal';
      }
    | {
          readonly step: 'note-text';
          readonly category: Category;
          readonly currency: string;
          readonly amount: number;
          readonly effect: 'normal' | 'reversal';
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
    return `${category.type === 'income' ? '💰' : '💸'} ${category.name}`;
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
            text: '◀ Previous',
            callback_data: `catpage:${safePage - 1}`
        });
    }
    if (safePage < pageCount - 1) {
        navigation.push({
            text: 'Next ▶',
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

function formatTelegramAmount(amount: number, currency: string): string {
    return `${amount.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    })} ${currency}`;
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

export class XpenserTelegramBot {
    readonly #bot: TelegramBot;
    readonly #serviceClient: XpenserClient;
    readonly #sessions = new Map<string, Draft>();
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
                'Hi! Tap Add when you want to record a transaction.',
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
                `✅ Telegram connected to xpenser account ${result.email}. Tap Add to create a transaction.`,
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
            const [me, categories, currencies, recentTransactions] =
                await Promise.all([
                    client.auth.me(),
                    client.categories.list(),
                    client.currencies.list(),
                    client.transactions.list({
                        query: { direction: 'desc', limit: 100, page: 1 }
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

            if (preferredCurrencies(me, currencies).length === 0) {
                await this.#bot.sendMessage(
                    msg.chat.id,
                    '💱 Set a default or favorite currency in xpenser Preferences first.',
                    {
                        reply_markup: quickAddReplyKeyboard()
                    }
                );
                return;
            }

            const draft: Draft = {
                step: 'amount',
                me,
                categories: categoriesByRecentUse(
                    categories,
                    recentTransactions.items
                ),
                currencies
            };
            this.#sessions.set(
                sessionKey(msg.chat.id, user.telegramUserId),
                draft
            );
            await this.#bot.sendMessage(
                msg.chat.id,
                '💸 How much is the transaction? Send a number like 12.50.'
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

        const draft = this.#sessions.get(key);
        if (!draft) {
            await this.#bot.sendMessage(chatId, 'Tap Add to start.', {
                reply_markup: quickAddReplyKeyboard()
            });
            return;
        }

        if (draft.step === 'category' && data.startsWith('catpage:')) {
            const page = Number(data.slice('catpage:'.length));
            const next: Draft = { ...draft, page };
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
                step: 'reversal',
                amount: draft.amount,
                currency: draft.currency,
                category
            });
            await this.askForReversal(chatId);
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

        if (draft.step === 'reversal' && data === reversalNoCallback) {
            const next: Draft = {
                ...draft,
                step: 'note-choice',
                effect: 'normal'
            };
            this.#sessions.set(key, next);
            await this.askForDescription(chatId);
            return;
        }

        if (draft.step === 'reversal' && data === reversalYesCallback) {
            const next: Draft = {
                ...draft,
                step: 'note-choice',
                effect: 'reversal'
            };
            this.#sessions.set(key, next);
            await this.askForDescription(chatId);
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
                '📝 Send the description. Keep it under 500 characters.'
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
                reply_markup: currencyKeyboard(draft.me, draft.currencies)
            });
            return;
        }

        if (draft.step === 'category') {
            await this.sendCategoryPrompt(chatId, draft);
            return;
        }

        if (draft.step === 'reversal') {
            await this.askForReversal(chatId);
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

    async handleText(msg: TelegramBot.Message): Promise<void> {
        const user = telegramUser(msg.from);
        const text = msg.text?.trim();
        if (!user || !text) {
            return;
        }

        const key = sessionKey(msg.chat.id, user.telegramUserId);
        const draft = this.#sessions.get(key);
        if (!draft) {
            await this.#bot.sendMessage(msg.chat.id, 'Tap Add to start.', {
                reply_markup: quickAddReplyKeyboard()
            });
            return;
        }

        if (draft.step === 'amount') {
            const amount = parseAmount(text);
            if (!amount) {
                await this.#bot.sendMessage(
                    msg.chat.id,
                    '💸 Enter a positive amount, for example 12.50.'
                );
                return;
            }
            const next: Draft = {
                step: 'currency',
                me: draft.me,
                categories: draft.categories,
                currencies: draft.currencies,
                amount
            };
            this.#sessions.set(key, next);
            await this.#bot.sendMessage(msg.chat.id, '💱 Choose currency.', {
                reply_markup: currencyKeyboard(draft.me, draft.currencies)
            });
            return;
        }

        if (draft.step === 'currency') {
            await this.#bot.sendMessage(
                msg.chat.id,
                '💱 Please choose a currency button.',
                {
                    reply_markup: currencyKeyboard(draft.me, draft.currencies)
                }
            );
            return;
        }

        if (draft.step === 'category') {
            await this.#bot.sendMessage(
                msg.chat.id,
                '🏷 Please choose a category button.',
                {
                    reply_markup: categoryKeyboard(draft.categories, draft.page)
                }
            );
            return;
        }

        if (draft.step === 'reversal') {
            await this.askForReversal(msg.chat.id);
            return;
        }

        if (draft.step === 'note-choice') {
            await this.askForDescription(msg.chat.id);
            return;
        }

        if (draft.step === 'note-text') {
            if (text.length > 500) {
                await this.#bot.sendMessage(
                    msg.chat.id,
                    '📝 Description is too long. Send up to 500 characters.'
                );
                return;
            }
            await this.saveTransaction(msg.chat.id, user, key, draft, text);
        }
    }

    async setCurrency(
        chatId: number,
        key: string,
        user: TelegramUserBody,
        draft: Extract<Draft, { readonly step: 'currency' }>,
        value: string
    ): Promise<void> {
        const currency = value.trim().toUpperCase();
        if (
            !preferredCurrencies(draft.me, draft.currencies).includes(currency)
        ) {
            await this.#bot.sendMessage(
                chatId,
                '💱 Currency is no longer available. Tap Add to restart.'
            );
            return;
        }

        try {
            const defaultCurrency = draft.me.defaultCurrency
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
                              currency,
                              occurredAt: new Date()
                          }
                      });
            const next: Draft = {
                step: 'category',
                me: draft.me,
                categories: draft.categories,
                currencies: draft.currencies,
                amount: draft.amount,
                currency,
                page: 0
            };
            this.#sessions.set(key, next);
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
            await this.sendCategoryPrompt(chatId, next);
        } catch (err) {
            await this.#bot.sendMessage(
                chatId,
                apiErrorMessage(err) ??
                    'Could not get this exchange rate. Choose another currency or try again.',
                {
                    reply_markup: currencyKeyboard(draft.me, draft.currencies)
                }
            );
        }
    }

    async saveTransaction(
        chatId: number,
        user: TelegramUserBody,
        key: string,
        draft: Extract<Draft, { readonly step: 'note-choice' | 'note-text' }>,
        note?: string
    ): Promise<void> {
        try {
            const client = await this.userClient(user);
            const transaction = await client.transactions.create({
                body: {
                    categoryId: draft.category.id,
                    amount: draft.amount,
                    currency: draft.currency,
                    effect: draft.effect,
                    occurredAt: new Date(),
                    note
                }
            });
            this.#sessions.delete(key);
            await this.#bot.sendMessage(
                chatId,
                `✅ Saved ${transaction.effect === 'reversal' ? 'reversal ' : ''}${transaction.type}: ${transaction.categoryName}, ${formatTelegramAmount(transaction.amount, transaction.currency)} (${formatTelegramAmount(transaction.defaultCurrencyAmount, transaction.defaultCurrency)}).`,
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

    async askForReversal(chatId: number): Promise<void> {
        await this.#bot.sendMessage(
            chatId,
            '↩️ Is this a refund or reversal? Choose Yes if it cancels or reduces an earlier transaction.',
            {
                reply_markup: reversalKeyboard()
            }
        );
    }

    async askForDescription(chatId: number): Promise<void> {
        await this.#bot.sendMessage(chatId, '📝 Add a description?', {
            reply_markup: noteKeyboard()
        });
    }

    async sendCategoryPrompt(
        chatId: number,
        draft: Extract<Draft, { readonly step: 'category' }>
    ): Promise<void> {
        await this.#bot.sendMessage(chatId, '🏷 Choose a category.', {
            reply_markup: categoryKeyboard(draft.categories, draft.page)
        });
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
