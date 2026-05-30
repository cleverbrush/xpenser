'use server';

import { createHash, randomBytes } from 'node:crypto';
import type { Transaction } from '@xpenser/contracts';
import { revalidatePath, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '../auth';
import { getAnonymousApiClient, getApiClient } from './api';
import { webConfig } from './config';

const passportPkceCookie = 'xpenser_passport_pkce';

function requiredString(formData: FormData, key: string): string {
    const value = formData.get(key);
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${key} is required`);
    }
    return value.trim();
}

function optionalString(formData: FormData, key: string): string | undefined {
    const value = formData.get(key);
    if (typeof value !== 'string' || value.trim() === '') {
        return undefined;
    }
    return value.trim();
}

function editableString(formData: FormData, key: string): string | undefined {
    const value = formData.get(key);
    return typeof value === 'string' ? value.trim() : undefined;
}

function transactionEffect(formData: FormData): 'normal' | 'reversal' {
    return formData.get('effect') === 'reversal' ? 'reversal' : 'normal';
}

function transactionBody(formData: FormData, editableNote = false) {
    return {
        categoryId: Number(requiredString(formData, 'categoryId')),
        amount: Number(requiredString(formData, 'amount')),
        currency: requiredString(formData, 'currency'),
        effect: transactionEffect(formData),
        occurredAt: new Date(requiredString(formData, 'occurredAt')),
        note: editableNote
            ? editableString(formData, 'note')
            : optionalString(formData, 'note')
    };
}

function favoriteCurrencies(formData: FormData, defaultCurrency: string) {
    return formData
        .getAll('favoriteCurrencies')
        .filter((value): value is string => typeof value === 'string')
        .filter(currency => currency !== defaultCurrency);
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

function apiErrorStatus(err: unknown): number | undefined {
    return typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof err.status === 'number'
        ? err.status
        : undefined;
}

function pkceChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

function passportLoginUrl(codeChallenge: string): string {
    const url = new URL('/login', webConfig.passport.baseUrl);
    url.searchParams.set('project', webConfig.passport.project);
    url.searchParams.set('env', webConfig.passport.environment);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
}

export async function loginAction(formData: FormData) {
    await signIn('credentials', {
        email: requiredString(formData, 'email'),
        password: requiredString(formData, 'password'),
        redirectTo: '/dashboard'
    });
}

export async function registerAction(formData: FormData) {
    const email = requiredString(formData, 'email');
    const password = requiredString(formData, 'password');
    const defaultCurrency = requiredString(formData, 'defaultCurrency');
    try {
        await getAnonymousApiClient().auth.register({
            body: {
                email,
                password,
                confirmPassword: requiredString(formData, 'confirmPassword'),
                defaultCurrency,
                favoriteCurrencies: favoriteCurrencies(
                    formData,
                    defaultCurrency
                ),
                timezone: optionalString(formData, 'timezone') ?? 'UTC'
            }
        });
    } catch (err) {
        if (apiErrorStatus(err) === 400) {
            return {
                error:
                    apiErrorMessage(err) ??
                    'Could not create the account. Try a different email.'
            };
        }
        throw err;
    }

    await signIn('credentials', {
        email,
        password,
        redirectTo: '/setup/categories'
    });
}

export async function googleSignInAction() {
    const verifier = randomBytes(32).toString('base64url');
    const cookieStore = await cookies();
    cookieStore.set(passportPkceCookie, verifier, {
        httpOnly: true,
        secure: webConfig.appUrl.startsWith('https://'),
        sameSite: 'lax',
        path: '/auth/callback',
        maxAge: 10 * 60
    });
    redirect(passportLoginUrl(pkceChallenge(verifier)));
}

export async function logoutAction() {
    await signOut({ redirectTo: '/login' });
}

export async function createCategoryAction(formData: FormData) {
    const client = await getApiClient();
    await client.categories.create({
        body: {
            name: requiredString(formData, 'name'),
            type: requiredString(formData, 'type') as 'expense' | 'income'
        }
    });
    revalidateTag('categories', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/settings/categories');
    revalidatePath('/settings/preferences');
    revalidatePath('/setup/categories');
}

export async function createFirstCategoryAction(formData: FormData) {
    await createCategoryAction(formData);
    redirect('/dashboard');
}

export async function deleteCategoryAction(formData: FormData) {
    const client = await getApiClient();
    await client.categories.delete({
        params: { id: Number(requiredString(formData, 'id')) }
    });
    revalidateTag('categories', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/settings/categories');
    revalidatePath('/settings/preferences');
}

export async function createTransactionAction(formData: FormData) {
    const client = await getApiClient();
    await client.transactions.create({
        body: transactionBody(formData)
    });
    revalidateTag('transactions', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('dashboard', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}

export async function createCaptureTransactionAction(
    formData: FormData
): Promise<Transaction> {
    const client = await getApiClient();
    const transaction = await client.transactions.create({
        body: transactionBody(formData)
    });
    revalidateTag('transactions', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('dashboard', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/transactions');
    revalidatePath('/stats');
    return transaction;
}

export async function updateTransactionAction(formData: FormData) {
    const client = await getApiClient();
    await client.transactions.update({
        params: { id: Number(requiredString(formData, 'id')) },
        body: transactionBody(formData, true)
    });
    revalidateTag('transactions', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('dashboard', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}

export async function deleteTransactionAction(formData: FormData) {
    const client = await getApiClient();
    await client.transactions.delete({
        params: { id: Number(requiredString(formData, 'id')) }
    });
    revalidateTag('transactions', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('dashboard', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/dashboard');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}

export async function updatePreferencesAction(formData: FormData) {
    const client = await getApiClient();
    const defaultCurrency = requiredString(formData, 'defaultCurrency');
    await client.users.updatePreferences({
        body: {
            defaultCurrency,
            favoriteCurrencies: favoriteCurrencies(formData, defaultCurrency),
            timezone: optionalString(formData, 'timezone') ?? 'UTC'
        }
    });
    revalidateTag('user-profile', 'max');
    revalidateTag('dashboard', 'max');
    revalidatePath('/settings/preferences');
    redirect('/dashboard');
}

export async function createTelegramLinkAction() {
    const client = await getApiClient();
    const link = await client.users.createTelegramLinkToken();
    redirect(link.startUrl);
}

export async function disconnectTelegramAction() {
    const client = await getApiClient();
    await client.users.disconnectTelegram();
    revalidateTag('user-profile', 'max');
    revalidatePath('/settings/preferences');
}

export async function createApiKeyAction(formData: FormData) {
    const client = await getApiClient();
    const result = await client.users.createApiKey({
        body: {
            name: requiredString(formData, 'name')
        }
    });
    revalidateTag('api-keys', 'max');
    revalidatePath('/settings/preferences');
    return result;
}

export async function revokeApiKeyAction(formData: FormData) {
    const client = await getApiClient();
    await client.users.revokeApiKey({
        params: { id: Number(requiredString(formData, 'id')) }
    });
    revalidateTag('api-keys', 'max');
    revalidatePath('/settings/preferences');
}
