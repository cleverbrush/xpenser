import { ActionResult, type Handler } from '@cleverbrush/server';
import {
    DuplicateEmailError,
    getUserPreference,
    InvalidCredentialsError,
    InvalidPassportIdentityError,
    issuePassportUserToken,
    issueUserToken,
    loginUser,
    PasswordMismatchError,
    registerUser,
    resolvePassportGoogleUser,
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
    GetMeEndpoint,
    LoginEndpoint,
    PassportExchangeEndpoint,
    PassportResolveUserEndpoint,
    RegisterEndpoint,
    SessionTokenEndpoint,
    UpdatePreferencesEndpoint
} from '../endpoints.js';

const webServiceSecretHeader = 'x-xpenser-web-secret';

export const registerHandler: Handler<typeof RegisterEndpoint> = async (
    { body },
    { db, config }
) => {
    try {
        return ActionResult.created(
            await registerUser(db, config, body),
            '/api/auth/me'
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
    try {
        return await loginUser(db, config, body.email, body.password);
    } catch (err) {
        if (err instanceof InvalidCredentialsError) {
            return ActionResult.unauthorized({ message: err.message });
        }
        throw err;
    }
};

export const passportResolveUserHandler: Handler<
    typeof PassportResolveUserEndpoint
> = async ({ body, context }, { db, config }) => {
    try {
        await authenticatePassportInternalToken(
            config,
            context.headers.authorization
        );
        return await resolvePassportGoogleUser(db, body);
    } catch (err) {
        if (err instanceof InvalidPassportIdentityError) {
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

export const sessionTokenHandler: Handler<typeof SessionTokenEndpoint> = async (
    { body, context },
    { db, config }
) => {
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
        body.defaultCurrency,
        body.favoriteCurrencies,
        body.timezone,
        body.weeklyEmailReportEnabled,
        body.monthlyEmailReportEnabled
    );
    if (!preference) {
        return ActionResult.unauthorized({ message: 'User was not found.' });
    }
    return preference;
};
