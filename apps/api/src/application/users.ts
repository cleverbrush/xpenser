import type {
    PassportResolveUserBody,
    PassportResolveUserResponse,
    RegisterBody,
    TokenResponse,
    UserPreference
} from '@xpenser/contracts';
import { defaultTimeZone, normalizeTimeZone } from '@xpenser/timezone';
import type { Config } from '../config.js';
import type { AppDb, TransactionDb, UserDb } from '../db/schemas.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import { issueToken } from '../security/token.js';

export class DuplicateEmailError extends Error {}
export class InvalidCredentialsError extends Error {}
export class InvalidPassportIdentityError extends Error {}
export class PasswordMismatchError extends Error {}

type CurrencyTransaction = Pick<TransactionDb, 'currency'>;

async function favoriteCurrencies(
    db: AppDb,
    userId: number
): Promise<string[]> {
    const rows = await db.favoriteCurrencies
        .where(currency => currency.userId, userId)
        .orderBy(currency => currency.currency, 'asc');
    return rows.map(row => row.currency);
}

async function hasCategories(db: AppDb, userId: number): Promise<boolean> {
    const rows = await db.categories
        .where(category => category.userId, userId)
        .limit(1);
    return rows.length > 0;
}

async function recentCurrencyTransactions(
    db: AppDb,
    userId: number
): Promise<TransactionDb[]> {
    const rows = (await db.transactions.where(
        transaction => transaction.userId,
        userId
    )) as TransactionDb[];

    return rows
        .sort(
            (left, right) =>
                right.occurredAt.getTime() - left.occurredAt.getTime() ||
                right.id - left.id
        )
        .slice(0, 10);
}

export function transactionCurrenciesByRecentPopularity(
    currencies: readonly string[],
    recentTransactions: readonly CurrencyTransaction[]
): string[] {
    const configuredOrder = new Map<string, number>();
    const configuredCurrencies: string[] = [];

    for (const currency of currencies) {
        const normalized = currency.trim().toUpperCase();
        if (!configuredOrder.has(normalized)) {
            configuredOrder.set(normalized, configuredCurrencies.length);
            configuredCurrencies.push(normalized);
        }
    }

    const usage = new Map<string, { count: number; latestIndex: number }>();

    recentTransactions.forEach((transaction, index) => {
        const currency = transaction.currency.trim().toUpperCase();
        if (currency === '') {
            return;
        }

        const current = usage.get(currency);
        if (current) {
            current.count += 1;
        } else {
            usage.set(currency, { count: 1, latestIndex: index });
        }
    });

    return Array.from(new Set([...usage.keys(), ...configuredCurrencies])).sort(
        (left, right) => {
            const leftUsage = usage.get(left);
            const rightUsage = usage.get(right);
            const usageDelta =
                (rightUsage?.count ?? 0) - (leftUsage?.count ?? 0);

            if (usageDelta !== 0) {
                return usageDelta;
            }
            if (
                leftUsage &&
                rightUsage &&
                leftUsage.latestIndex !== rightUsage.latestIndex
            ) {
                return leftUsage.latestIndex - rightUsage.latestIndex;
            }
            if (leftUsage && !rightUsage) {
                return -1;
            }
            if (!leftUsage && rightUsage) {
                return 1;
            }

            return (
                (configuredOrder.get(left) ?? configuredCurrencies.length) -
                (configuredOrder.get(right) ?? configuredCurrencies.length)
            );
        }
    );
}

async function setFavoriteCurrencies(
    db: AppDb,
    userId: number,
    currencies: readonly string[],
    defaultCurrency: string
): Promise<void> {
    const unique = Array.from(
        new Set(currencies.filter(currency => currency !== defaultCurrency))
    );
    await db.favoriteCurrencies
        .where(currency => currency.userId, userId)
        .delete();
    if (unique.length > 0) {
        await db.favoriteCurrencies.insertMany(
            unique.map(currency => ({ userId, currency }))
        );
    }
}

function toTokenResponse(
    config: Config,
    user: Pick<
        UserDb,
        'defaultCurrency' | 'email' | 'id' | 'role' | 'timezone'
    >,
    categories: boolean,
    expiresInSeconds?: number
): TokenResponse {
    return {
        token: issueToken(
            config,
            { id: user.id, role: user.role },
            expiresInSeconds
        ),
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
            defaultCurrency: user.defaultCurrency,
            timezone: normalizeTimeZone(user.timezone),
            hasCategories: categories
        }
    };
}

export async function issueUserToken(
    db: AppDb,
    config: Config,
    userId: number,
    expiresInSeconds?: number
): Promise<TokenResponse | undefined> {
    const user = await db.users.find(userId);
    if (!user) {
        return undefined;
    }

    return toTokenResponse(
        config,
        user,
        await hasCategories(db, userId),
        expiresInSeconds
    );
}

export async function registerUser(
    db: AppDb,
    config: Config,
    body: RegisterBody
): Promise<TokenResponse> {
    if (body.password !== body.confirmPassword) {
        throw new PasswordMismatchError('Passwords do not match.');
    }

    return db.transaction(async trx => {
        const existing = await trx.users
            .where(user => user.email, body.email)
            .first();
        if (existing) {
            throw new DuplicateEmailError('Email is already registered.');
        }

        const user = await trx.users.insert({
            email: body.email,
            passwordHash: await hashPassword(body.password),
            role: 'user',
            authProvider: 'local',
            defaultCurrency: body.defaultCurrency,
            timezone: normalizeTimeZone(body.timezone)
        });

        await setFavoriteCurrencies(
            trx,
            user.id,
            body.favoriteCurrencies,
            body.defaultCurrency
        );

        return toTokenResponse(config, user, false);
    });
}

export async function loginUser(
    db: AppDb,
    config: Config,
    email: string,
    password: string
): Promise<TokenResponse> {
    const user = await db.users
        .projected('auth')
        .where(candidate => candidate.email, email)
        .first();
    if (!user?.passwordHash) {
        throw new InvalidCredentialsError('Invalid email or password.');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
        throw new InvalidCredentialsError('Invalid email or password.');
    }

    return toTokenResponse(config, user, await hasCategories(db, user.id));
}

export async function resolvePassportGoogleUser(
    db: AppDb,
    identity: PassportResolveUserBody
): Promise<PassportResolveUserResponse> {
    if (identity.provider !== 'google') {
        throw new InvalidPassportIdentityError(
            'Unsupported identity provider.'
        );
    }
    if (identity.email_verified !== true) {
        throw new InvalidPassportIdentityError('Google email is not verified.');
    }

    return db.transaction(async trx => {
        const existingIdentity = await trx.externalIdentities
            .where(row => row.provider, identity.provider)
            .where(row => row.providerSubject, identity.provider_subject)
            .first();
        if (existingIdentity) {
            const user = await trx.users.find(existingIdentity.userId);
            if (!user) {
                throw new InvalidPassportIdentityError(
                    'Linked account was not found.'
                );
            }
            return {
                service_user_id: String(user.id),
                roles: [user.role]
            };
        }

        const found = await trx.users
            .where(user => user.email, identity.email)
            .first();
        if (found && found.authProvider !== 'google') {
            throw new InvalidPassportIdentityError(
                'Email is already registered with another sign-in method.'
            );
        }

        const user =
            found ??
            (await trx.users.insert({
                email: identity.email,
                passwordHash: undefined,
                role: 'user',
                authProvider: 'google',
                defaultCurrency: 'USD',
                timezone: defaultTimeZone
            }));

        const userIdentity = await trx.externalIdentities
            .where(row => row.provider, identity.provider)
            .where(row => row.userId, user.id)
            .first();
        if (userIdentity) {
            throw new InvalidPassportIdentityError(
                'Account is already linked to another Google identity.'
            );
        }

        await trx.externalIdentities.insert({
            provider: identity.provider,
            providerSubject: identity.provider_subject,
            userId: user.id,
            email: identity.email
        });

        return {
            service_user_id: String(user.id),
            roles: [user.role]
        };
    });
}

export async function issuePassportUserToken(
    db: AppDb,
    config: Config,
    serviceUserId: string
): Promise<TokenResponse | undefined> {
    const userId = Number(serviceUserId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
        return undefined;
    }
    return issueUserToken(db, config, userId);
}

export async function getUserPreference(
    db: AppDb,
    userId: number
): Promise<UserPreference | undefined> {
    const user = await db.users.find(userId);

    if (!user) {
        return undefined;
    }

    const [favorites, recentTransactions, categories] = await Promise.all([
        favoriteCurrencies(db, userId),
        recentCurrencyTransactions(db, userId),
        hasCategories(db, userId)
    ]);
    const transactionCurrencies = transactionCurrenciesByRecentPopularity(
        [user.defaultCurrency, ...favorites],
        recentTransactions
    );

    return {
        id: user.id,
        email: user.email,
        defaultCurrency: user.defaultCurrency,
        favoriteCurrencies: favorites,
        transactionCurrencies,
        timezone: normalizeTimeZone(user.timezone),
        hasCategories: categories
    };
}

export async function updateUserPreference(
    db: AppDb,
    userId: number,
    defaultCurrency: string,
    currencies: readonly string[],
    timezone?: string
): Promise<UserPreference | undefined> {
    const user = await db.users.find(userId);
    if (!user) {
        return undefined;
    }

    await db.transaction(async trx => {
        await trx.users
            .where(candidate => candidate.id, userId)
            .update({
                defaultCurrency,
                timezone: normalizeTimeZone(timezone ?? user.timezone),
                updatedAt: new Date()
            });
        await setFavoriteCurrencies(trx, userId, currencies, defaultCurrency);
    });

    return getUserPreference(db, userId);
}
