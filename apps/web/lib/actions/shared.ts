import { createHash } from 'node:crypto';
import {
    type TransactionScanDecisionBody,
    type UpdateVendorBodySchema,
    UserAvatarLimits
} from '@xpenser/contracts';
import { cookies } from 'next/headers';
import { selectedBudgetCookie, selectedBudgetIdFromCookie } from '../budgets';
import { webConfig } from '../config';
import { VendorUpdateActionRejected } from '../log-templates';
import { loggerFor } from '../logger';

export const passportPkceCookie = 'xpenser_passport_pkce';
export const passportRedirectCookie = 'xpenser_passport_redirect';
export const vendorActionLogger = loggerFor('Vendor actions');

export type ScanDecisionAttachment =
    | NonNullable<TransactionScanDecisionBody['attachment']>
    | { readonly uploadId: string };

export type TransactionScanDecisionActionBody = Omit<
    TransactionScanDecisionBody,
    'attachment'
> & {
    readonly attachment?: ScanDecisionAttachment;
};

import { FormInputError } from '../form-errors';
import { pointerForField } from '../form-result';

export function normalizeFormText(value: string): string {
    return value.replace(/\r\n?/g, '\n').trim();
}

export function requiredString(formData: FormData, key: string): string {
    const value = formData.get(key);
    if (typeof value !== 'string' || normalizeFormText(value) === '') {
        throw new FormInputError(`${key} is required`, [
            { pointer: pointerForField(key), detail: `${key} is required` }
        ]);
    }
    return normalizeFormText(value);
}

export function optionalString(
    formData: FormData,
    key: string
): string | undefined {
    const value = formData.get(key);
    if (typeof value !== 'string' || normalizeFormText(value) === '') {
        return undefined;
    }
    return normalizeFormText(value);
}

export function nullableString(
    formData: FormData,
    key: string
): string | null | undefined {
    const value = formData.get(key);
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = normalizeFormText(value);
    return trimmed ? trimmed : null;
}

export function nullableStringIfPresent(
    formData: FormData,
    key: string
): string | null | undefined {
    return formData.has(key) ? nullableString(formData, key) : undefined;
}

export function booleanString(
    formData: FormData,
    key: string,
    defaultValue: boolean
): boolean {
    const value = formData.get(key);
    if (typeof value !== 'string') {
        return defaultValue;
    }
    return value === 'true';
}

export function checkboxString(formData: FormData, key: string): boolean {
    return formData.getAll(key).includes('true');
}

export function editableString(
    formData: FormData,
    key: string
): string | undefined {
    const value = formData.get(key);
    return typeof value === 'string' ? normalizeFormText(value) : undefined;
}

export function transactionTags(formData: FormData): string[] | undefined {
    const tags = formData
        .getAll('tags')
        .filter((value): value is string => typeof value === 'string')
        .map(normalizeFormText)
        .filter(Boolean);
    if (tags.length > 0 || formData.get('tagsTouched') === 'true') {
        return tags;
    }
    return undefined;
}

export function transactionBody(formData: FormData, editableNote = false) {
    const vendorId = optionalString(formData, 'vendorId');
    const tags = transactionTags(formData);
    return {
        categoryId: Number(requiredString(formData, 'categoryId')),
        vendorId: vendorId ? Number(vendorId) : null,
        amount: Number(requiredString(formData, 'amount')),
        currency: requiredString(formData, 'currency'),
        occurredAt: new Date(requiredString(formData, 'occurredAt')),
        note: editableNote
            ? editableString(formData, 'note')
            : optionalString(formData, 'note'),
        ...(tags !== undefined ? { tags } : {})
    };
}

export async function withSelectedBudget<T extends Record<string, unknown>>(
    body: T
): Promise<T & { readonly budgetId?: number }> {
    const budgetId = await selectedBudgetIdFromCookie();
    return budgetId ? { ...body, budgetId } : body;
}

export function vendorBody(formData: FormData) {
    return {
        name: requiredString(formData, 'name'),
        brandfetchBrandId: optionalString(formData, 'brandfetchBrandId'),
        resolvedName: optionalString(formData, 'resolvedName'),
        domain: optionalString(formData, 'domain'),
        logoUrl: optionalString(formData, 'logoUrl')
    };
}

export function vendorUpdateBody(formData: FormData) {
    return {
        name: requiredString(formData, 'name'),
        resolvedName: nullableStringIfPresent(formData, 'resolvedName'),
        domain: nullableStringIfPresent(formData, 'domain'),
        description: nullableStringIfPresent(formData, 'description'),
        logoUrl: nullableStringIfPresent(formData, 'logoUrl'),
        primaryColor: nullableStringIfPresent(formData, 'primaryColor')
    };
}

type VendorUpdateBody = ReturnType<typeof vendorUpdateBody>;

export function optionalLength(value: string | null | undefined): number {
    return typeof value === 'string' ? value.length : 0;
}

export function isHttpsUrl(value: string | null | undefined): boolean {
    if (typeof value !== 'string' || value.trim() === '') {
        return true;
    }
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

export function isPrimaryColor(value: string | null | undefined): boolean {
    if (typeof value !== 'string' || value.trim() === '') {
        return true;
    }
    return /^#[0-9a-f]{6}$/i.test(value.trim());
}

export function validationMessage(
    validationResult: ReturnType<typeof UpdateVendorBodySchema.validate>
): string | undefined {
    const invalidProperties =
        typeof validationResult.getInvalidProperties === 'function'
            ? validationResult.getInvalidProperties()
            : [];
    const propertyError = invalidProperties
        .flatMap(property => property.errors)
        .find(error => error.trim() !== '');
    if (propertyError) {
        return propertyError;
    }

    return validationResult.errors?.find(error => error.message.trim() !== '')
        ?.message;
}

export function logVendorUpdateRejection({
    apiMessage,
    apiStatus,
    body,
    localSchemaError,
    vendorId
}: {
    readonly apiMessage?: string;
    readonly apiStatus: number;
    readonly body: VendorUpdateBody;
    readonly localSchemaError?: string;
    readonly vendorId: number;
}) {
    vendorActionLogger.warn(VendorUpdateActionRejected, {
        ApiMessage: apiMessage,
        ApiStatus: apiStatus,
        DescriptionLength: optionalLength(body.description),
        DomainLength: optionalLength(body.domain),
        LocalSchemaError: localSchemaError,
        LocalSchemaValid: !localSchemaError,
        LogoUrlFormatValid: isHttpsUrl(body.logoUrl),
        LogoUrlLength: optionalLength(body.logoUrl),
        NameLength: body.name.length,
        PrimaryColorFormatValid: isPrimaryColor(body.primaryColor),
        PrimaryColorLength: optionalLength(body.primaryColor),
        VendorId: vendorId
    });
}

export function categoryBody(formData: FormData) {
    const parentId = optionalString(formData, 'parentId');

    return {
        name: requiredString(formData, 'name'),
        type: requiredString(formData, 'type') as 'expense' | 'income',
        parentId: parentId ? Number(parentId) : null,
        kind:
            formData.get('kind') === 'offset'
                ? ('offset' as const)
                : ('normal' as const)
    };
}

export function budgetCreateBody(formData: FormData) {
    const countryCode = optionalString(formData, 'countryCode');
    const defaultCurrency = requiredString(formData, 'defaultCurrency')
        .trim()
        .toUpperCase();
    return {
        name: requiredString(formData, 'name'),
        defaultCurrency,
        favoriteCurrencies: favoriteCurrencies(formData, defaultCurrency),
        ...(countryCode ? { countryCode: countryCode.toUpperCase() } : {})
    };
}

export function budgetUpdateBody(formData: FormData) {
    const name = optionalString(formData, 'name');
    const defaultCurrency = optionalString(formData, 'defaultCurrency')
        ?.trim()
        .toUpperCase();
    const countryCode = optionalString(formData, 'countryCode');
    return {
        ...(name ? { name } : {}),
        ...(defaultCurrency
            ? {
                  defaultCurrency,
                  favoriteCurrencies: favoriteCurrencies(
                      formData,
                      defaultCurrency
                  )
              }
            : {}),
        ...(countryCode ? { countryCode: countryCode.toUpperCase() } : {})
    };
}

export function budgetPermissions(formData: FormData) {
    return {
        canCreateTransactions: checkboxString(
            formData,
            'canCreateTransactions'
        ),
        canUpdateTransactions: checkboxString(
            formData,
            'canUpdateTransactions'
        ),
        canDeleteTransactions: checkboxString(
            formData,
            'canDeleteTransactions'
        ),
        canManageCategories: checkboxString(formData, 'canManageCategories'),
        canManageVendors: checkboxString(formData, 'canManageVendors'),
        canManageTags: checkboxString(formData, 'canManageTags'),
        canManageMembers: checkboxString(formData, 'canManageMembers')
    };
}

export function budgetMemberRole(formData: FormData): 'admin' | 'member' {
    return requiredString(formData, 'role') === 'admin' ? 'admin' : 'member';
}

export function favoriteCurrencies(
    formData: FormData,
    defaultCurrency: string
) {
    const normalizedDefault = defaultCurrency.trim().toUpperCase();
    return Array.from(
        new Set(
            formData
                .getAll('favoriteCurrencies')
                .filter((value): value is string => typeof value === 'string')
                .map(currency => currency.trim().toUpperCase())
                .filter(currency => /^[A-Z]{3}$/.test(currency))
                .filter(currency => currency !== normalizedDefault)
        )
    );
}

export function budgetDetailPath(budgetId: number): string {
    return `/settings/budgets/${budgetId}`;
}

export function avatarFile(formData: FormData): File {
    const value = formData.get('avatar');
    if (!(value instanceof File) || value.size === 0) {
        throw new Error('avatar is required');
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(value.type)) {
        throw new Error('avatar must be a PNG, JPEG, or WebP image');
    }
    if (value.size > UserAvatarLimits.maxImageBytes) {
        throw new Error('avatar image is too large');
    }
    return value;
}

export function apiErrorMessage(err: unknown): string | undefined {
    const body =
        typeof err === 'object' && err !== null && 'body' in err
            ? (err as { readonly body?: unknown }).body
            : undefined;
    if (
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body.message === 'string'
    ) {
        return body.message;
    }
    return undefined;
}

export function apiErrorStatus(err: unknown): number | undefined {
    return typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof err.status === 'number'
        ? err.status
        : undefined;
}

export function safeInternalRedirect(
    value: string | undefined
): string | undefined {
    if (!value?.startsWith('/') || value.startsWith('//')) {
        return undefined;
    }
    try {
        const url = new URL(value, webConfig.appUrl);
        if (url.origin !== new URL(webConfig.appUrl).origin) {
            return undefined;
        }
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return undefined;
    }
}

export function pkceChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

export function passportLoginUrl(codeChallenge: string): string {
    const { baseUrl, environment, project } = webConfig.passport;
    if (!baseUrl || !environment || !project) {
        throw new Error(
            'Passport sign-in requires PASSPORT_BASE_URL, PASSPORT_PROJECT, and PASSPORT_ENVIRONMENT.'
        );
    }

    const url = new URL('/login', baseUrl);
    url.searchParams.set('project', project);
    url.searchParams.set('env', environment);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
}

export async function clearSelectedBudgetIfNeeded(budgetId: number) {
    const selectedBudgetId = await selectedBudgetIdFromCookie();
    if (selectedBudgetId !== budgetId) {
        return;
    }
    const cookieStore = await cookies();
    cookieStore.delete(selectedBudgetCookie);
}

export function mcpOAuthAuthorizationBody(formData: FormData) {
    return {
        response_type: requiredString(formData, 'response_type'),
        client_id: requiredString(formData, 'client_id'),
        redirect_uri: requiredString(formData, 'redirect_uri'),
        code_challenge: requiredString(formData, 'code_challenge'),
        code_challenge_method: requiredString(
            formData,
            'code_challenge_method'
        ),
        state: optionalString(formData, 'state'),
        scope: optionalString(formData, 'scope')
    };
}
