import type { Handler } from '@cleverbrush/server';
import { resendEmailConfirmation } from '../../../../application/users.js';
import { accountAuthDisabled } from '../guards.js';
import type { authScope } from '../scope.js';

/** Resend email confirmation. */
export const resendEmailConfirmationHandler: Handler<
    typeof authScope.endpoints.resendEmailConfirmation
> = async ({ body }, { db, config }) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    return await resendEmailConfirmation(db, config, body.email);
};
