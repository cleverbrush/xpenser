import { ActionResult, errorMap } from '@cleverbrush/server';
import { OAuthError } from '../../../application/mcp-oauth.js';

/** Preserve the expected errors handled by oauth.authorizationRequest. */
export const authorizationRequestErrors = errorMap().on(OAuthError, err =>
    ActionResult.badRequest({ message: err.message })
);
