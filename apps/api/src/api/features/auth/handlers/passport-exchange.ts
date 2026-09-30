import { ActionResult, type Handler } from '@cleverbrush/server';
import { issuePassportUserToken } from '../../../../application/users.js';
import {
    authenticatePassportAccessToken,
    exchangePassportCode
} from '../../../../security/passport.js';
import { accountAuthDisabled } from '../guards.js';
import type { authScope } from '../scope.js';

/** Passport code exchange. */
export const passportExchangeHandler: Handler<
    typeof authScope.endpoints.passportExchange
> = async ({ body }, { db, config }) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    const passportAccessToken = await exchangePassportCode(
        config,
        body.code,
        body.codeVerifier
    );
    const claims = await authenticatePassportAccessToken(
        config,
        passportAccessToken
    );
    const response = await issuePassportUserToken(db, config, claims.sub);
    if (!response) {
        return ActionResult.unauthorized({
            message: 'Passport user was not found.'
        });
    }
    return response;
};
