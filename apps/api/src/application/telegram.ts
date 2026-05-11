import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
    LinkTelegramAccountResponse,
    TelegramConnectionStatus,
    TelegramTokenBody,
    TokenResponse
} from '@xpenser/contracts';
import type { Config } from '../config.js';
import type {
    AppDb,
    TelegramAccountDb,
    TelegramLinkTokenDb
} from '../db/schemas.js';
import { getUserPreference, issueUserToken } from './users.js';

type TelegramUser = TelegramTokenBody['telegramUser'];

export class TelegramNotConfiguredError extends Error {}
export class TelegramLinkTokenInvalidError extends Error {}
export class TelegramAccountConflictError extends Error {}
export class TelegramAccountNotLinkedError extends Error {}

function optionalText(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function normalizeBotUsername(value: string | undefined): string | undefined {
    return optionalText(value)?.replace(/^@/, '');
}

export function hashTelegramLinkToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function verifyTelegramServiceSecret(
    config: Config,
    provided: string | undefined
): boolean {
    if (!provided) {
        return false;
    }

    const expected = Buffer.from(config.telegram.serviceSecret);
    const actual = Buffer.from(provided);
    return (
        expected.length === actual.length && timingSafeEqual(expected, actual)
    );
}

function mapStatus(
    account: TelegramAccountDb | undefined
): TelegramConnectionStatus {
    if (!account) {
        return { linked: false };
    }

    return {
        linked: true,
        telegramUsername: account.telegramUsername ?? undefined,
        telegramFirstName: account.telegramFirstName ?? undefined,
        telegramLastName: account.telegramLastName ?? undefined,
        linkedAt: account.linkedAt
    };
}

function telegramAccountPayload(userId: number, telegramUser: TelegramUser) {
    return {
        userId,
        telegramUserId: telegramUser.telegramUserId,
        telegramUsername: optionalText(telegramUser.telegramUsername),
        telegramFirstName: optionalText(telegramUser.telegramFirstName),
        telegramLastName: optionalText(telegramUser.telegramLastName)
    };
}

export async function getTelegramConnectionStatus(
    db: AppDb,
    userId: number
): Promise<TelegramConnectionStatus> {
    const account = (await db.telegramAccounts
        .where(candidate => candidate.userId, userId)
        .first()) as TelegramAccountDb | undefined;
    return mapStatus(account);
}

export async function createTelegramLinkToken(
    db: AppDb,
    config: Config,
    userId: number
) {
    const botUsername = normalizeBotUsername(config.telegram.botUsername);
    if (!botUsername) {
        throw new TelegramNotConfiguredError('Telegram bot is not configured.');
    }

    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(
        Date.now() + config.telegram.linkTokenTtlSeconds * 1000
    );

    await db.transaction(async trx => {
        await trx.telegramLinkTokens
            .where(candidate => candidate.userId, userId)
            .delete();
        await trx.telegramLinkTokens.insert({
            userId,
            tokenHash: hashTelegramLinkToken(token),
            expiresAt,
            consumedAt: undefined
        });
    });

    return {
        startUrl: `https://t.me/${botUsername}?start=${encodeURIComponent(
            token
        )}`,
        expiresAt
    };
}

export async function disconnectTelegramAccount(
    db: AppDb,
    userId: number
): Promise<void> {
    await db.telegramAccounts.where(account => account.userId, userId).delete();
}

export async function linkTelegramAccount(
    db: AppDb,
    token: string,
    telegramUser: TelegramUser
): Promise<LinkTelegramAccountResponse> {
    const now = new Date();
    const tokenHash = hashTelegramLinkToken(token);
    const userId = await db.transaction(async trx => {
        const linkToken = (await trx.telegramLinkTokens
            .where(candidate => candidate.tokenHash, tokenHash)
            .first()) as TelegramLinkTokenDb | undefined;

        if (
            !linkToken ||
            linkToken.consumedAt ||
            linkToken.expiresAt.getTime() <= now.getTime()
        ) {
            throw new TelegramLinkTokenInvalidError(
                'Telegram link is invalid or expired.'
            );
        }

        const existingTelegramAccount = (await trx.telegramAccounts
            .where(
                account => account.telegramUserId,
                telegramUser.telegramUserId
            )
            .first()) as TelegramAccountDb | undefined;
        if (
            existingTelegramAccount &&
            existingTelegramAccount.userId !== linkToken.userId
        ) {
            throw new TelegramAccountConflictError(
                'This Telegram account is already connected to another xpenser account.'
            );
        }

        await trx.telegramAccounts
            .where(account => account.userId, linkToken.userId)
            .delete();
        await trx.telegramAccounts.insert(
            telegramAccountPayload(linkToken.userId, telegramUser)
        );
        await trx.telegramLinkTokens
            .where(candidate => candidate.id, linkToken.id)
            .update({ consumedAt: now });

        return linkToken.userId;
    });

    const user = await getUserPreference(db, userId);
    if (!user) {
        throw new TelegramLinkTokenInvalidError(
            'Telegram link owner was not found.'
        );
    }

    return {
        userId: user.id,
        email: user.email,
        telegram: await getTelegramConnectionStatus(db, userId)
    };
}

export async function issueTelegramUserToken(
    db: AppDb,
    config: Config,
    telegramUser: TelegramUser
): Promise<TokenResponse> {
    const account = (await db.telegramAccounts
        .where(
            candidate => candidate.telegramUserId,
            telegramUser.telegramUserId
        )
        .first()) as TelegramAccountDb | undefined;
    if (!account) {
        throw new TelegramAccountNotLinkedError(
            'Telegram account is not connected to xpenser.'
        );
    }

    await db.telegramAccounts
        .where(candidate => candidate.userId, account.userId)
        .update({
            telegramUsername: optionalText(telegramUser.telegramUsername),
            telegramFirstName: optionalText(telegramUser.telegramFirstName),
            telegramLastName: optionalText(telegramUser.telegramLastName),
            updatedAt: new Date()
        });

    const token = await issueUserToken(
        db,
        config,
        account.userId,
        config.telegram.jwtExpiresInSeconds
    );
    if (!token) {
        throw new TelegramAccountNotLinkedError(
            'Telegram account is not connected to xpenser.'
        );
    }

    return token;
}
