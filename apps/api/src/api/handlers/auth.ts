import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    confirmEmail,
    DuplicateEmailError,
    EmailNotVerifiedError,
    getUserPreference,
    InvalidCredentialsError,
    InvalidEmailConfirmationTokenError,
    InvalidGoogleIdentityError,
    InvalidPassportIdentityError,
    issueGoogleUserToken,
    issuePassportUserToken,
    issueSingleUserToken,
    issueUserToken,
    loginUser,
    PasswordMismatchError,
    registerUser,
    resendEmailConfirmation,
    resolvePassportGoogleUser,
    SingleUserModeDisabledError,
    updateUserPreference,
    verifyWebApiServiceSecret
} from '../../application/users.js';
import {
    authenticatePassportAccessToken,
    authenticatePassportInternalToken,
    exchangePassportCode,
    PassportAuthError
} from '../../security/passport.js';
import type {
    ConfirmEmailEndpoint,
    GetMeEndpoint,
    GoogleSignInEndpoint,
    LoginEndpoint,
    PassportExchangeEndpoint,
    PassportResolveUserEndpoint,
    RegisterEndpoint,
    ResendEmailConfirmationEndpoint,
    SessionTokenEndpoint,
    SingleUserSessionTokenEndpoint,
    UpdatePreferencesEndpoint
} from '../endpoints.js';

const webServiceSecretHeader = 'x-xpenser-web-secret';

function accountAuthDisabled(config: {
    readonly singleUser?: { readonly enabled: boolean };
}) {
    if (!config.singleUser?.enabled) {
        return undefined;
    }

    return ActionResult.unauthorized({
        message: 'Account authentication is disabled in single-user mode.'
    });
}

export const registerHandler: Handler<typeof RegisterEndpoint> = async (
    { body },
    { db, config }
) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    try {
        return ActionResult.created(
            await registerUser(db, config, body),
            '/api/auth/email/confirm'
        );
    } catch (err) {
        if (
            err instanceof DuplicateEmailError ||
            err instanceof PasswordMismatchError
        ) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const loginHandler: Handler<typeof LoginEndpoint> = async (
    { body },
    { db, config }
) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    try {
        return await loginUser(db, config, body.email, body.password);
    } catch (err) {
        if (err instanceof InvalidCredentialsError) {
            return ActionResult.unauthorized({ message: err.message });
        }
        if (err instanceof EmailNotVerifiedError) {
            return ActionResult.forbidden({ message: err.message });
        }
        throw err;
    }
};

export const confirmEmailHandler: Handler<typeof ConfirmEmailEndpoint> = async (
    { body },
    { db, config }
) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    try {
        return await confirmEmail(db, config, body.token);
    } catch (err) {
        if (err instanceof InvalidEmailConfirmationTokenError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const resendEmailConfirmationHandler: Handler<
    typeof ResendEmailConfirmationEndpoint
> = async ({ body }, { db, config }) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    return await resendEmailConfirmation(db, config, body.email);
};

export const passportResolveUserHandler: Handler<
    typeof PassportResolveUserEndpoint
> = async ({ body, context }, { db, config }) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    try {
        await authenticatePassportInternalToken(
            config,
            context.headers.authorization
        );
        return await resolvePassportGoogleUser(db, body);
    } catch (err) {
        if (
            err instanceof InvalidGoogleIdentityError ||
            err instanceof InvalidPassportIdentityError
        ) {
            return ActionResult.badRequest({ message: err.message });
        }
        if (err instanceof PassportAuthError) {
            return ActionResult.unauthorized({ message: err.message });
        }
        throw err;
    }
};

export const passportExchangeHandler: Handler<
    typeof PassportExchangeEndpoint
> = async ({ body }, { db, config }) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    try {
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
    } catch (err) {
        if (err instanceof PassportAuthError) {
            return ActionResult.unauthorized({ message: err.message });
        }
        throw err;
    }
};

export const googleSignInHandler: Handler<typeof GoogleSignInEndpoint> = async (
    { body, context },
    { db, config }
) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    if (
        !verifyWebApiServiceSecret(
            config,
            context.headers[webServiceSecretHeader]
        )
    ) {
        return ActionResult.unauthorized({
            message: 'Invalid web service credentials.'
        });
    }

    try {
        return await issueGoogleUserToken(db, config, body);
    } catch (err) {
        if (err instanceof InvalidGoogleIdentityError) {
            return ActionResult.badRequest({ message: err.message });
        }
        throw err;
    }
};

export const sessionTokenHandler: Handler<typeof SessionTokenEndpoint> = async (
    { body, context },
    { db, config }
) => {
    const disabled = accountAuthDisabled(config);
    if (disabled) {
        return disabled;
    }

    if (
        !verifyWebApiServiceSecret(
            config,
            context.headers[webServiceSecretHeader]
        )
    ) {
        return ActionResult.unauthorized({
            message: 'Invalid web service credentials.'
        });
    }

    const response = await issueUserToken(db, config, body.userId);
    if (!response) {
        return ActionResult.unauthorized({ message: 'User was not found.' });
    }

    return response;
};

export const singleUserSessionTokenHandler: Handler<
    typeof SingleUserSessionTokenEndpoint
> = async ({ context }, { db, config }) => {
    if (
        !verifyWebApiServiceSecret(
            config,
            context.headers[webServiceSecretHeader]
        )
    ) {
        return ActionResult.unauthorized({
            message: 'Invalid web service credentials.'
        });
    }

    try {
        return await issueSingleUserToken(db, config);
    } catch (err) {
        if (err instanceof SingleUserModeDisabledError) {
            return ActionResult.notFound({ message: err.message });
        }
        throw err;
    }
};

export const getMeHandler: Handler<typeof GetMeEndpoint> = async (
    { principal },
    { db }
) => {
    const preference = await getUserPreference(db, principal.userId);
    if (!preference) {
        return ActionResult.unauthorized({ message: 'User was not found.' });
    }
    return preference;
};

export const updatePreferencesHandler: Handler<
    typeof UpdatePreferencesEndpoint
> = async ({ body, principal }, { db }) => {
    const preference = await updateUserPreference(
        db,
        principal.userId,
        body.countryCode,
        body.timezone,
        body.weeklyEmailReportEnabled,
        body.monthlyEmailReportEnabled
    );
    if (!preference) {
        return ActionResult.unauthorized({ message: 'User was not found.' });
    }
    return preference;
};
