import { ActionResult, type Handler } from '@cleverbrush/server';
import { getUserAvatarImage } from '../../../../application/user-avatars.js';
import type { usersScope } from '../scope.js';

/** User avatar image. */
export const userAvatarImageHandler: Handler<
    typeof usersScope.endpoints.avatarImage
> = async ({ params, principal }, { db }) => {
    const image = await getUserAvatarImage(db, principal.userId, params.id);
    if (!image) {
        return ActionResult.notFound({
            message: 'Avatar image was not found.'
        });
    }

    return ActionResult.raw(async (_request, response) => {
        const buffer = Buffer.from(image.imageBase64, 'base64');
        response.setHeader('Content-Type', image.mimeType);
        response.setHeader('Content-Length', String(buffer.byteLength));
        response.setHeader('Cache-Control', 'private, max-age=300');
        if (image.fileName) {
            response.setHeader(
                'Content-Disposition',
                `inline; filename="${image.fileName.replaceAll('"', '')}"`
            );
        }
        if (image.updatedAt) {
            response.setHeader('Last-Modified', image.updatedAt.toUTCString());
        }
        response.end(buffer);
    });
};
