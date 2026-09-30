import { ActionResult, type Handler } from '@cleverbrush/server';
import { getUserPreference } from '../../../../application/users.js';
import type { authScope } from '../scope.js';

/** Current user. */
export const getMeHandler: Handler<typeof authScope.endpoints.me> = async (
    { principal },
    { db }
) => {
    const preference = await getUserPreference(db, principal.userId);
    if (!preference) {
        return ActionResult.unauthorized({ message: 'User was not found.' });
    }
    return preference;
};
