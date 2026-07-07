import { createXpenserClient } from '@xpenser/client';
import type { TransactionScanJobResponse } from '@xpenser/contracts';
import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/api';
import { selectedBudgetIdFromCookie } from '@/lib/budgets';
import { webConfig } from '@/lib/config';
import {
    assembleScanUploadChunks,
    cleanupStaleScanUploads,
    createScanUploadId,
    isAllowedScanImageType,
    isScanUploadId,
    type StoredScanAttachment,
    scanUploadChunkCountError,
    scanUploadFileSizeError,
    storeScanUpload,
    writeScanUploadChunk
} from '@/lib/transaction-scan-upload-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ScanRouteResponse =
    | { readonly error: string; readonly job?: undefined }
    | { readonly error?: undefined; readonly uploaded: true }
    | {
          readonly attachment: StoredScanAttachment;
          readonly error?: undefined;
          readonly job: TransactionScanJobResponse;
      };

type ScanChunkBody = {
    readonly chunkBase64: string;
    readonly chunkIndex: number;
    readonly fileName?: string;
    readonly fileSize: number;
    readonly mimeType: string;
    readonly totalChunks: number;
    readonly uploadId: string;
};

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

function scanChunkBody(value: unknown): ScanChunkBody | undefined {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }

    const record = value as Record<string, unknown>;
    if (
        typeof record.chunkBase64 !== 'string' ||
        typeof record.chunkIndex !== 'number' ||
        typeof record.fileSize !== 'number' ||
        typeof record.mimeType !== 'string' ||
        typeof record.totalChunks !== 'number' ||
        typeof record.uploadId !== 'string'
    ) {
        return undefined;
    }

    if (record.fileName !== undefined && typeof record.fileName !== 'string') {
        return undefined;
    }

    return {
        chunkBase64: record.chunkBase64,
        chunkIndex: record.chunkIndex,
        fileName: record.fileName,
        fileSize: record.fileSize,
        mimeType: record.mimeType,
        totalChunks: record.totalChunks,
        uploadId: record.uploadId
    };
}

function validChunkIndex(chunkIndex: number, totalChunks: number): boolean {
    return (
        Number.isSafeInteger(chunkIndex) &&
        chunkIndex >= 0 &&
        chunkIndex < totalChunks
    );
}

function bodyValidationError(body: ScanChunkBody): string | undefined {
    if (!isScanUploadId(body.uploadId)) {
        return 'Could not scan the image. Try again.';
    }
    if (!isAllowedScanImageType(body.mimeType)) {
        return 'Upload a PNG, JPEG, or WebP image.';
    }
    if (!validChunkIndex(body.chunkIndex, body.totalChunks)) {
        return 'Could not scan the image. Try again.';
    }
    return (
        scanUploadFileSizeError(body.fileSize) ??
        scanUploadChunkCountError(body.totalChunks)
    );
}

export async function POST(request: Request) {
    const session = await getCurrentSession();
    if (!session?.apiToken) {
        return errorResponse('Unauthorized', 401);
    }

    let body: ScanChunkBody | undefined;
    try {
        body = scanChunkBody(await request.json());
    } catch {
        return errorResponse('Could not scan the image. Try again.', 400);
    }
    if (!body) {
        return errorResponse('Could not scan the image. Try again.', 400);
    }

    const bodyError = bodyValidationError(body);
    if (bodyError) {
        return errorResponse(
            bodyError,
            bodyError.includes('10 MB') ? 413 : 400
        );
    }
    if (!isAllowedScanImageType(body.mimeType)) {
        return errorResponse('Upload a PNG, JPEG, or WebP image.', 400);
    }

    const userId = session.user.id;
    const mimeType = body.mimeType;
    await cleanupStaleScanUploads();

    try {
        await writeScanUploadChunk({
            chunkBase64: body.chunkBase64,
            chunkIndex: body.chunkIndex,
            uploadId: body.uploadId,
            userId
        });
    } catch {
        return errorResponse('Could not scan the image. Try again.', 400);
    }

    if (body.chunkIndex < body.totalChunks - 1) {
        return NextResponse.json<ScanRouteResponse>({ uploaded: true });
    }

    let image: Buffer;
    try {
        image = await assembleScanUploadChunks({
            expectedSize: body.fileSize,
            totalChunks: body.totalChunks,
            uploadId: body.uploadId,
            userId
        });
    } catch {
        return errorResponse('Could not scan the image. Try again.', 400);
    }

    const client = createXpenserClient({
        baseUrl: webConfig.apiBaseUrl,
        getToken: () => session.apiToken,
        retryOnTimeout: false
    });

    try {
        const imageBase64 = image.toString('base64');
        const budgetId = await selectedBudgetIdFromCookie();
        const attachment = await storeScanUpload({
            buffer: image,
            fileName: body.fileName,
            mimeType,
            uploadId: body.uploadId,
            userId
        });
        const job = await client.transactionScans.start({
            body: {
                ...(budgetId ? { budgetId } : {}),
                imageBase64,
                mimeType,
                fileName: body.fileName
            }
        });
        return NextResponse.json<ScanRouteResponse>({ attachment, job });
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

export async function GET() {
    return NextResponse.json({ uploadId: createScanUploadId() });
}
