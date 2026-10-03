import type { FilePart } from '@cleverbrush/server';
import { ImageMimeTypeSchema } from '@xpenser/contracts';

/** Keep durable payloads and database storage independent of the HTTP transport. */
export function uploadedImageData(file: FilePart) {
    return {
        imageBase64: file.buffer.toString('base64'),
        mimeType: ImageMimeTypeSchema.parse(file.mimeType),
        fileName: file.filename || undefined
    };
}
