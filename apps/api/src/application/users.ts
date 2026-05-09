import type {
    RegisterBody,
    TokenResponse,
    UserPreference
} from '@xpenser/contracts';
import type { Knex } from 'knex';
import type { Config } from '../config.js';
import type { UserRow } from '../db/schemas.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import { issueToken } from '../security/token.js';

export class DuplicateEmailError extends Error {}
export class InvalidCredentialsError extends Error {}
export class PasswordMismatchError extends Error {}

type UserWithCategoryFlag = UserRow & {
    readonly has_categories: boolean;
};

async function favoriteCurrencies(
    knex: Knex,
    userId: number
): Promise<string[]> {
    const rows = await knex('user_favorite_currencies')
        .select<{ currency: string }[]>('currency')
        .where({ user_id: userId })
        .orderBy('currency', 'asc');
    return rows.map(row => row.currency);
}

async function hasCategories(knex: Knex, userId: number): Promise<boolean> {
    const row = await knex('categories')
        .count<{ count: string | number }[]>({ count: '*' })
        .where({ user_id: userId })
        .first();
    return Number(row?.count ?? 0) > 0;
}

async function setFavoriteCurrencies(
    trx: Knex.Transaction,
    userId: number,
    currencies: readonly string[],
    defaultCurrency: string
): Promise<void> {
    const unique = Array.from(new Set([defaultCurrency, ...currencies]));
    await trx('user_favorite_currencies').where({ user_id: userId }).delete();
    if (unique.length > 0) {
        await trx('user_favorite_currencies').insert(
            unique.map(currency => ({ user_id: userId, currency }))
        );
    }
}

function toTokenResponse(
    config: Config,
    user: Pick<UserRow, 'id' | 'email' | 'role' | 'default_currency'>,
    categories: boolean
): TokenResponse {
    return {
        token: issueToken(config, { id: user.id, role: user.role }),
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
            defaultCurrency: user.default_currency,
            hasCategories: categories
        }
    };
}

export async function registerUser(
    knex: Knex,
    config: Config,
    body: RegisterBody
): Promise<TokenResponse> {
    if (body.password !== body.confirmPassword) {
        throw new PasswordMismatchError('Passwords do not match.');
    }

    return knex.transaction(async trx => {
        const existing = await trx('users')
            .where({ email: body.email })
            .first('id');
        if (existing) {
            throw new DuplicateEmailError('Email is already registered.');
        }

        const [user] = await trx<UserRow>('users')
            .insert({
                email: body.email,
                password_hash: await hashPassword(body.password),
                role: 'user',
                auth_provider: 'local',
                default_currency: body.defaultCurrency
            })
            .returning('*');

        if (!user) {
            throw new Error('User insert did not return a row.');
        }

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
    knex: Knex,
    config: Config,
    email: string,
    password: string
): Promise<TokenResponse> {
    const user = await knex<UserRow>('users').where({ email }).first();
    if (!user?.password_hash) {
        throw new InvalidCredentialsError('Invalid email or password.');
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
        throw new InvalidCredentialsError('Invalid email or password.');
    }

    return toTokenResponse(config, user, await hasCategories(knex, user.id));
}

export async function googleUser(
    knex: Knex,
    config: Config,
    email: string
): Promise<TokenResponse> {
    return knex.transaction(async trx => {
        const found = await trx<UserRow>('users').where({ email }).first();
        const user =
            found ??
            (
                await trx<UserRow>('users')
                    .insert({
                        email,
                        role: 'user',
                        auth_provider: 'google',
                        default_currency: 'USD'
                    })
                    .returning('*')
            )[0];

        if (!user) {
            throw new Error('Google user insert did not return a row.');
        }

        return toTokenResponse(config, user, await hasCategories(trx, user.id));
    });
}

export async function getUserPreference(
    knex: Knex,
    userId: number
): Promise<UserPreference | undefined> {
    const user = await knex<UserWithCategoryFlag>('users')
        .select(
            'users.*',
            knex.raw(
                'exists(select 1 from categories where user_id = users.id) as has_categories'
            )
        )
        .where('users.id', userId)
        .first();

    if (!user) {
        return undefined;
    }

    return {
        id: user.id,
        email: user.email,
        defaultCurrency: user.default_currency,
        favoriteCurrencies: await favoriteCurrencies(knex, userId),
        hasCategories: Boolean(user.has_categories)
    };
}

export async function updateUserPreference(
    knex: Knex,
    userId: number,
    defaultCurrency: string,
    currencies: readonly string[]
): Promise<UserPreference | undefined> {
    await knex.transaction(async trx => {
        await trx('users').where({ id: userId }).update({
            default_currency: defaultCurrency,
            updated_at: trx.fn.now()
        });
        await setFavoriteCurrencies(trx, userId, currencies, defaultCurrency);
    });

    return getUserPreference(knex, userId);
}
