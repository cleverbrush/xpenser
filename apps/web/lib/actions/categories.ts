'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getApiClient } from '../api';
import { runFormAction } from '../form-errors';
import {
    booleanString,
    categoryBody,
    requiredString,
    withSelectedBudget
} from './shared';

export async function createCategoryAction(formData: FormData) {
    return runFormAction(async () => {
        const client = await getApiClient();
        const category = await client.categories.create({
            body: await withSelectedBudget(categoryBody(formData))
        });
        revalidatePath('/settings/categories');
        revalidatePath('/settings/preferences');
        revalidatePath('/setup/categories');
        return category;
    }, 'Could not save the category.');
}

export async function createFirstCategoryAction(formData: FormData) {
    const result = await createCategoryAction(formData);
    if (!result.ok) return result;
    redirect('/dashboard');
}

export async function updateCategoryAction(formData: FormData) {
    return runFormAction(async () => {
        const client = await getApiClient();
        await client.categories.update({
            params: { id: Number(requiredString(formData, 'id')) },
            body: categoryBody(formData)
        });
        revalidatePath('/settings/categories');
        revalidatePath('/settings/preferences');
        revalidatePath('/setup/categories');
        revalidatePath('/capture');
        revalidatePath('/dashboard');
        revalidatePath('/vendors');
        revalidatePath('/settings/vendors');
        revalidatePath('/transactions');
        revalidatePath('/stats');
    }, 'Could not save the category.');
}

export async function setCategoryArchivedAction(formData: FormData) {
    const client = await getApiClient();
    await client.categories.update({
        params: { id: Number(requiredString(formData, 'id')) },
        body: {
            archived: booleanString(formData, 'archived', false)
        }
    });
    revalidatePath('/settings/categories');
    revalidatePath('/settings/preferences');
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}

export async function deleteCategoryAction(formData: FormData) {
    const client = await getApiClient();
    await client.categories.delete({
        params: { id: Number(requiredString(formData, 'id')) }
    });
    revalidatePath('/settings/categories');
    revalidatePath('/settings/preferences');
}

export async function moveAndDeleteCategoryAction(formData: FormData) {
    return runFormAction(async () => {
        const client = await getApiClient();
        await client.categories.moveAndDelete({
            params: { id: Number(requiredString(formData, 'id')) },
            body: {
                replacementCategoryId: Number(
                    requiredString(formData, 'replacementCategoryId')
                )
            }
        });
        revalidatePath('/settings/categories');
        revalidatePath('/settings/preferences');
        revalidatePath('/capture');
        revalidatePath('/dashboard');
        revalidatePath('/transactions');
        revalidatePath('/stats');
    }, 'Could not move transactions and delete the category.');
}
