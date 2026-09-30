import type { Handler } from '@cleverbrush/server';
import { resolvePassportGoogleUser } from '../../../../application/users.js';
import { authenticatePassportInternalToken } from '../../../../security/passport.js';
import { accountAuthDisabled } from '../guards.js';
import type { authScope } from '../scope.js';

/** Passport user resolution. */
export const passportResolveUserHandler: Handler<
    typeof authScope.endpoints.passportResolveUser
> = async ({ body, context }, { db, config }) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    await authenticatePassportInternalToken(
        config,
        context.headers.authorization
    );
    return await resolvePassportGoogleUser(db, body);
};
