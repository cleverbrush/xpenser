'use server';

import type { TransactionScanImageResponse } from '@xpenser/contracts';
import { revalidatePath } from 'next/cache';
import { getApiClient, getSessionOrRedirect } from '../api';
import { runFormAction } from '../form-errors';
import {
    deleteScanUpload,
    readScanUploadAttachment
} from '../transaction-scan-upload-store';
import { uploadInputError } from '../upload-errors';
import {
    requiredString,
    type TransactionScanDecisionActionBody,
    transactionBody,
    withSelectedBudget
} from './shared';

export async function createTransactionAction(formData: FormData) {
    return runFormAction(async () => {
        const client = await getApiClient();
        await client.transactions.create({
            body: await withSelectedBudget(transactionBody(formData))
        });
        revalidatePath('/capture');
        revalidatePath('/dashboard');
        revalidatePath('/vendors');
        revalidatePath('/transactions');
        revalidatePath('/stats');
    }, 'Could not save the transaction.');
}

export async function createCaptureTransactionAction(formData: FormData) {
    return runFormAction(async () => {
        const client = await getApiClient();
        const transaction = await client.transactions.create({
            body: await withSelectedBudget(transactionBody(formData))
        });
        revalidatePath('/capture');
        revalidatePath('/dashboard');
        revalidatePath('/vendors');
        revalidatePath('/settings/vendors');
        revalidatePath('/transactions');
        revalidatePath('/stats');
        return transaction;
    }, 'Could not save the transaction.');
}

export async function recordTransactionScanDecisionAction({
    body,
    itemId,
    scanId
}: {
    readonly body: TransactionScanDecisionActionBody;
    readonly itemId: number;
    readonly scanId: number;
}) {
    return runFormAction(async () => {
        const { attachment: requestedAttachment, ...decisionBody } = body;
        const uploadId =
            requestedAttachment &&
            'uploadId' in requestedAttachment &&
            typeof requestedAttachment.uploadId === 'string'
                ? requestedAttachment.uploadId
                : undefined;
        const session = uploadId ? await getSessionOrRedirect() : null;
        const client = await getApiClient();
        if (uploadId) {
            try {
                await client.transactionScans.uploadImage({
                    params: { scanId },
                    files: {
                        image: await readScanUploadAttachment(
                            session?.user.id,
                            uploadId
                        )
                    }
                });
            } catch (error) {
                throw uploadInputError(
                    error,
                    'image',
                    'Could not attach the original image. Try again.'
                );
            }
        }
        await client.transactionScans.decide({
            params: { scanId, itemId },
            body: decisionBody
        });
        if (uploadId) {
            await deleteScanUpload(session?.user.id, uploadId);
        }
    }, 'Could not finish this scanned transaction.');
}

export async function getTransactionScanImageAction(
    transactionId: number
): Promise<TransactionScanImageResponse> {
    const client = await getApiClient();
    return client.transactions.scanImage({
        params: { id: transactionId }
    });
}

export async function updateTransactionAction(formData: FormData) {
    return runFormAction(async () => {
        const client = await getApiClient();
        await client.transactions.update({
            params: { id: Number(requiredString(formData, 'id')) },
            body: transactionBody(formData, true)
        });
        revalidatePath('/capture');
        revalidatePath('/dashboard');
        revalidatePath('/vendors');
        revalidatePath('/settings/vendors');
        revalidatePath('/transactions');
        revalidatePath('/stats');
    }, 'Could not save the transaction.');
}

export async function deleteTransactionAction(formData: FormData) {
    const client = await getApiClient();
    await client.transactions.delete({
        params: { id: Number(requiredString(formData, 'id')) }
    });
    revalidatePath('/dashboard');
    revalidatePath('/vendors');
    revalidatePath('/settings/vendors');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}
