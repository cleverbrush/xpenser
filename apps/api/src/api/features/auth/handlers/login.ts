import type { Handler } from '@cleverbrush/server';
import { loginUser } from '../../../../application/users.js';
import { accountAuthDisabled } from '../guards.js';
import type { authScope } from '../scope.js';

/** Login. */
export const loginHandler: Handler<typeof authScope.endpoints.login> = async (
    { body },
    { db, config }
) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    return await loginUser(db, config, body.email, body.password);
};
