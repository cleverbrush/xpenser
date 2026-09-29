import { ActionResult, type Handler } from '@cleverbrush/server';
import { registerUser } from '../../../../application/users.js';
import { accountAuthDisabled } from '../guards.js';
import type { authScope } from '../scope.js';

/** Register. */
export const registerHandler: Handler<
    typeof authScope.endpoints.register
> = async ({ body }, { db, config }) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    return ActionResult.created(
        await registerUser(db, config, body),
        '/api/auth/email/confirm'
    );
};
