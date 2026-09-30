import { ActionResult, type Handler } from '@cleverbrush/server';
import { deleteUserAvatar } from '../../../../application/user-avatars.js';
import type { usersScope } from '../scope.js';

/** Delete user avatar. */
export const deleteUserAvatarHandler: Handler<
    typeof usersScope.endpoints.deleteAvatar
> = async ({ principal }, { db }) => {
    const preference = await deleteUserAvatar(db, principal.userId);
    if (!preference) {
        return ActionResult.unauthorized({ message: 'User was not found.' });
    }
    return preference;
};
