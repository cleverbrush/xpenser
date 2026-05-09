import { ActionResult, type Handler } from '@cleverbrush/server';
import { OAuth2Client } from 'google-auth-library';
import {
    DuplicateEmailError,
    getUserPreference,
    googleUser,
    InvalidCredentialsError,
    loginUser,
    PasswordMismatchError,
    registerUser,
    updateUserPreference
} from '../../application/users.js';
import type {
    GetMeEndpoint,
    GoogleAuthEndpoint,
    LoginEndpoint,
    RegisterEndpoint,
    UpdatePreferencesEndpoint
} from '../endpoints.js';

async function emailFromGoogleToken(
    idToken: string,
    clientId?: string
): Promise<string | undefined> {
    if (clientId) {
        try {
            const client = new OAuth2Client(clientId);
            const ticket = await client.verifyIdToken({
                idToken,
                audience: clientId
            });
            return ticket.getPayload()?.email;
        } catch {
            // Access tokens are handled below.
        }
    }

    const response = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
            headers: { Authorization: `Bearer ${idToken}` }
        }
    );
    if (!response.ok) {
        return undefined;
    }

    const info = (await response.json()) as { readonly email?: string };
    return info.email;
}

export const registerHandler: Handler<typeof RegisterEndpoint> = async (
    { body },
    { knex, config }
) => {
    try {
        return ActionResult.created(
            await registerUser(knex, config, body),
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
    { knex, config }
) => {
    try {
        return await loginUser(knex, config, body.email, body.password);
    } catch (err) {
        if (err instanceof InvalidCredentialsError) {
            return ActionResult.unauthorized({ message: err.message });
        }
        throw err;
    }
};

export const googleAuthHandler: Handler<typeof GoogleAuthEndpoint> = async (
    { body },
    { knex, config }
) => {
    const email = await emailFromGoogleToken(
        body.idToken,
        config.google.clientId
    );
    if (!email) {
        return ActionResult.unauthorized({ message: 'Invalid Google token.' });
    }
    return googleUser(knex, config, email);
};

export const getMeHandler: Handler<typeof GetMeEndpoint> = async (
    { principal },
    { knex }
) => {
    const preference = await getUserPreference(knex, principal.userId);
    if (!preference) {
        return ActionResult.unauthorized({ message: 'User was not found.' });
    }
    return preference;
};

export const updatePreferencesHandler: Handler<
    typeof UpdatePreferencesEndpoint
> = async ({ body, principal }, { knex }) => {
    const preference = await updateUserPreference(
        knex,
        principal.userId,
        body.defaultCurrency,
        body.favoriteCurrencies
    );
    if (!preference) {
        return ActionResult.unauthorized({ message: 'User was not found.' });
    }
    return preference;
};
