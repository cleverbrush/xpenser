import { randomUUID } from 'node:crypto';
import {
    mkdir,
    readdir,
    readFile,
    rm,
    stat,
    writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    type TransactionScanDecisionBody,
    TransactionScanLimits
} from '@xpenser/contracts';

export const allowedScanImageTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
] as const;

const uploadRoot = join(tmpdir(), 'xpenser-transaction-scan-uploads');
const uploadTtlMs = 24 * 60 * 60 * 1000;

export type AllowedScanImageType = (typeof allowedScanImageTypes)[number];
export type StoredScanAttachment = {
    readonly fileName?: string;
    readonly mimeType: AllowedScanImageType;
    readonly uploadId: string;
};

type StoredScanMetadata = StoredScanAttachment & {
    readonly createdAt: string;
    readonly size: number;
};

export function createScanUploadId(): string {
    return randomUUID();
}

export function isAllowedScanImageType(
    value: string
): value is AllowedScanImageType {
    return allowedScanImageTypes.includes(value as AllowedScanImageType);
}

export function isScanUploadId(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
    );
}

export function scanUploadFileSizeError(fileSize: number): string | undefined {
    if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
        return 'Choose an image to scan.';
    }
    if (fileSize > TransactionScanLimits.maxImageBytes) {
        return 'Image must be 10 MB or smaller.';
    }
    return undefined;
}

export function scanUploadChunkCountError(
    totalChunks: number
): string | undefined {
    const maxChunks = Math.ceil(
        TransactionScanLimits.maxImageBytes /
            TransactionScanLimits.uploadChunkBytes
    );
    if (
        !Number.isSafeInteger(totalChunks) ||
        totalChunks <= 0 ||
        totalChunks > maxChunks
    ) {
        return 'Could not scan the image. Try again.';
    }
    return undefined;
}

function safeUserId(userId: unknown): string {
    const normalized = String(userId ?? 'anonymous').replace(
        /[^A-Za-z0-9_-]/g,
        '_'
    );
    return normalized || 'anonymous';
}

function scanUploadDir(userId: unknown, uploadId: string): string {
    return join(uploadRoot, safeUserId(userId), uploadId);
}

function chunksDir(userId: unknown, uploadId: string): string {
    return join(scanUploadDir(userId, uploadId), 'chunks');
}

function imagePath(userId: unknown, uploadId: string): string {
    return join(scanUploadDir(userId, uploadId), 'image.bin');
}

function metadataPath(userId: unknown, uploadId: string): string {
    return join(scanUploadDir(userId, uploadId), 'metadata.json');
}

function chunkPath(
    userId: unknown,
    uploadId: string,
    chunkIndex: number
): string {
    return join(chunksDir(userId, uploadId), `${chunkIndex}.bin`);
}

function normalizedFileName(fileName: string | undefined): string | undefined {
    const trimmed = fileName?.trim();
    return trimmed ? trimmed.slice(0, 255) : undefined;
}

export async function cleanupStaleScanUploads(): Promise<void> {
    const cutoff = Date.now() - uploadTtlMs;
    let userDirs: string[];
    try {
        userDirs = await readdir(uploadRoot);
    } catch {
        return;
    }

    await Promise.all(
        userDirs.map(async userDir => {
            const userPath = join(uploadRoot, userDir);
            let uploadDirs: string[];
            try {
                uploadDirs = await readdir(userPath);
            } catch {
                return;
            }

            await Promise.all(
                uploadDirs.map(async uploadDir => {
                    const dir = join(userPath, uploadDir);
                    try {
                        const info = await stat(dir);
                        if (info.mtimeMs < cutoff) {
                            await rm(dir, { force: true, recursive: true });
                        }
                    } catch {
                        return;
                    }
                })
            );
        })
    );
}

export async function writeScanUploadChunk({
    chunkBase64,
    chunkIndex,
    uploadId,
    userId
}: {
    readonly chunkBase64: string;
    readonly chunkIndex: number;
    readonly uploadId: string;
    readonly userId: unknown;
}): Promise<Buffer> {
    const chunk = Buffer.from(chunkBase64, 'base64');
    if (
        chunk.length === 0 ||
        chunk.length > TransactionScanLimits.uploadChunkBytes
    ) {
        throw new Error('Invalid scan upload chunk.');
    }

    const dir = chunksDir(userId, uploadId);
    await mkdir(dir, { recursive: true });
    await writeFile(chunkPath(userId, uploadId, chunkIndex), chunk);
    return chunk;
}

export async function assembleScanUploadChunks({
    expectedSize,
    totalChunks,
    uploadId,
    userId
}: {
    readonly expectedSize: number;
    readonly totalChunks: number;
    readonly uploadId: string;
    readonly userId: unknown;
}): Promise<Buffer> {
    const chunks = await Promise.all(
        Array.from({ length: totalChunks }, async (_, index) =>
            readFile(chunkPath(userId, uploadId, index))
        )
    );
    const buffer = Buffer.concat(chunks);
    if (buffer.length !== expectedSize) {
        throw new Error('Scan upload size did not match.');
    }
    return buffer;
}

export async function storeScanUpload({
    buffer,
    fileName,
    mimeType,
    uploadId,
    userId
}: {
    readonly buffer: Buffer;
    readonly fileName?: string;
    readonly mimeType: AllowedScanImageType;
    readonly uploadId: string;
    readonly userId: unknown;
}): Promise<StoredScanAttachment> {
    const dir = scanUploadDir(userId, uploadId);
    await mkdir(dir, { recursive: true });
    await writeFile(imagePath(userId, uploadId), buffer);
    await writeFile(
        metadataPath(userId, uploadId),
        JSON.stringify({
            createdAt: new Date().toISOString(),
            fileName: normalizedFileName(fileName),
            mimeType,
            size: buffer.length,
            uploadId
        } satisfies StoredScanMetadata)
    );
    await rm(chunksDir(userId, uploadId), { force: true, recursive: true });
    return {
        fileName: normalizedFileName(fileName),
        mimeType,
        uploadId
    };
}

export async function readScanUploadAttachment(
    userId: unknown,
    uploadId: string
): Promise<NonNullable<TransactionScanDecisionBody['attachment']>> {
    if (!isScanUploadId(uploadId)) {
        throw new Error('Invalid scan upload.');
    }

    const metadata = JSON.parse(
        await readFile(metadataPath(userId, uploadId), 'utf8')
    ) as StoredScanMetadata;
    if (!isAllowedScanImageType(metadata.mimeType)) {
        throw new Error('Invalid scan upload.');
    }

    const buffer = await readFile(imagePath(userId, uploadId));
    const sizeError = scanUploadFileSizeError(buffer.length);
    if (sizeError || buffer.length !== metadata.size) {
        throw new Error('Invalid scan upload.');
    }

    return {
        imageBase64: buffer.toString('base64'),
        mimeType: metadata.mimeType,
        fileName: normalizedFileName(metadata.fileName)
    };
}

export async function deleteScanUpload(
    userId: unknown,
    uploadId: string
): Promise<void> {
    if (!isScanUploadId(uploadId)) {
        return;
    }
    await rm(scanUploadDir(userId, uploadId), { force: true, recursive: true });
}
