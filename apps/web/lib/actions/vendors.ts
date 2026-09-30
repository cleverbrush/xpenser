'use server';

import {
    UpdateVendorBodySchema,
    type Vendor,
    type VendorCandidate
} from '@xpenser/contracts';
import { revalidatePath } from 'next/cache';
import { getApiClient } from '../api';
import {
    apiErrorMessage,
    apiErrorStatus,
    FormInputError,
    runFormAction,
    schemaIssues
} from '../form-errors';
import {
    logVendorUpdateRejection,
    requiredString,
    validationMessage,
    vendorBody,
    vendorUpdateBody,
    withSelectedBudget
} from './shared';

export async function createVendorAction(formData: FormData) {
    return runFormAction(async () => {
        const client = await getApiClient();
        const vendor = await client.vendors.create({
            body: await withSelectedBudget(vendorBody(formData))
        });
        revalidatePath('/capture');
        revalidatePath('/dashboard');
        revalidatePath('/vendors');
        revalidatePath('/settings/vendors');
        revalidatePath('/transactions');
        return vendor;
    }, 'Could not save vendor.');
}

export async function searchVendorCandidatesAction(
    query: string
): Promise<VendorCandidate[]> {
    const client = await getApiClient();
    return client.vendors.searchCandidates({
        query: {
            query,
            limit: 6
        }
    });
}

export async function getVendorCandidateDetailsAction({
    brandfetchBrandId,
    domain
}: {
    readonly brandfetchBrandId?: string;
    readonly domain?: string;
}): Promise<VendorCandidate | undefined> {
    const client = await getApiClient();
    try {
        return await client.vendors.candidateDetails({
            query: {
                ...(brandfetchBrandId ? { brandfetchBrandId } : {}),
                ...(domain ? { domain } : {})
            }
        });
    } catch (err) {
        if (apiErrorStatus(err) === 404) {
            return undefined;
        }
        throw err;
    }
}

export async function updateVendorAction(formData: FormData) {
    return runFormAction(async () => {
        const id = Number(requiredString(formData, 'id'));
        const client = await getApiClient();
        const body = vendorUpdateBody(formData);
        const localValidation = UpdateVendorBodySchema.validate(body);
        if (!localValidation.valid) {
            const localSchemaError =
                validationMessage(localValidation) ??
                'Could not save vendor. Check the entered details.';
            logVendorUpdateRejection({
                apiStatus: 0,
                body,
                localSchemaError,
                vendorId: id
            });
            throw new FormInputError(
                localSchemaError,
                schemaIssues(localValidation)
            );
        }

        let vendor: Vendor;
        try {
            vendor = await client.vendors.update({
                params: { id },
                body
            });
        } catch (err) {
            if (apiErrorStatus(err) === 400) {
                const apiMessage = apiErrorMessage(err);
                logVendorUpdateRejection({
                    apiMessage,
                    apiStatus: 400,
                    body,
                    vendorId: id
                });
                throw err;
            }
            throw err;
        }
        revalidatePath('/capture');
        revalidatePath('/dashboard');
        revalidatePath('/vendors');
        revalidatePath(`/settings/vendors/${id}`);
        revalidatePath('/settings/vendors');
        revalidatePath('/transactions');
        return vendor;
    }, 'Could not save vendor. Check the entered details.');
}

export async function retryVendorEnrichmentAction(
    formData: FormData
): Promise<Vendor> {
    const id = Number(requiredString(formData, 'id'));
    const client = await getApiClient();
    const vendor = await client.vendors.enrich({
        params: { id }
    });
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/vendors');
    revalidatePath(`/settings/vendors/${id}`);
    revalidatePath('/settings/vendors');
    revalidatePath('/transactions');
    return vendor;
}
