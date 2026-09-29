import { ActionResult, type Handler } from '@cleverbrush/server';
import { createApiKey } from '../../../../application/api-keys.js';
import type { usersScope } from '../scope.js';

/** Create API key. */
export const createApiKeyHandler: Handler<
    typeof usersScope.endpoints.createApiKey
> = async ({ body, principal }, { db }) => {
    const created = await createApiKey(db, principal.userId, body);
    return ActionResult.created(
        created,
        `/api/users/me/api-keys/${created.apiKey.id}`
    );
};
