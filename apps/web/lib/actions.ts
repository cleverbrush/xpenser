'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '../auth';
import { getAnonymousApiClient, getApiClient } from './api';

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

function transactionBody(formData: FormData, editableNote = false) {
    return {
        categoryId: Number(requiredString(formData, 'categoryId')),
        amount: Number(requiredString(formData, 'amount')),
        currency: requiredString(formData, 'currency'),
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
                )
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
    await signIn('google', { redirectTo: '/dashboard' });
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
    revalidateTag('dashboard', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/dashboard');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}

export async function updateTransactionAction(formData: FormData) {
    const client = await getApiClient();
    await client.transactions.update({
        params: { id: Number(requiredString(formData, 'id')) },
        body: transactionBody(formData, true)
    });
    revalidateTag('transactions', 'max');
    revalidateTag('dashboard', 'max');
    revalidateTag('stats', 'max');
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
            favoriteCurrencies: favoriteCurrencies(formData, defaultCurrency)
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
