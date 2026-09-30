import { ActionResult, type Handler } from '@cleverbrush/server';
import { revokeApiKey } from '../../../../application/api-keys.js';
import type { usersScope } from '../scope.js';

/** Revoke API key. */
export const revokeApiKeyHandler: Handler<
    typeof usersScope.endpoints.revokeApiKey
> = async ({ params, principal }, { db }) => {
    await revokeApiKey(db, principal.userId, params.id);
    return ActionResult.noContent();
};
