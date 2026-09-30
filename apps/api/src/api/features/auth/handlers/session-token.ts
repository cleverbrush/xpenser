import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    issueUserToken,
    verifyWebApiServiceSecret
} from '../../../../application/users.js';
import { accountAuthDisabled, webServiceSecretHeader } from '../guards.js';
import type { authScope } from '../scope.js';

/** Web session token. */
export const sessionTokenHandler: Handler<
    typeof authScope.endpoints.sessionToken
> = async ({ body, context }, { db, config }) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

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

    const response = await issueUserToken(db, config, body.userId);
    if (!response) {
        return ActionResult.unauthorized({ message: 'User was not found.' });
    }

    return response;
};
