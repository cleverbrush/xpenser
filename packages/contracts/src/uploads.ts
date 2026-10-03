import { number, object } from '@cleverbrush/schema';
import { file } from '@cleverbrush/server/contract';
import { TransactionScanLimits, UserAvatarLimits } from './limits.js';

/** Explicit resource bounds shared by the server and generated API documentation. */
const imageUploadLimits = {
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxFileCount: 1,
    maxFieldCount: 1,
    maxFieldSize: 32,
    maxFieldNameSize: 32,
    maxPartCount: 2
};

export const avatarUploadLimits = {
    ...imageUploadLimits,
    maxFileSize: UserAvatarLimits.maxImageBytes,
    maxPartCount: 1
};
export const scanUploadLimits = {
    ...imageUploadLimits,
    maxFileSize: TransactionScanLimits.maxImageBytes
};
export const AvatarUploadSchema = object({ avatar: file() });
export const ScanUploadSchema = object({ image: file() });
/** Multipart text fields; the image is a separate, required file part. */
export const ScanUploadBodySchema = object({
    budgetId: number().coerce().optional()
});
