import type { Handler } from '@cleverbrush/server';
import { confirmEmail } from '../../../../application/users.js';
import { accountAuthDisabled } from '../guards.js';
import type { authScope } from '../scope.js';

/** Confirm email. */
export const confirmEmailHandler: Handler<
    typeof authScope.endpoints.confirmEmail
> = async ({ body }, { db, config }) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    return await confirmEmail(db, config, body.token);
};
