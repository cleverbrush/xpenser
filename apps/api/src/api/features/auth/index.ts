import {
    confirmEmailErrors,
    googleSignInErrors,
    loginErrors,
    passportExchangeErrors,
    passportResolveUserErrors,
    registerErrors,
    singleUserSessionTokenErrors
} from './errors.js';
import { confirmEmailHandler } from './handlers/confirm-email.js';
import { googleSignInHandler } from './handlers/google-sign-in.js';
import { loginHandler } from './handlers/login.js';
import { getMeHandler } from './handlers/me.js';
import { passportExchangeHandler } from './handlers/passport-exchange.js';
import { passportResolveUserHandler } from './handlers/passport-resolve-user.js';
import { registerHandler } from './handlers/register.js';
import { resendEmailConfirmationHandler } from './handlers/resend-email-confirmation.js';
import { sessionTokenHandler } from './handlers/session-token.js';
import { singleUserSessionTokenHandler } from './handlers/single-user-session-token.js';
import { authScope } from './scope.js';

/** Bind auth handlers once; the root verifies complete contract coverage. */
export const authModule = authScope.withHandlers({
    register: { handler: registerHandler, errors: registerErrors },
    login: { handler: loginHandler, errors: loginErrors },
    confirmEmail: { handler: confirmEmailHandler, errors: confirmEmailErrors },
    resendEmailConfirmation: resendEmailConfirmationHandler,
    passportResolveUser: {
        handler: passportResolveUserHandler,
        errors: passportResolveUserErrors
    },
    passportExchange: {
        handler: passportExchangeHandler,
        errors: passportExchangeErrors
    },
    googleSignIn: { handler: googleSignInHandler, errors: googleSignInErrors },
    sessionToken: sessionTokenHandler,
    singleUserSessionToken: {
        handler: singleUserSessionTokenHandler,
        errors: singleUserSessionTokenErrors
    },
    me: getMeHandler
});
