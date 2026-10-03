import { ActionResult, type Handler } from '@cleverbrush/server';
import { uploadedImageData } from '../../../../application/upload-images.js';
import { updateUserAvatar } from '../../../../application/user-avatars.js';
import type { usersScope } from '../scope.js';

/** Update user avatar. */
export const updateUserAvatarHandler: Handler<
    typeof usersScope.endpoints.updateAvatar
> = async ({ files, principal }, { db }) => {
    const preference = await updateUserAvatar(
        db,
        principal.userId,
        uploadedImageData(files.avatar)
    );
    if (!preference) {
        return ActionResult.unauthorized({
            message: 'User was not found.'
        });
    }
    return preference;
};
