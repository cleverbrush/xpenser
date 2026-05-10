import type {
    RegisterBody,
    TokenResponse,
    UserPreference
} from '@xpenser/contracts';
import type { Config } from '../config.js';
import type { AppDb, UserDb } from '../db/schemas.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import { issueToken } from '../security/token.js';

export class DuplicateEmailError extends Error {}
export class InvalidCredentialsError extends Error {}
export class PasswordMismatchError extends Error {}

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
    user: Pick<UserDb, 'id' | 'email' | 'role' | 'defaultCurrency'>,
    categories: boolean
): TokenResponse {
    return {
        token: issueToken(config, { id: user.id, role: user.role }),
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
            defaultCurrency: user.defaultCurrency,
            hasCategories: categories
        }
    };
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
            defaultCurrency: body.defaultCurrency
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

export async function googleUser(
    db: AppDb,
    config: Config,
    email: string
): Promise<TokenResponse> {
    return db.transaction(async trx => {
        const found = await trx.users.where(user => user.email, email).first();
        const user =
            found ??
            (await trx.users.insert({
                email,
                passwordHash: undefined,
                role: 'user',
                authProvider: 'google',
                defaultCurrency: 'USD'
            }));

        return toTokenResponse(config, user, await hasCategories(trx, user.id));
    });
}

export async function getUserPreference(
    db: AppDb,
    userId: number
): Promise<UserPreference | undefined> {
    const user = await db.users.find(userId);

    if (!user) {
        return undefined;
    }

    return {
        id: user.id,
        email: user.email,
        defaultCurrency: user.defaultCurrency,
        favoriteCurrencies: await favoriteCurrencies(db, userId),
        hasCategories: await hasCategories(db, userId)
    };
}

export async function updateUserPreference(
    db: AppDb,
    userId: number,
    defaultCurrency: string,
    currencies: readonly string[]
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
                updatedAt: new Date()
            });
        await setFavoriteCurrencies(trx, userId, currencies, defaultCurrency);
    });

    return getUserPreference(db, userId);
}
