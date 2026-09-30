'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getApiClient } from '../api';
import { selectedBudgetCookie } from '../budgets';
import { webConfig } from '../config';
import { runFormAction } from '../form-errors';
import {
    budgetCreateBody,
    budgetDetailPath,
    budgetMemberRole,
    budgetPermissions,
    budgetUpdateBody,
    clearSelectedBudgetIfNeeded,
    optionalString,
    requiredString,
    safeInternalRedirect
} from './shared';

export async function selectBudgetAction(formData: FormData) {
    const budgetId = Number(requiredString(formData, 'budgetId'));
    const returnTo =
        safeInternalRedirect(optionalString(formData, 'returnTo')) ??
        '/dashboard';
    const client = await getApiClient();
    const me = await client.auth.me();
    const budget = me.budgets.find(item => item.id === budgetId);
    if (!budget) {
        redirect(returnTo);
    }

    const cookieStore = await cookies();
    cookieStore.set(selectedBudgetCookie, String(budget.id), {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60,
        path: '/',
        sameSite: 'lax',
        secure: webConfig.appUrl.startsWith('https://')
    });
    redirect(returnTo);
}

export async function createBudgetAction(formData: FormData) {
    return runFormAction(async () => {
        const client = await getApiClient();
        const budget = await client.budgets.create({
            body: budgetCreateBody(formData)
        });
        const cookieStore = await cookies();
        cookieStore.set(selectedBudgetCookie, String(budget.id), {
            httpOnly: true,
            maxAge: 365 * 24 * 60 * 60,
            path: '/',
            sameSite: 'lax',
            secure: webConfig.appUrl.startsWith('https://')
        });
        revalidatePath('/settings/budgets');
        redirect(budgetDetailPath(budget.id));
    }, 'Could not create budget.');
}

export async function updateBudgetAction(formData: FormData) {
    return runFormAction(async () => {
        const budgetId = Number(requiredString(formData, 'budgetId'));
        const client = await getApiClient();
        await client.budgets.update({
            params: { id: budgetId },
            body: budgetUpdateBody(formData)
        });
        revalidatePath('/settings/budgets');
        revalidatePath(budgetDetailPath(budgetId));
        revalidatePath('/dashboard');
        revalidatePath('/transactions');
        revalidatePath('/stats');
    }, 'Could not save budget.');
}

export async function archiveBudgetAction(formData: FormData) {
    const budgetId = Number(requiredString(formData, 'budgetId'));
    const client = await getApiClient();
    await client.budgets.update({
        params: { id: budgetId },
        body: { archived: true }
    });
    await clearSelectedBudgetIfNeeded(budgetId);
    revalidatePath('/settings/budgets');
    revalidatePath(budgetDetailPath(budgetId));
    revalidatePath('/dashboard');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}

export async function restoreBudgetAction(formData: FormData) {
    const client = await getApiClient();
    await client.budgets.update({
        params: { id: Number(requiredString(formData, 'budgetId')) },
        body: { archived: false }
    });
    revalidatePath('/settings/budgets');
    revalidatePath(
        budgetDetailPath(Number(requiredString(formData, 'budgetId')))
    );
}

export async function deleteBudgetAction(formData: FormData) {
    const budgetId = Number(requiredString(formData, 'budgetId'));
    const client = await getApiClient();
    await client.budgets.delete({
        params: { id: budgetId }
    });
    await clearSelectedBudgetIfNeeded(budgetId);
    revalidatePath('/settings/budgets');
    revalidatePath('/dashboard');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}

export async function inviteBudgetMemberAction(formData: FormData) {
    return runFormAction(async () => {
        const budgetId = Number(requiredString(formData, 'budgetId'));
        const client = await getApiClient();
        await client.budgets.invite({
            params: { id: budgetId },
            body: {
                email: requiredString(formData, 'email'),
                role: budgetMemberRole(formData),
                permissions: budgetPermissions(formData)
            }
        });
        revalidatePath('/settings/budgets');
        revalidatePath(budgetDetailPath(budgetId));
    }, 'Could not invite this member.');
}

export async function updateBudgetMemberAction(formData: FormData) {
    return runFormAction(async () => {
        const budgetId = Number(requiredString(formData, 'budgetId'));
        const userId = Number(requiredString(formData, 'userId'));
        const client = await getApiClient();
        await client.budgets.updateMember({
            params: { budgetId, userId },
            body: {
                role: budgetMemberRole(formData),
                permissions: budgetPermissions(formData)
            }
        });
        revalidatePath('/settings/budgets');
        revalidatePath(budgetDetailPath(budgetId));
    }, 'Could not update this member.');
}

export async function removeBudgetMemberAction(formData: FormData) {
    const budgetId = Number(requiredString(formData, 'budgetId'));
    const client = await getApiClient();
    await client.budgets.removeMember({
        params: {
            budgetId,
            userId: Number(requiredString(formData, 'userId'))
        }
    });
    revalidatePath('/settings/budgets');
    revalidatePath(budgetDetailPath(budgetId));
}

export async function acceptBudgetInvitationAction(formData: FormData) {
    return runFormAction(async () => {
        const client = await getApiClient();
        const budget = await client.budgets.acceptInvitation({
            body: {
                token: requiredString(formData, 'token'),
                name: requiredString(formData, 'name')
            }
        });
        const cookieStore = await cookies();
        cookieStore.set(selectedBudgetCookie, String(budget.id), {
            httpOnly: true,
            maxAge: 365 * 24 * 60 * 60,
            path: '/',
            sameSite: 'lax',
            secure: webConfig.appUrl.startsWith('https://')
        });
        revalidatePath('/settings/budgets');
        redirect('/dashboard');
    }, 'Could not accept this invitation.');
}
