import type {
    AuthenticationContext,
    AuthenticationResult,
    AuthenticationScheme
} from '@cleverbrush/auth';
import { jwtScheme, Principal } from '@cleverbrush/auth';
import { authenticateApiKey, parseApiKey } from '../application/api-keys.js';
import { isUserAllowedInSingleUserMode } from '../application/users.js';
import type { Config } from '../config.js';
import type { AppDb } from '../db/schemas.js';

type XpenserPrincipal = {
    readonly userId: number;
    readonly role: string;
    readonly authType: 'jwt' | 'api_key';
    readonly apiKeyId?: number;
};

function bearerToken(context: AuthenticationContext): string | undefined {
    const header = context.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
        return undefined;
    }

    const token = header.slice(7).trim();
    return token || undefined;
}

function headerApiKey(context: AuthenticationContext): string | undefined {
    const value = context.headers['x-api-key']?.trim();
    return value || undefined;
}

function apiKeyClaims(
    userId: number,
    role: string,
    apiKeyId: number
): Map<string, string | string[]> {
    return new Map([
        ['sub', String(userId)],
        ['role', role],
        ['auth_type', 'api_key'],
        ['api_key_id', String(apiKeyId)]
    ]);
}

/**
 * Authenticates regular app JWTs and durable user API keys.
 *
 * Cleverbrush currently runs only the configured default auth scheme, so this
 * composite scheme keeps xpenser's two credential types behind one scheme.
 */
export function xpenserAuthScheme(
    config: Config,
    db: AppDb
): AuthenticationScheme<XpenserPrincipal> {
    const jwt = jwtScheme<XpenserPrincipal>({
        secret: config.jwt.secret,
        mapClaims: claims => ({
            userId: Number(claims.sub),
            role: claims.role as string,
            authType: 'jwt'
        })
    });

    async function authenticateKey(
        token: string
    ): Promise<AuthenticationResult<XpenserPrincipal>> {
        const principal = await authenticateApiKey(db, token);
        if (!principal) {
            return {
                succeeded: false,
                failure: 'Invalid API key'
            };
        }
        if (
            !(await isUserAllowedInSingleUserMode(db, config, principal.userId))
        ) {
            return {
                succeeded: false,
                failure:
                    'Credential does not belong to the configured single user'
            };
        }

        return {
            succeeded: true,
            principal: new Principal(
                true,
                {
                    userId: principal.userId,
                    role: principal.role,
                    authType: 'api_key',
                    apiKeyId: principal.apiKeyId
                },
                apiKeyClaims(
                    principal.userId,
                    principal.role,
                    principal.apiKeyId
                )
            )
        };
    }

    return {
        name: 'xpenser',
        async authenticate(context) {
            const explicitApiKey = headerApiKey(context);
            if (explicitApiKey) {
                return authenticateKey(explicitApiKey);
            }

            const token = bearerToken(context);
            if (token && parseApiKey(token)) {
                return authenticateKey(token);
            }

            const result = await jwt.authenticate(context);
            if (
                result.succeeded &&
                result.principal.hasClaim('auth_type', 'mcp_oauth')
            ) {
                return {
                    succeeded: false,
                    failure:
                        'MCP OAuth tokens are only accepted by the MCP endpoint'
                };
            }
            const principal = result.succeeded
                ? result.principal.value
                : undefined;
            if (
                result.succeeded &&
                (!principal ||
                    !(await isUserAllowedInSingleUserMode(
                        db,
                        config,
                        principal.userId
                    )))
            ) {
                return {
                    succeeded: false,
                    failure:
                        'Credential does not belong to the configured single user'
                };
            }

            return result;
        },
        challenge() {
            return {
                headerName: 'WWW-Authenticate',
                headerValue: 'Bearer'
            };
        }
    };
}
