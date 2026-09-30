import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    issueGoogleUserToken,
    verifyWebApiServiceSecret
} from '../../../../application/users.js';
import { accountAuthDisabled, webServiceSecretHeader } from '../guards.js';
import type { authScope } from '../scope.js';

/** Direct Google sign-in. */
export const googleSignInHandler: Handler<
    typeof authScope.endpoints.googleSignIn
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

    return await issueGoogleUserToken(db, config, body);
};
