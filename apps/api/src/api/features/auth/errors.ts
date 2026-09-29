import { ActionResult, errorMap } from '@cleverbrush/server';
import {
    DuplicateEmailError,
    EmailNotVerifiedError,
    InvalidCredentialsError,
    InvalidEmailConfirmationTokenError,
    InvalidGoogleIdentityError,
    InvalidPassportIdentityError,
    PasswordMismatchError,
    SingleUserModeDisabledError
} from '../../../application/users.js';
import { PassportAuthError } from '../../../security/passport.js';

/** Preserve the expected errors handled by auth.register. */
export const registerErrors = errorMap()
    .on(DuplicateEmailError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(PasswordMismatchError, err =>
        ActionResult.badRequest({ message: err.message })
    );

/** Preserve the expected errors handled by auth.login. */
export const loginErrors = errorMap()
    .on(InvalidCredentialsError, err =>
        ActionResult.unauthorized({ message: err.message })
    )
    .on(EmailNotVerifiedError, err =>
        ActionResult.forbidden({ message: err.message })
    );

/** Preserve the expected errors handled by auth.confirmEmail. */
export const confirmEmailErrors = errorMap().on(
    InvalidEmailConfirmationTokenError,
    err => ActionResult.badRequest({ message: err.message })
);

/** Preserve the expected errors handled by auth.passportResolveUser. */
export const passportResolveUserErrors = errorMap()
    .on(InvalidGoogleIdentityError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(InvalidPassportIdentityError, err =>
        ActionResult.badRequest({ message: err.message })
    )
    .on(PassportAuthError, err =>
        ActionResult.unauthorized({ message: err.message })
    );

/** Preserve the expected errors handled by auth.passportExchange. */
export const passportExchangeErrors = errorMap().on(PassportAuthError, err =>
    ActionResult.unauthorized({ message: err.message })
);

/** Preserve the expected errors handled by auth.googleSignIn. */
export const googleSignInErrors = errorMap().on(
    InvalidGoogleIdentityError,
    err => ActionResult.badRequest({ message: err.message })
);

/** Preserve the expected errors handled by auth.singleUserSessionToken. */
export const singleUserSessionTokenErrors = errorMap().on(
    SingleUserModeDisabledError,
    err => ActionResult.notFound({ message: err.message })
);
