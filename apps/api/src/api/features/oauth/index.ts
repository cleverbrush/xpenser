import { authorizationRequestErrors } from './errors.js';
import { mcpOAuthAuthorizationRequestHandler } from './handlers/authorization-request.js';
import { mcpOAuthAuthorizeHandler } from './handlers/authorize.js';
import { oauthScope } from './scope.js';

/** Bind oauth handlers once; the root verifies complete contract coverage. */
export const oauthModule = oauthScope.withHandlers({
    authorizationRequest: {
        handler: mcpOAuthAuthorizationRequestHandler,
        errors: authorizationRequestErrors
    },
    authorize: {
        handler: mcpOAuthAuthorizeHandler,
        errors: authorizationRequestErrors
    }
});
