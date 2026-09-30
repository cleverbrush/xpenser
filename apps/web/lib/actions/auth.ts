'use server';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAnonymousApiClient } from '../api';
import { getGoogleSignInProvider, webConfig } from '../config';
import {
    apiErrorMessage,
    apiErrorStatus,
    FormInputError,
    runFormAction
} from '../form-errors';
import {
    favoriteCurrencies,
    optionalString,
    passportLoginUrl,
    passportPkceCookie,
    passportRedirectCookie,
    pkceChallenge,
    requiredString,
    safeInternalRedirect
} from './shared';

export async function loginAction(formData: FormData) {
    return runFormAction(async () => {
        if (webConfig.singleUser?.enabled) {
            redirect('/dashboard');
        }

        const email = requiredString(formData, 'email');
        const password = requiredString(formData, 'password');
        try {
            await getAnonymousApiClient().auth.login({
                body: { email, password }
            });
        } catch (err) {
            const status = apiErrorStatus(err);
            if (status === 403) {
                throw new FormInputError(
                    apiErrorMessage(err) ??
                        'Confirm your email before signing in.',
                    [],
                    email
                );
            }
            if (status === 401) {
                throw new FormInputError(
                    'Could not sign in. Check your email and password.',
                    []
                );
            }
            throw err;
        }

        const { signIn } = await import('../../auth');
        await signIn('credentials', {
            email,
            password,
            redirectTo:
                safeInternalRedirect(optionalString(formData, 'redirectTo')) ??
                '/dashboard'
        });
    }, 'Could not sign in. Check your email and password.');
}

export async function registerAction(formData: FormData) {
    return runFormAction(async () => {
        if (webConfig.singleUser?.enabled) {
            redirect('/dashboard');
        }

        const email = requiredString(formData, 'email');
        const password = requiredString(formData, 'password');
        const defaultCurrency = requiredString(formData, 'defaultCurrency');
        return await getAnonymousApiClient().auth.register({
            body: {
                email,
                password,
                confirmPassword: requiredString(formData, 'confirmPassword'),
                defaultCurrency,
                countryCode: requiredString(formData, 'countryCode')
                    .trim()
                    .toUpperCase(),
                favoriteCurrencies: favoriteCurrencies(
                    formData,
                    defaultCurrency
                ),
                timezone: optionalString(formData, 'timezone') ?? 'UTC'
            }
        });
    }, 'Could not create the account. Try a different email.');
}

export async function resendEmailConfirmationAction(formData: FormData) {
    return runFormAction(async () => {
        return await getAnonymousApiClient().auth.resendEmailConfirmation({
            body: {
                email: requiredString(formData, 'email')
            }
        });
    }, 'Could not send a confirmation link.');
}

export async function googleSignInAction(formData: FormData) {
    if (webConfig.singleUser?.enabled) {
        redirect('/dashboard');
    }

    const provider = getGoogleSignInProvider();
    const redirectTo =
        safeInternalRedirect(optionalString(formData, 'redirectTo')) ??
        '/dashboard';
    if (provider === 'direct') {
        const { signIn } = await import('../../auth');
        await signIn('google', { redirectTo });
        return;
    }
    if (provider === 'disabled') {
        redirect('/login');
    }

    const verifier = randomBytes(32).toString('base64url');
    const cookieStore = await cookies();
    cookieStore.set(passportPkceCookie, verifier, {
        httpOnly: true,
        secure: webConfig.appUrl.startsWith('https://'),
        sameSite: 'lax',
        path: '/auth/callback',
        maxAge: 10 * 60
    });
    cookieStore.set(passportRedirectCookie, redirectTo, {
        httpOnly: true,
        secure: webConfig.appUrl.startsWith('https://'),
        sameSite: 'lax',
        path: '/auth/callback',
        maxAge: 10 * 60
    });
    redirect(passportLoginUrl(pkceChallenge(verifier)));
}

export async function logoutAction() {
    if (webConfig.singleUser?.enabled) {
        redirect('/dashboard');
    }

    const { signOut } = await import('../../auth');
    await signOut({ redirectTo: '/' });
}
