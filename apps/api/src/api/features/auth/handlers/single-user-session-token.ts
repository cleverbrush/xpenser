import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    issueSingleUserToken,
    verifyWebApiServiceSecret
} from '../../../../application/users.js';
import { webServiceSecretHeader } from '../guards.js';
import type { authScope } from '../scope.js';

/** Single-user web session token. */
export const singleUserSessionTokenHandler: Handler<
    typeof authScope.endpoints.singleUserSessionToken
> = async ({ context }, { db, config }) => {
    if (
        !verifyWebApiServiceSecret(
            config,
            context.headers[webServiceSecretHeader]
        )
    ) {
        return ActionResult.unauthorized({
            message: 'Invalid web service credentials.'
        });
    }

    return await issueSingleUserToken(db, config);
};
