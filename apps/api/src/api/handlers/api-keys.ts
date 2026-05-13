import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    ApiKeyNotFoundError,
    createApiKey,
    listApiKeys,
    revokeApiKey
} from '../../application/api-keys.js';
import type {
    CreateApiKeyEndpoint,
    ListApiKeysEndpoint,
    RevokeApiKeyEndpoint
} from '../endpoints.js';

export const listApiKeysHandler: Handler<typeof ListApiKeysEndpoint> = async (
    { principal },
    { db }
) => {
    return listApiKeys(db, principal.userId);
};

export const createApiKeyHandler: Handler<typeof CreateApiKeyEndpoint> = async (
    { body, principal },
    { db }
) => {
    const created = await createApiKey(db, principal.userId, body);
    return ActionResult.created(
        created,
        `/api/users/me/api-keys/${created.apiKey.id}`
    );
};

export const revokeApiKeyHandler: Handler<typeof RevokeApiKeyEndpoint> = async (
    { params, principal },
    { db }
) => {
    try {
        await revokeApiKey(db, principal.userId, params.id);
        return ActionResult.noContent();
    } catch (err) {
        if (err instanceof ApiKeyNotFoundError) {
            return ActionResult.notFound({ message: err.message });
        }
        throw err;
    }
};
