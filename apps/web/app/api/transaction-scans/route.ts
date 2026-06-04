import { createXpenserClient } from '@xpenser/client';
import {
    TransactionScanLimits,
    type TransactionScanResponse
} from '@xpenser/contracts';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { webConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
const transactionScanTimeoutMs = 60_000;

type AllowedImageType = (typeof allowedImageTypes)[number];
type ScanRouteResponse =
    | { readonly error: string; readonly scan?: undefined }
    | { readonly error?: undefined; readonly scan: TransactionScanResponse };

function uploadedFile(value: FormDataEntryValue | null): File | undefined {
    if (
        typeof value === 'object' &&
        value !== null &&
        'arrayBuffer' in value &&
        'name' in value &&
        'size' in value &&
        'type' in value
    ) {
        return value as File;
    }
    return undefined;
}

function isAllowedImageType(value: string): value is AllowedImageType {
    return allowedImageTypes.includes(value as AllowedImageType);
}

function apiErrorStatus(err: unknown): number | undefined {
    return typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof err.status === 'number'
        ? err.status
        : undefined;
}

function apiErrorMessage(err: unknown): string | undefined {
    const body =
        typeof err === 'object' && err !== null && 'body' in err
            ? (err as { readonly body?: unknown }).body
            : undefined;
    return typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body.message === 'string'
        ? body.message
        : undefined;
}

function errorResponse(message: string, status: number) {
    return NextResponse.json<ScanRouteResponse>({ error: message }, { status });
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.apiToken) {
        return errorResponse('Unauthorized', 401);
    }

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return errorResponse('Upload a PNG, JPEG, or WebP image.', 400);
    }

    const file = uploadedFile(formData.get('image'));
    if (!file || file.size === 0) {
        return errorResponse('Choose an image to scan.', 400);
    }
    if (!isAllowedImageType(file.type)) {
        return errorResponse('Upload a PNG, JPEG, or WebP image.', 400);
    }
    if (file.size > TransactionScanLimits.maxImageBytes) {
        return errorResponse('Image must be 10 MB or smaller.', 413);
    }

    const client = createXpenserClient({
        baseUrl: webConfig.apiBaseUrl,
        getToken: () => session.apiToken,
        retryOnTimeout: false,
        timeoutMs: transactionScanTimeoutMs
    });

    try {
        const imageBase64 = Buffer.from(await file.arrayBuffer()).toString(
            'base64'
        );
        const scan = await client.transactionScans.create({
            body: {
                imageBase64,
                mimeType: file.type,
                fileName: file.name
            }
        });
        return NextResponse.json<ScanRouteResponse>({ scan });
    } catch (err) {
        const status = apiErrorStatus(err);
        if (status === 400) {
            return errorResponse(
                apiErrorMessage(err) ??
                    'Could not scan the image. Try a clearer image.',
                400
            );
        }
        if (status === 401) {
            return errorResponse('Session expired.', 401);
        }
        throw err;
    }
}
