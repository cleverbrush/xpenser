import type { Handler } from '@cleverbrush/server';
import { listApiKeys } from '../../../../application/api-keys.js';
import type { usersScope } from '../scope.js';

/** List API keys. */
export const listApiKeysHandler: Handler<
    typeof usersScope.endpoints.listApiKeys
> = async ({ principal }, { db }) => {
    return listApiKeys(db, principal.userId);
};
