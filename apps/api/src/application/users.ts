import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
    EmailConfirmationMessageResponse,
    EmailConfirmationPendingResponse,
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
import { issueToken, tokenExpiresAt } from '../security/token.js';
import { sendEmail } from './email.js';

export class DuplicateEmailError extends Error {}
export class EmailNotVerifiedError extends Error {}
export class InvalidEmailConfirmationTokenError extends Error {}
export class InvalidCredentialsError extends Error {}
export class InvalidPassportIdentityError extends Error {}
export class PasswordMismatchError extends Error {}

type CurrencyTransaction = Pick<TransactionDb, 'currency'>;
type EmailConfirmationToken = {
    readonly expiresAt: Date;
    readonly token: string;
    readonly tokenHash: string;
};

const emailConfirmationPendingMessage =
    'Check your email for a confirmation link before signing in.';
const emailConfirmationResendMessage =
    'If that email needs confirmation, a new link has been sent.';

function normalizeCountryCode(value: string | undefined): string {
    const countryCode = (value ?? 'US').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(countryCode) ? countryCode : 'US';
}

export function hashEmailConfirmationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function createEmailConfirmationToken(
    config: Config,
    issuedAt = new Date()
): EmailConfirmationToken {
    const token = randomBytes(32).toString('base64url');
    return {
        token,
        tokenHash: hashEmailConfirmationToken(token),
        expiresAt: new Date(
            issuedAt.getTime() +
                config.emailConfirmation.tokenTtlSeconds * 1_000
        )
    };
}

function emailConfirmationLink(config: Config, token: string): string {
    const url = new URL('/auth/confirm-email', config.app.url);
    url.searchParams.set('token', token);
    return url.toString();
}

async function sendEmailConfirmation(
    config: Config,
    email: string,
    token: string
): Promise<void> {
    const url = emailConfirmationLink(config, token);
    await sendEmail(config, {
        to: email,
        subject: 'Confirm your xpenser email',
        text: `Confirm your xpenser email by opening this link: ${url}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Confirm your xpenser email</h2>
                <p>Open this magic link to confirm your email address and finish signing in.</p>
                <p style="margin: 28px 0;">
                    <a href="${url}" style="background: #111827; color: #ffffff; padding: 12px 18px; border-radius: 6px; text-decoration: none; display: inline-block;">
                        Confirm email
                    </a>
                </p>
                <p style="color: #4b5563; font-size: 14px;">If the button does not work, paste this link into your browser:</p>
                <p style="word-break: break-all; color: #4b5563; font-size: 14px;">${url}</p>
            </div>
        `
    });
}

function emailConfirmationPendingResponse(
    email: string
): EmailConfirmationPendingResponse {
    return {
        email,
        verificationRequired: true,
        message: emailConfirmationPendingMessage
    };
}

function emailConfirmationResendResponse(): EmailConfirmationMessageResponse {
    return { message: emailConfirmationResendMessage };
}

function isUnverifiedLocalUser(
    user: Pick<UserDb, 'authProvider' | 'emailVerified'>
): boolean {
    return user.authProvider === 'local' && user.emailVerified === false;
}

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
        | 'defaultCurrency'
        | 'email'
        | 'id'
        | 'role'
        | 'countryCode'
        | 'timezone'
        | 'weeklyEmailReportEnabled'
        | 'monthlyEmailReportEnabled'
    >,
    categories: boolean,
    expiresInSeconds?: number
): TokenResponse {
    const tokenTtlSeconds = expiresInSeconds ?? config.jwt.expiresInSeconds;
    const issuedAt = new Date();
    return {
        token: issueToken(
            config,
            { id: user.id, role: user.role },
            tokenTtlSeconds,
            issuedAt
        ),
        expiresAt: tokenExpiresAt(tokenTtlSeconds, issuedAt),
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
            defaultCurrency: user.defaultCurrency,
            countryCode: normalizeCountryCode(user.countryCode),
            timezone: normalizeTimeZone(user.timezone),
            hasCategories: categories
        }
    };
}

export function verifyWebApiServiceSecret(
    config: Config,
    provided: string | undefined
): boolean {
    if (!provided) {
        return false;
    }

    const expected = Buffer.from(config.web.apiServiceSecret);
    const actual = Buffer.from(provided);
    return (
        expected.length === actual.length && timingSafeEqual(expected, actual)
    );
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
    if (isUnverifiedLocalUser(user)) {
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
): Promise<EmailConfirmationPendingResponse> {
    if (body.password !== body.confirmPassword) {
        throw new PasswordMismatchError('Passwords do not match.');
    }

    const confirmation = createEmailConfirmationToken(config);
    const response = await db.transaction(async trx => {
        const existing = await trx.users
            .where(user => user.email, body.email)
            .first();
        if (existing) {
            throw new DuplicateEmailError('Email is already registered.');
        }

        const user = await trx.users.insert({
            email: body.email,
            passwordHash: await hashPassword(body.password),
            emailVerified: false,
            emailVerificationTokenHash: confirmation.tokenHash,
            emailVerificationExpiresAt: confirmation.expiresAt,
            role: 'user',
            authProvider: 'local',
            defaultCurrency: body.defaultCurrency,
            countryCode: normalizeCountryCode(body.countryCode),
            timezone: normalizeTimeZone(body.timezone)
        });

        await setFavoriteCurrencies(
            trx,
            user.id,
            body.favoriteCurrencies,
            body.defaultCurrency
        );

        return emailConfirmationPendingResponse(user.email);
    });

    await sendEmailConfirmation(config, body.email, confirmation.token);
    return response;
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
    if (isUnverifiedLocalUser(user)) {
        throw new EmailNotVerifiedError(
            'Email is not verified. Check your inbox for the confirmation link.'
        );
    }

    return toTokenResponse(config, user, await hasCategories(db, user.id));
}

export async function confirmEmail(
    db: AppDb,
    config: Config,
    token: string
): Promise<TokenResponse> {
    const tokenHash = hashEmailConfirmationToken(token);
    const user = await db.users
        .projected('auth')
        .where(candidate => candidate.emailVerificationTokenHash, tokenHash)
        .first();
    if (
        !user ||
        user.authProvider !== 'local' ||
        user.emailVerified ||
        !user.emailVerificationExpiresAt ||
        user.emailVerificationExpiresAt.getTime() <= Date.now()
    ) {
        throw new InvalidEmailConfirmationTokenError(
            'Confirmation link is invalid or expired.'
        );
    }

    await db.users
        .where(candidate => candidate.id, user.id)
        .update({
            emailVerified: true,
            emailVerificationTokenHash: null,
            emailVerificationExpiresAt: null,
            updatedAt: new Date()
        });

    const response = await issueUserToken(db, config, user.id);
    if (!response) {
        throw new InvalidEmailConfirmationTokenError(
            'Confirmation link is invalid or expired.'
        );
    }
    return response;
}

export async function resendEmailConfirmation(
    db: AppDb,
    config: Config,
    email: string
): Promise<EmailConfirmationMessageResponse> {
    const user = await db.users
        .projected('auth')
        .where(candidate => candidate.email, email)
        .first();
    if (!user || user.authProvider !== 'local' || user.emailVerified) {
        return emailConfirmationResendResponse();
    }

    const confirmation = createEmailConfirmationToken(config);
    await db.users
        .where(candidate => candidate.id, user.id)
        .update({
            emailVerificationTokenHash: confirmation.tokenHash,
            emailVerificationExpiresAt: confirmation.expiresAt,
            updatedAt: new Date()
        });
    await sendEmailConfirmation(config, user.email, confirmation.token);

    return emailConfirmationResendResponse();
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
                emailVerified: true,
                emailVerificationTokenHash: undefined,
                emailVerificationExpiresAt: undefined,
                role: 'user',
                authProvider: 'google',
                defaultCurrency: 'USD',
                countryCode: 'US',
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
        countryCode: normalizeCountryCode(user.countryCode),
        favoriteCurrencies: favorites,
        transactionCurrencies,
        timezone: normalizeTimeZone(user.timezone),
        hasCategories: categories,
        weeklyEmailReportEnabled: user.weeklyEmailReportEnabled,
        monthlyEmailReportEnabled: user.monthlyEmailReportEnabled
    };
}

export async function updateUserPreference(
    db: AppDb,
    userId: number,
    defaultCurrency: string,
    currencies: readonly string[],
    countryCode?: string,
    timezone?: string,
    weeklyEmailReportEnabled = true,
    monthlyEmailReportEnabled = true
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
                countryCode: normalizeCountryCode(
                    countryCode ?? user.countryCode
                ),
                timezone: normalizeTimeZone(timezone ?? user.timezone),
                weeklyEmailReportEnabled,
                monthlyEmailReportEnabled,
                updatedAt: new Date()
            });
        await setFavoriteCurrencies(trx, userId, currencies, defaultCurrency);
    });

    return getUserPreference(db, userId);
}
