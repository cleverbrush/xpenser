import type { TokenResponse } from '@xpenser/contracts';

export const ApiTokenRefreshSkewSeconds = 5 * 60;

type ApiSessionToken = {
    apiToken?: string;
    apiTokenExpiresAt?: string;
    sub?: string;
    email?: string | null;
    role?: string;
    defaultCurrency?: string;
    countryCode?: string;
    timezone?: string;
    hasCategories?: boolean;
};

export function apiTokenExpiresAt(value: Date | string): string {
    const expiresAt = value instanceof Date ? value : new Date(value);
    return Number.isNaN(expiresAt.getTime()) ? '' : expiresAt.toISOString();
}

export function shouldRefreshApiToken(
    token: Pick<ApiSessionToken, 'apiToken' | 'apiTokenExpiresAt'>,
    now = Date.now()
): boolean {
    if (!token.apiToken) {
        return false;
    }
    if (!token.apiTokenExpiresAt) {
        return true;
    }

    const expiresAt = Date.parse(token.apiTokenExpiresAt);
    if (Number.isNaN(expiresAt)) {
        return true;
    }

    return expiresAt - now <= ApiTokenRefreshSkewSeconds * 1000;
}

export function applyTokenResponse<T extends ApiSessionToken>(
    token: T,
    response: TokenResponse
): T {
    token.apiToken = response.token;
    token.apiTokenExpiresAt = apiTokenExpiresAt(response.expiresAt);
    token.sub = String(response.user.id);
    token.email = response.user.email;
    token.role = response.user.role;
    token.defaultCurrency = response.user.defaultCurrency;
    token.countryCode = response.user.countryCode;
    token.timezone = response.user.timezone;
    token.hasCategories = response.user.hasCategories;
    return token;
}
