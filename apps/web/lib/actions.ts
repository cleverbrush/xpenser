'use server';

import { createHash, randomBytes } from 'node:crypto';
import {
    type Category,
    type Transaction,
    type TransactionScanDecisionBody,
    type TransactionScanImageResponse,
    UpdateVendorBodySchema,
    type Vendor,
    type VendorCandidate
} from '@xpenser/contracts';
import { revalidatePath, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { signIn, signOut } from '../auth';
import {
    getAnonymousApiClient,
    getApiClient,
    getSessionOrRedirect
} from './api';
import { getGoogleSignInProvider, webConfig } from './config';
import { VendorUpdateActionRejected } from './log-templates';
import { loggerFor } from './logger';
import {
    deleteScanUpload,
    readScanUploadAttachment
} from './transaction-scan-upload-store';

const passportPkceCookie = 'xpenser_passport_pkce';
const passportRedirectCookie = 'xpenser_passport_redirect';
const vendorActionLogger = loggerFor('Vendor actions');

type ScanDecisionAttachment =
    | NonNullable<TransactionScanDecisionBody['attachment']>
    | { readonly uploadId: string };

type TransactionScanDecisionActionBody = Omit<
    TransactionScanDecisionBody,
    'attachment'
> & {
    readonly attachment?: ScanDecisionAttachment;
};

function normalizeFormText(value: string): string {
    return value.replace(/\r\n?/g, '\n').trim();
}

function requiredString(formData: FormData, key: string): string {
    const value = formData.get(key);
    if (typeof value !== 'string' || normalizeFormText(value) === '') {
        throw new Error(`${key} is required`);
    }
    return normalizeFormText(value);
}

function optionalString(formData: FormData, key: string): string | undefined {
    const value = formData.get(key);
    if (typeof value !== 'string' || normalizeFormText(value) === '') {
        return undefined;
    }
    return normalizeFormText(value);
}

function nullableString(
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

function nullableStringIfPresent(
    formData: FormData,
    key: string
): string | null | undefined {
    return formData.has(key) ? nullableString(formData, key) : undefined;
}

function booleanString(
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

function editableString(formData: FormData, key: string): string | undefined {
    const value = formData.get(key);
    return typeof value === 'string' ? normalizeFormText(value) : undefined;
}

function transactionTags(formData: FormData): string[] | undefined {
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

function transactionBody(formData: FormData, editableNote = false) {
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

function vendorBody(formData: FormData) {
    return {
        name: requiredString(formData, 'name'),
        brandfetchBrandId: optionalString(formData, 'brandfetchBrandId'),
        resolvedName: optionalString(formData, 'resolvedName'),
        domain: optionalString(formData, 'domain'),
        logoUrl: optionalString(formData, 'logoUrl')
    };
}

function vendorUpdateBody(formData: FormData) {
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

function optionalLength(value: string | null | undefined): number {
    return typeof value === 'string' ? value.length : 0;
}

function isHttpsUrl(value: string | null | undefined): boolean {
    if (typeof value !== 'string' || value.trim() === '') {
        return true;
    }
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

function isPrimaryColor(value: string | null | undefined): boolean {
    if (typeof value !== 'string' || value.trim() === '') {
        return true;
    }
    return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function validationMessage(
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

function logVendorUpdateRejection({
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

function categoryBody(formData: FormData) {
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

function favoriteCurrencies(formData: FormData, defaultCurrency: string) {
    return formData
        .getAll('favoriteCurrencies')
        .filter((value): value is string => typeof value === 'string')
        .filter(currency => currency !== defaultCurrency);
}

function apiErrorMessage(err: unknown): string | undefined {
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

function apiErrorStatus(err: unknown): number | undefined {
    return typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof err.status === 'number'
        ? err.status
        : undefined;
}

function safeInternalRedirect(value: string | undefined): string | undefined {
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

function pkceChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

function passportLoginUrl(codeChallenge: string): string {
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

export async function loginAction(formData: FormData) {
    const email = requiredString(formData, 'email');
    const password = requiredString(formData, 'password');
    try {
        await getAnonymousApiClient().auth.login({
            body: { email, password }
        });
    } catch (err) {
        const status = apiErrorStatus(err);
        if (status === 403) {
            return {
                error:
                    apiErrorMessage(err) ??
                    'Confirm your email before signing in.',
                unverifiedEmail: email
            };
        }
        if (status === 401) {
            return {
                error: 'Could not sign in. Check your email and password.'
            };
        }
        throw err;
    }

    await signIn('credentials', {
        email,
        password,
        redirectTo:
            safeInternalRedirect(optionalString(formData, 'redirectTo')) ??
            '/dashboard'
    });
}

export async function registerAction(formData: FormData) {
    const email = requiredString(formData, 'email');
    const password = requiredString(formData, 'password');
    const defaultCurrency = requiredString(formData, 'defaultCurrency');
    try {
        return await getAnonymousApiClient().auth.register({
            body: {
                email,
                password,
                confirmPassword: requiredString(formData, 'confirmPassword'),
                defaultCurrency,
                countryCode: requiredString(formData, 'countryCode')
                    .trim()
                    .toUpperCase(),
                favoriteCurrencies: favoriteCurrencies(
                    formData,
                    defaultCurrency
                ),
                timezone: optionalString(formData, 'timezone') ?? 'UTC'
            }
        });
    } catch (err) {
        if (apiErrorStatus(err) === 400) {
            return {
                error:
                    apiErrorMessage(err) ??
                    'Could not create the account. Try a different email.'
            };
        }
        throw err;
    }
}

export async function resendEmailConfirmationAction(formData: FormData) {
    try {
        return await getAnonymousApiClient().auth.resendEmailConfirmation({
            body: {
                email: requiredString(formData, 'email')
            }
        });
    } catch (err) {
        return {
            error: apiErrorMessage(err) ?? 'Could not send a confirmation link.'
        };
    }
}

export async function googleSignInAction(formData: FormData) {
    const provider = getGoogleSignInProvider();
    const redirectTo =
        safeInternalRedirect(optionalString(formData, 'redirectTo')) ??
        '/dashboard';
    if (provider === 'direct') {
        await signIn('google', { redirectTo });
        return;
    }
    if (provider === 'disabled') {
        redirect('/login');
    }

    const verifier = randomBytes(32).toString('base64url');
    const cookieStore = await cookies();
    cookieStore.set(passportPkceCookie, verifier, {
        httpOnly: true,
        secure: webConfig.appUrl.startsWith('https://'),
        sameSite: 'lax',
        path: '/auth/callback',
        maxAge: 10 * 60
    });
    cookieStore.set(passportRedirectCookie, redirectTo, {
        httpOnly: true,
        secure: webConfig.appUrl.startsWith('https://'),
        sameSite: 'lax',
        path: '/auth/callback',
        maxAge: 10 * 60
    });
    redirect(passportLoginUrl(pkceChallenge(verifier)));
}

export async function logoutAction() {
    await signOut({ redirectTo: '/' });
}

export async function createCategoryAction(
    formData: FormData
): Promise<Category> {
    const client = await getApiClient();
    const category = await client.categories.create({
        body: categoryBody(formData)
    });
    revalidateTag('categories', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/settings/categories');
    revalidatePath('/settings/preferences');
    revalidatePath('/setup/categories');
    return category;
}

export async function createFirstCategoryAction(formData: FormData) {
    await createCategoryAction(formData);
    redirect('/dashboard');
}

export async function updateCategoryAction(formData: FormData) {
    const client = await getApiClient();
    await client.categories.update({
        params: { id: Number(requiredString(formData, 'id')) },
        body: categoryBody(formData)
    });
    revalidateTag('categories', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('dashboard', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/settings/categories');
    revalidatePath('/settings/preferences');
    revalidatePath('/setup/categories');
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/vendors');
    revalidatePath('/settings/vendors');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}

export async function setCategoryArchivedAction(formData: FormData) {
    const client = await getApiClient();
    await client.categories.update({
        params: { id: Number(requiredString(formData, 'id')) },
        body: {
            archived: booleanString(formData, 'archived', false)
        }
    });
    revalidateTag('categories', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('dashboard', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/settings/categories');
    revalidatePath('/settings/preferences');
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}

export async function deleteCategoryAction(formData: FormData) {
    const client = await getApiClient();
    await client.categories.delete({
        params: { id: Number(requiredString(formData, 'id')) }
    });
    revalidateTag('categories', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/settings/categories');
    revalidatePath('/settings/preferences');
}

export async function moveAndDeleteCategoryAction(formData: FormData) {
    const client = await getApiClient();
    await client.categories.moveAndDelete({
        params: { id: Number(requiredString(formData, 'id')) },
        body: {
            replacementCategoryId: Number(
                requiredString(formData, 'replacementCategoryId')
            )
        }
    });
    revalidateTag('categories', 'max');
    revalidateTag('transactions', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('dashboard', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/settings/categories');
    revalidatePath('/settings/preferences');
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}

export async function createVendorAction(formData: FormData): Promise<Vendor> {
    const client = await getApiClient();
    const vendor = await client.vendors.create({
        body: vendorBody(formData)
    });
    revalidateTag('vendors', 'max');
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/vendors');
    revalidatePath('/settings/vendors');
    revalidatePath('/transactions');
    return vendor;
}

export async function searchVendorCandidatesAction(
    query: string
): Promise<VendorCandidate[]> {
    const client = await getApiClient();
    return client.vendors.searchCandidates({
        query: {
            query,
            limit: 6
        }
    });
}

export async function getVendorCandidateDetailsAction({
    brandfetchBrandId,
    domain
}: {
    readonly brandfetchBrandId?: string;
    readonly domain?: string;
}): Promise<VendorCandidate | undefined> {
    const client = await getApiClient();
    try {
        return await client.vendors.candidateDetails({
            query: {
                ...(brandfetchBrandId ? { brandfetchBrandId } : {}),
                ...(domain ? { domain } : {})
            }
        });
    } catch (err) {
        if (apiErrorStatus(err) === 404) {
            return undefined;
        }
        throw err;
    }
}

export async function updateVendorAction(
    formData: FormData
): Promise<
    | { readonly error: string; readonly vendor?: undefined }
    | { readonly error?: undefined; readonly vendor: Vendor }
> {
    const id = Number(requiredString(formData, 'id'));
    const client = await getApiClient();
    const body = vendorUpdateBody(formData);
    const localValidation = UpdateVendorBodySchema.validate(body);
    if (!localValidation.valid) {
        const localSchemaError =
            validationMessage(localValidation) ??
            'Could not save vendor. Check the entered details.';
        logVendorUpdateRejection({
            apiStatus: 0,
            body,
            localSchemaError,
            vendorId: id
        });
        return { error: localSchemaError };
    }

    let vendor: Vendor;
    try {
        vendor = await client.vendors.update({
            params: { id },
            body
        });
    } catch (err) {
        if (apiErrorStatus(err) === 400) {
            const apiMessage = apiErrorMessage(err);
            logVendorUpdateRejection({
                apiMessage,
                apiStatus: 400,
                body,
                vendorId: id
            });
            return {
                error:
                    apiMessage ??
                    'Could not save vendor. Check the entered details.'
            };
        }
        throw err;
    }
    revalidateTag('vendors', 'max');
    revalidateTag('transactions', 'max');
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/vendors');
    revalidatePath(`/settings/vendors/${id}`);
    revalidatePath('/settings/vendors');
    revalidatePath('/transactions');
    return { vendor };
}

export async function retryVendorEnrichmentAction(
    formData: FormData
): Promise<Vendor> {
    const id = Number(requiredString(formData, 'id'));
    const client = await getApiClient();
    const vendor = await client.vendors.enrich({
        params: { id }
    });
    revalidateTag('vendors', 'max');
    revalidateTag('transactions', 'max');
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/vendors');
    revalidatePath(`/settings/vendors/${id}`);
    revalidatePath('/settings/vendors');
    revalidatePath('/transactions');
    return vendor;
}

export async function createTransactionAction(formData: FormData) {
    const client = await getApiClient();
    await client.transactions.create({
        body: transactionBody(formData)
    });
    revalidateTag('categories', 'max');
    revalidateTag('vendors', 'max');
    revalidateTag('transaction-tags', 'max');
    revalidateTag('transactions', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('dashboard', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/vendors');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}

export async function createCaptureTransactionAction(
    formData: FormData
): Promise<Transaction> {
    const client = await getApiClient();
    const transaction = await client.transactions.create({
        body: transactionBody(formData)
    });
    revalidateTag('categories', 'max');
    revalidateTag('vendors', 'max');
    revalidateTag('transaction-tags', 'max');
    revalidateTag('transactions', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('dashboard', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/vendors');
    revalidatePath('/settings/vendors');
    revalidatePath('/transactions');
    revalidatePath('/stats');
    return transaction;
}

export async function recordTransactionScanDecisionAction({
    body,
    itemId,
    scanId
}: {
    readonly body: TransactionScanDecisionActionBody;
    readonly itemId: number;
    readonly scanId: number;
}): Promise<void> {
    const { attachment: requestedAttachment, ...decisionBody } = body;
    const uploadId =
        requestedAttachment &&
        'uploadId' in requestedAttachment &&
        typeof requestedAttachment.uploadId === 'string'
            ? requestedAttachment.uploadId
            : undefined;
    const session = uploadId ? await getSessionOrRedirect() : null;
    const attachment: TransactionScanDecisionBody['attachment'] = uploadId
        ? await readScanUploadAttachment(session?.user.id, uploadId)
        : requestedAttachment && !('uploadId' in requestedAttachment)
          ? requestedAttachment
          : undefined;
    const client = await getApiClient();
    await client.transactionScans.decide({
        params: { scanId, itemId },
        body: {
            ...decisionBody,
            attachment
        }
    });
    if (uploadId) {
        await deleteScanUpload(session?.user.id, uploadId);
    }
}

export async function getTransactionScanImageAction(
    transactionId: number
): Promise<TransactionScanImageResponse> {
    const client = await getApiClient();
    return client.transactions.scanImage({
        params: { id: transactionId }
    });
}

export async function updateTransactionAction(formData: FormData) {
    const client = await getApiClient();
    await client.transactions.update({
        params: { id: Number(requiredString(formData, 'id')) },
        body: transactionBody(formData, true)
    });
    revalidateTag('categories', 'max');
    revalidateTag('vendors', 'max');
    revalidateTag('transaction-tags', 'max');
    revalidateTag('transactions', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('dashboard', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/capture');
    revalidatePath('/dashboard');
    revalidatePath('/vendors');
    revalidatePath('/settings/vendors');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}

export async function deleteTransactionAction(formData: FormData) {
    const client = await getApiClient();
    await client.transactions.delete({
        params: { id: Number(requiredString(formData, 'id')) }
    });
    revalidateTag('categories', 'max');
    revalidateTag('vendors', 'max');
    revalidateTag('transaction-tags', 'max');
    revalidateTag('transactions', 'max');
    revalidateTag('user-profile', 'max');
    revalidateTag('dashboard', 'max');
    revalidateTag('stats', 'max');
    revalidatePath('/dashboard');
    revalidatePath('/vendors');
    revalidatePath('/settings/vendors');
    revalidatePath('/transactions');
    revalidatePath('/stats');
}

export async function updatePreferencesAction(formData: FormData) {
    const client = await getApiClient();
    const defaultCurrency = requiredString(formData, 'defaultCurrency');
    await client.users.updatePreferences({
        body: {
            defaultCurrency,
            countryCode:
                optionalString(formData, 'countryCode')?.toUpperCase() ?? 'US',
            favoriteCurrencies: favoriteCurrencies(formData, defaultCurrency),
            timezone: optionalString(formData, 'timezone') ?? 'UTC',
            weeklyEmailReportEnabled: booleanString(
                formData,
                'weeklyEmailReportEnabled',
                true
            ),
            monthlyEmailReportEnabled: booleanString(
                formData,
                'monthlyEmailReportEnabled',
                true
            )
        }
    });
    revalidateTag('user-profile', 'max');
    revalidateTag('dashboard', 'max');
    revalidatePath('/settings/preferences');
    redirect('/dashboard');
}

export async function createTelegramLinkAction() {
    const client = await getApiClient();
    const link = await client.users.createTelegramLinkToken();
    redirect(link.startUrl);
}

export async function disconnectTelegramAction() {
    const client = await getApiClient();
    await client.users.disconnectTelegram();
    revalidateTag('user-profile', 'max');
    revalidatePath('/settings/preferences');
}

export async function createApiKeyAction(formData: FormData) {
    const client = await getApiClient();
    const result = await client.users.createApiKey({
        body: {
            name: requiredString(formData, 'name')
        }
    });
    revalidateTag('api-keys', 'max');
    revalidatePath('/settings/preferences');
    return result;
}

export async function revokeApiKeyAction(formData: FormData) {
    const client = await getApiClient();
    await client.users.revokeApiKey({
        params: { id: Number(requiredString(formData, 'id')) }
    });
    revalidateTag('api-keys', 'max');
    revalidatePath('/settings/preferences');
}

function mcpOAuthAuthorizationBody(formData: FormData) {
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

export async function approveMcpOAuthAction(formData: FormData) {
    const client = await getApiClient();
    const result = await client.oauth.authorize({
        body: mcpOAuthAuthorizationBody(formData)
    });
    revalidateTag('mcp-connections', 'max');
    revalidatePath('/settings/preferences');
    redirect(result.redirectUrl);
}

export async function denyMcpOAuthAction(formData: FormData) {
    const client = await getApiClient();
    const body = mcpOAuthAuthorizationBody(formData);
    await client.oauth.authorizationRequest({ query: body });
    const redirectUrl = new URL(body.redirect_uri);
    redirectUrl.searchParams.set('error', 'access_denied');
    if (body.state) {
        redirectUrl.searchParams.set('state', body.state);
    }
    redirect(redirectUrl.toString());
}

export async function revokeMcpOAuthConnectionAction(formData: FormData) {
    const client = await getApiClient();
    await client.users.revokeMcpOAuthConnection({
        params: { id: Number(requiredString(formData, 'id')) }
    });
    revalidateTag('mcp-connections', 'max');
    revalidatePath('/settings/preferences');
}
