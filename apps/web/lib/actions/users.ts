'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getApiClient } from '../api';
import { FormInputError, runFormAction } from '../form-errors';
import { uploadInputError } from '../upload-errors';
import {
    avatarFile,
    booleanString,
    mcpOAuthAuthorizationBody,
    optionalString,
    requiredString
} from './shared';

export async function updatePreferencesAction(formData: FormData) {
    return runFormAction(async () => {
        const client = await getApiClient();
        await client.users.updatePreferences({
            body: {
                countryCode:
                    optionalString(formData, 'countryCode')?.toUpperCase() ??
                    'US',
                timezone: optionalString(formData, 'timezone') ?? 'UTC',
                weeklyEmailReportEnabled: booleanString(
                    formData,
                    'weeklyEmailReportEnabled',
                    true
                ),
                monthlyEmailReportEnabled: booleanString(
                    formData,
                    'monthlyEmailReportEnabled',
                    true
                )
            }
        });
        revalidatePath('/settings/preferences');
        redirect('/dashboard');
    }, 'Could not save preferences.');
}

export async function createTelegramLinkAction() {
    const client = await getApiClient();
    const link = await client.users.createTelegramLinkToken();
    redirect(link.startUrl);
}

export async function disconnectTelegramAction() {
    const client = await getApiClient();
    await client.users.disconnectTelegram();
    revalidatePath('/settings/preferences');
}

export async function updateUserAvatarAction(formData: FormData) {
    return runFormAction(async () => {
        let file: File;
        try {
            file = avatarFile(formData);
        } catch (err) {
            throw new FormInputError(
                err instanceof Error ? err.message : 'Could not upload avatar.',
                [
                    {
                        pointer: '/avatar',
                        detail:
                            err instanceof Error
                                ? err.message
                                : 'Could not upload avatar.'
                    }
                ]
            );
        }
        const client = await getApiClient();
        try {
            await client.users.updateAvatar({ files: { avatar: file } });
        } catch (error) {
            throw uploadInputError(
                error,
                'avatar',
                'Could not upload avatar. Choose another image.'
            );
        }
        revalidatePath('/settings/preferences');
        revalidatePath('/settings/budgets');
        revalidatePath('/dashboard');
        revalidatePath('/vendors');
        revalidatePath('/settings/vendors');
        revalidatePath('/transactions');
        return { success: true };
    }, 'Could not upload avatar. Choose another image.');
}

export async function deleteUserAvatarAction() {
    const client = await getApiClient();
    await client.users.deleteAvatar();
    revalidatePath('/settings/preferences');
    revalidatePath('/settings/budgets');
    revalidatePath('/dashboard');
    revalidatePath('/vendors');
    revalidatePath('/settings/vendors');
    revalidatePath('/transactions');
}

export async function createApiKeyAction(formData: FormData) {
    return runFormAction(async () => {
        const client = await getApiClient();
        const result = await client.users.createApiKey({
            body: {
                name: requiredString(formData, 'name')
            }
        });
        revalidatePath('/settings/preferences');
        return result;
    }, 'Could not create API key.');
}

export async function revokeApiKeyAction(formData: FormData) {
    const client = await getApiClient();
    await client.users.revokeApiKey({
        params: { id: Number(requiredString(formData, 'id')) }
    });
    revalidatePath('/settings/preferences');
}

export async function approveMcpOAuthAction(formData: FormData) {
    const client = await getApiClient();
    const result = await client.oauth.authorize({
        body: mcpOAuthAuthorizationBody(formData)
    });
    revalidatePath('/settings/preferences');
    redirect(result.redirectUrl);
}

export async function denyMcpOAuthAction(formData: FormData) {
    const client = await getApiClient();
    const body = mcpOAuthAuthorizationBody(formData);
    await client.oauth.authorizationRequest({ query: body });
    const redirectUrl = new URL(body.redirect_uri);
    redirectUrl.searchParams.set('error', 'access_denied');
    if (body.state) {
        redirectUrl.searchParams.set('state', body.state);
    }
    redirect(redirectUrl.toString());
}

export async function revokeMcpOAuthConnectionAction(formData: FormData) {
    const client = await getApiClient();
    await client.users.revokeMcpOAuthConnection({
        params: { id: Number(requiredString(formData, 'id')) }
    });
    revalidatePath('/settings/preferences');
}
