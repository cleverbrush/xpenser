import type {
    CreateMerchantBody,
    Merchant,
    MerchantBrandSearchQuery,
    MerchantBrandSuggestion,
    MerchantListQuery,
    UpdateMerchantBody
} from '@xpenser/contracts';
import type { Config } from '../config.js';
import type {
    AppDb,
    CategoryDb,
    MerchantDb,
    TransactionDb,
    UserDb
} from '../db/schemas.js';
import {
    categoryAvailableForTransactions,
    categoryDisplayName
} from './categories.js';

const brandfetchTransactionUrl =
    'https://api.brandfetch.io/v2/brands/transaction';
const brandfetchBrandUrl = 'https://api.brandfetch.io/v2/brands';
const brandfetchSearchUrl = 'https://api.brandfetch.io/v2/search';
const enrichmentTtlMs = 30 * 24 * 60 * 60 * 1000;

export class MerchantNameError extends Error {}
export class MerchantNotFoundError extends Error {}
export class MerchantMetadataError extends Error {}

type MerchantStats = {
    readonly latestAt?: Date;
    readonly transactionCount: number;
};

type MerchantSuggestion = {
    readonly categoryDisplayName: string;
    readonly categoryId: number;
};

type BrandfetchFormat = {
    readonly src?: unknown;
    readonly format?: unknown;
};

type BrandfetchLogo = {
    readonly type?: unknown;
    readonly formats?: unknown;
};

type BrandfetchColor = {
    readonly hex?: unknown;
    readonly type?: unknown;
};

type BrandfetchResponse = {
    readonly id?: unknown;
    readonly name?: unknown;
    readonly domain?: unknown;
    readonly description?: unknown;
    readonly longDescription?: unknown;
    readonly logos?: unknown;
    readonly colors?: unknown;
};

type BrandfetchSearchResponse = {
    readonly brandId?: unknown;
    readonly claimed?: unknown;
    readonly domain?: unknown;
    readonly icon?: unknown;
    readonly name?: unknown;
};

function normalizeMerchantName(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

export function merchantNormalizedName(value: string): string {
    return normalizeMerchantName(value).toLowerCase();
}

function nonemptyString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() !== ''
        ? value.trim()
        : undefined;
}

function truncate(value: string | undefined, maxLength: number) {
    return value && value.length > maxLength
        ? value.slice(0, maxLength)
        : value;
}

function httpsUrl(value: string | undefined): string | undefined {
    if (!value) {
        return undefined;
    }

    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? value : undefined;
    } catch {
        return undefined;
    }
}

function domainText(value: string | undefined): string | undefined {
    if (!value) {
        return undefined;
    }

    const text = value.trim();
    if (!text) {
        return undefined;
    }

    const withoutProtocol = text.replace(/^https?:\/\//i, '');
    return truncate(
        withoutProtocol.split('/')[0]?.toLowerCase() ?? text.toLowerCase(),
        255
    );
}

function chooseLogoUrl(logos: unknown): string | undefined {
    if (!Array.isArray(logos)) {
        return undefined;
    }

    const sorted = [...(logos as BrandfetchLogo[])].sort((left, right) => {
        const rank = (value: unknown) =>
            value === 'icon' ? 0 : value === 'logo' ? 1 : 2;
        return rank(left.type) - rank(right.type);
    });

    for (const logo of sorted) {
        if (!Array.isArray(logo.formats)) {
            continue;
        }
        const formats = logo.formats as BrandfetchFormat[];
        const svg =
            formats.find(format => format.format === 'svg') ?? formats[0];
        const src = httpsUrl(nonemptyString(svg?.src));
        if (src) {
            return truncate(src, 1000);
        }
    }

    return undefined;
}

function choosePrimaryColor(colors: unknown): string | undefined {
    if (!Array.isArray(colors)) {
        return undefined;
    }

    const values = colors as BrandfetchColor[];
    const selected =
        values.find(color => color.type === 'accent') ??
        values.find(color => color.type === 'dark') ??
        values[0];
    const hex = nonemptyString(selected?.hex);
    return hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : undefined;
}

async function brandfetchTransaction(
    config: Config,
    input: { readonly countryCode: string; readonly transactionLabel: string }
): Promise<BrandfetchResponse | undefined> {
    if (!config.merchantEnrichment.enabled || !config.brandfetch.apiKey) {
        return undefined;
    }

    const response = await brandfetchFetch(config, brandfetchTransactionUrl, {
        body: JSON.stringify(input),
        headers: {
            Authorization: `Bearer ${config.brandfetch.apiKey}`,
            'Content-Type': 'application/json'
        },
        method: 'POST'
    });

    if (response.status === 404) {
        return undefined;
    }
    if (!response.ok) {
        throw new Error(
            `Brandfetch API error ${response.status}: ${await response.text()}`
        );
    }

    return (await response.json()) as BrandfetchResponse;
}

async function brandfetchFetch(config: Config, url: string, init: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        config.merchantEnrichment.timeoutMs
    );

    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

async function brandfetchBrandDetails(
    config: Config,
    identifier: string
): Promise<BrandfetchResponse | undefined> {
    if (!config.brandfetch.apiKey) {
        return undefined;
    }

    const response = await brandfetchFetch(
        config,
        `${brandfetchBrandUrl}/${encodeURIComponent(identifier)}`,
        {
            headers: {
                Authorization: `Bearer ${config.brandfetch.apiKey}`
            },
            method: 'GET'
        }
    );

    if (response.status === 404) {
        return undefined;
    }
    if (!response.ok) {
        throw new Error(
            `Brandfetch API error ${response.status}: ${await response.text()}`
        );
    }

    return (await response.json()) as BrandfetchResponse;
}

function mapBrandSearchResult(
    value: BrandfetchSearchResponse
): MerchantBrandSuggestion | undefined {
    const domain = domainText(nonemptyString(value.domain));
    if (!domain) {
        return undefined;
    }

    const name = truncate(nonemptyString(value.name), 160) ?? domain;
    const brandId = truncate(nonemptyString(value.brandId), 100);
    const logoUrl = httpsUrl(nonemptyString(value.icon));
    return {
        ...(brandId ? { brandId } : {}),
        name,
        domain,
        ...(logoUrl ? { logoUrl: truncate(logoUrl, 1000) } : {}),
        ...(typeof value.claimed === 'boolean'
            ? { claimed: value.claimed }
            : {})
    };
}

export async function searchMerchantBrands(
    config: Config,
    query: Partial<MerchantBrandSearchQuery>
): Promise<MerchantBrandSuggestion[]> {
    const search = normalizeMerchantName(query.query ?? '');
    const limit = Math.min(10, Math.max(1, query.limit ?? 6));
    if (search.length < 2 || !config.brandfetch.clientId) {
        return [];
    }

    const url = new URL(`${brandfetchSearchUrl}/${encodeURIComponent(search)}`);
    url.searchParams.set('c', config.brandfetch.clientId);

    try {
        const response = await brandfetchFetch(config, url.toString(), {
            method: 'GET'
        });

        if (response.status === 404) {
            return [];
        }
        if (!response.ok) {
            return [];
        }

        const json = await response.json();
        if (!Array.isArray(json)) {
            return [];
        }

        return json
            .map(value =>
                mapBrandSearchResult(value as BrandfetchSearchResponse)
            )
            .filter(
                (value): value is MerchantBrandSuggestion => value !== undefined
            )
            .slice(0, limit);
    } catch {
        return [];
    }
}

function brandfetchUpdate(json: BrandfetchResponse) {
    const description =
        nonemptyString(json?.description) ??
        nonemptyString(json?.longDescription);

    const values = {
        brandName: truncate(nonemptyString(json?.name), 160),
        domain: truncate(nonemptyString(json?.domain), 255),
        description: truncate(description, 1000),
        logoUrl: chooseLogoUrl(json?.logos),
        primaryColor: choosePrimaryColor(json?.colors)
    };
    return Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined)
    ) as Partial<MerchantDb>;
}

function shouldEnrich(merchant: MerchantDb, force = false): boolean {
    if (force) {
        return true;
    }
    if (merchant.enrichedAt) {
        return Date.now() - merchant.enrichedAt.getTime() > enrichmentTtlMs;
    }
    return true;
}

async function enrichMerchant(
    db: AppDb,
    config: Config,
    user: UserDb,
    merchant: MerchantDb,
    options: { readonly force?: boolean } = {}
): Promise<void> {
    const now = new Date();
    if (!config.merchantEnrichment.enabled || !config.brandfetch.apiKey) {
        await db.merchants
            .where(candidate => candidate.id, merchant.id)
            .where(candidate => candidate.userId, user.id)
            .update({
                enrichedAt: now,
                enrichmentProvider: config.brandfetch.apiKey
                    ? 'brandfetch'
                    : undefined,
                enrichmentStatus: 'disabled',
                updatedAt: now
            });
        return;
    }
    if (!shouldEnrich(merchant, options.force)) {
        return;
    }

    try {
        const json = await brandfetchTransaction(config, {
            transactionLabel: merchant.name,
            countryCode: user.countryCode
        });
        await db.merchants
            .where(candidate => candidate.id, merchant.id)
            .where(candidate => candidate.userId, user.id)
            .update({
                ...(json ? brandfetchUpdate(json) : {}),
                enrichedAt: now,
                enrichmentProvider: 'brandfetch',
                enrichmentStatus: json ? 'success' : 'not_found',
                updatedAt: now
            } as never);
    } catch {
        await db.merchants
            .where(candidate => candidate.id, merchant.id)
            .where(candidate => candidate.userId, user.id)
            .update({
                enrichedAt: now,
                enrichmentProvider: 'brandfetch',
                enrichmentStatus: 'failed',
                updatedAt: now
            });
    }
}

async function loadCategoriesById(
    db: AppDb,
    userId: number
): Promise<Map<number, CategoryDb>> {
    const categories = (await db.categories.where(
        category => category.userId,
        userId
    )) as CategoryDb[];

    return new Map(
        categories.map(category => [category.id, category] as const)
    );
}

async function loadMerchantTransactions(
    db: AppDb,
    userId: number
): Promise<TransactionDb[]> {
    return (await db.transactions.where(
        transaction => transaction.userId,
        userId
    )) as TransactionDb[];
}

function merchantStats(transactions: readonly TransactionDb[]) {
    const stats = new Map<number, MerchantStats>();
    for (const transaction of transactions) {
        if (!transaction.merchantId) {
            continue;
        }
        const current = stats.get(transaction.merchantId);
        stats.set(transaction.merchantId, {
            transactionCount: (current?.transactionCount ?? 0) + 1,
            latestAt:
                !current?.latestAt || transaction.occurredAt > current.latestAt
                    ? transaction.occurredAt
                    : current.latestAt
        });
    }
    return stats;
}

function categorySuggestions(
    transactions: readonly TransactionDb[],
    categoriesById: ReadonlyMap<number, CategoryDb>
) {
    const byMerchant = new Map<
        number,
        Map<number, { count: number; latestAt: Date }>
    >();

    for (const transaction of transactions) {
        if (!transaction.merchantId) {
            continue;
        }
        const category = categoriesById.get(transaction.categoryId);
        if (
            !category ||
            !categoryAvailableForTransactions(category, categoriesById)
        ) {
            continue;
        }

        const merchantCategories =
            byMerchant.get(transaction.merchantId) ?? new Map();
        const current = merchantCategories.get(transaction.categoryId);
        merchantCategories.set(transaction.categoryId, {
            count: (current?.count ?? 0) + 1,
            latestAt:
                !current?.latestAt || transaction.occurredAt > current.latestAt
                    ? transaction.occurredAt
                    : current.latestAt
        });
        byMerchant.set(transaction.merchantId, merchantCategories);
    }

    const suggestions = new Map<number, MerchantSuggestion>();
    for (const [merchantId, categories] of byMerchant) {
        const [categoryId] =
            [...categories.entries()].sort(
                ([leftId, left], [rightId, right]) =>
                    right.count - left.count ||
                    right.latestAt.getTime() - left.latestAt.getTime() ||
                    leftId - rightId
            )[0] ?? [];
        const category = categoryId
            ? categoriesById.get(categoryId)
            : undefined;
        if (category) {
            suggestions.set(merchantId, {
                categoryId: category.id,
                categoryDisplayName: categoryDisplayName(
                    category,
                    categoriesById
                )
            });
        }
    }
    return suggestions;
}

function mapMerchant(
    merchant: MerchantDb,
    stats: MerchantStats | undefined,
    suggestion: MerchantSuggestion | undefined
): Merchant {
    return {
        id: merchant.id,
        name: merchant.name,
        displayName: merchant.brandName ?? merchant.name,
        brandName: merchant.brandName ?? undefined,
        domain: merchant.domain ?? undefined,
        description: merchant.description ?? undefined,
        logoUrl: merchant.logoUrl ?? undefined,
        primaryColor: merchant.primaryColor ?? undefined,
        enrichmentProvider: merchant.enrichmentProvider ?? undefined,
        enrichmentStatus: merchant.enrichmentStatus
            ? (merchant.enrichmentStatus as Merchant['enrichmentStatus'])
            : undefined,
        enrichedAt: merchant.enrichedAt ?? undefined,
        suggestedCategoryId: suggestion?.categoryId,
        suggestedCategoryDisplayName: suggestion?.categoryDisplayName,
        transactionCount: stats?.transactionCount ?? 0,
        createdAt: merchant.createdAt,
        updatedAt: merchant.updatedAt
    };
}

async function merchantReadContext(db: AppDb, userId: number) {
    const [transactions, categoriesById] = await Promise.all([
        loadMerchantTransactions(db, userId),
        loadCategoriesById(db, userId)
    ]);
    return {
        stats: merchantStats(transactions),
        suggestions: categorySuggestions(transactions, categoriesById)
    };
}

export async function listMerchants(
    db: AppDb,
    userId: number,
    query: Partial<MerchantListQuery> = {}
): Promise<Merchant[]> {
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const search = query.search?.trim().toLowerCase();
    const [rows, context] = await Promise.all([
        db.merchants.where(merchant => merchant.userId, userId),
        merchantReadContext(db, userId)
    ]);

    return (rows as MerchantDb[])
        .filter(merchant => {
            if (!search) {
                return true;
            }
            return [
                merchant.name,
                merchant.brandName,
                merchant.domain,
                merchant.description
            ].some(value => value?.toLowerCase().includes(search));
        })
        .sort((left, right) => {
            const leftStats = context.stats.get(left.id);
            const rightStats = context.stats.get(right.id);
            const leftTime = leftStats?.latestAt?.getTime() ?? 0;
            const rightTime = rightStats?.latestAt?.getTime() ?? 0;
            return rightTime - leftTime || left.name.localeCompare(right.name);
        })
        .slice(0, limit)
        .map(merchant =>
            mapMerchant(
                merchant,
                context.stats.get(merchant.id),
                context.suggestions.get(merchant.id)
            )
        );
}

async function getUser(db: AppDb, userId: number): Promise<UserDb> {
    const user = (await db.users.find(userId)) as UserDb | undefined;
    if (!user) {
        throw new MerchantNotFoundError('User was not found.');
    }
    return user;
}

async function merchantView(
    db: AppDb,
    userId: number,
    merchant: MerchantDb
): Promise<Merchant> {
    const context = await merchantReadContext(db, userId);
    return mapMerchant(
        merchant,
        context.stats.get(merchant.id),
        context.suggestions.get(merchant.id)
    );
}

function selectedMerchantMetadata(body: CreateMerchantBody) {
    return {
        brandfetchBrandId: truncate(
            nonemptyString(body.brandfetchBrandId),
            100
        ),
        brandName: truncate(nonemptyString(body.brandName), 160),
        domain: domainText(nonemptyString(body.domain)),
        logoUrl: truncate(httpsUrl(nonemptyString(body.logoUrl)), 1000)
    };
}

async function selectedBrandUpdate(
    config: Config,
    body: CreateMerchantBody
): Promise<Partial<MerchantDb>> {
    const selected = selectedMerchantMetadata(body);
    const identifier = selected.brandfetchBrandId ?? selected.domain;
    let detailUpdate: Partial<MerchantDb> = {};

    if (identifier) {
        try {
            const details = await brandfetchBrandDetails(config, identifier);
            detailUpdate = details ? brandfetchUpdate(details) : {};
        } catch {
            detailUpdate = {};
        }
    }

    const values: Partial<MerchantDb> = {
        ...Object.fromEntries(
            Object.entries({
                brandName: selected.brandName,
                domain: selected.domain,
                logoUrl: selected.logoUrl
            }).filter(([, value]) => value !== undefined)
        ),
        ...detailUpdate
    };

    if (Object.keys(values).length === 0) {
        return {};
    }

    return {
        ...values,
        enrichmentProvider: 'brandfetch',
        enrichmentStatus: 'success',
        enrichedAt: new Date()
    };
}

function findReusableMerchant(
    merchants: readonly MerchantDb[],
    selectedDomain: string | undefined
) {
    if (!selectedDomain) {
        return merchants[0];
    }

    const exact = merchants.find(
        merchant => merchant.domain === selectedDomain
    );
    if (exact) {
        return exact;
    }

    return merchants.find(
        merchant => !merchant.domain && !merchant.brandName && !merchant.logoUrl
    );
}

export async function createMerchant(
    db: AppDb,
    config: Config,
    userId: number,
    body: CreateMerchantBody
): Promise<Merchant> {
    const name = normalizeMerchantName(body.name);
    if (!name) {
        throw new MerchantNameError('Merchant name is required.');
    }

    const normalizedName = merchantNormalizedName(name);
    const user = await getUser(db, userId);
    const selected = selectedMerchantMetadata(body);
    const selectedUpdate = await selectedBrandUpdate(config, body);

    const matchingMerchants = (await db.merchants
        .where(merchant => merchant.userId, userId)
        .where(
            merchant => merchant.normalizedName,
            normalizedName
        )) as MerchantDb[];
    const existing = findReusableMerchant(matchingMerchants, selected.domain);

    const merchant =
        existing ??
        ((await db.merchants.insert({
            userId,
            name,
            normalizedName,
            brandName: undefined,
            domain: undefined,
            description: undefined,
            logoUrl: undefined,
            primaryColor: undefined,
            enrichmentProvider: undefined,
            enrichmentStatus: undefined,
            enrichedAt: undefined,
            ...selectedUpdate
        } as never)) as MerchantDb);

    if (existing && Object.keys(selectedUpdate).length > 0) {
        await db.merchants
            .where(candidate => candidate.id, existing.id)
            .where(candidate => candidate.userId, userId)
            .update({
                ...selectedUpdate,
                updatedAt: new Date()
            } as never);
    }

    if (Object.keys(selectedUpdate).length === 0) {
        await enrichMerchant(db, config, user, merchant);
    }

    const [updated, context] = await Promise.all([
        db.merchants
            .where(candidate => candidate.id, merchant.id)
            .where(candidate => candidate.userId, userId)
            .first(),
        merchantReadContext(db, userId)
    ]);

    return mapMerchant(
        (updated ?? merchant) as MerchantDb,
        context.stats.get(merchant.id),
        context.suggestions.get(merchant.id)
    );
}

export async function getMerchant(
    db: AppDb,
    userId: number,
    merchantId: number
): Promise<MerchantDb> {
    const merchant = (await db.merchants
        .where(candidate => candidate.id, merchantId)
        .where(candidate => candidate.userId, userId)
        .first()) as MerchantDb | undefined;
    if (!merchant) {
        throw new MerchantNotFoundError('Merchant was not found.');
    }
    return merchant;
}

export async function getMerchantDetails(
    db: AppDb,
    userId: number,
    merchantId: number
): Promise<Merchant> {
    return merchantView(db, userId, await getMerchant(db, userId, merchantId));
}

function nullableText(
    value: string | null | undefined,
    maxLength: number
): string | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    const text = value.trim();
    return text ? truncate(text, maxLength) : null;
}

function nullableDomain(value: string | null | undefined) {
    const text = nullableText(value, 255);
    if (!text) {
        return text;
    }

    return domainText(text);
}

function nullableLogoUrl(value: string | null | undefined) {
    const text = nullableText(value, 1000);
    if (!text) {
        return text;
    }
    const url = httpsUrl(text);
    if (!url) {
        throw new MerchantMetadataError('Logo URL must be a valid HTTPS URL.');
    }
    return url;
}

function nullablePrimaryColor(value: string | null | undefined) {
    const text = nullableText(value, 7);
    if (!text) {
        return text;
    }
    if (!/^#[0-9a-f]{6}$/i.test(text)) {
        throw new MerchantMetadataError(
            'Primary color must be a six-digit hex color.'
        );
    }
    return text.toLowerCase();
}

export async function updateMerchant(
    db: AppDb,
    userId: number,
    merchantId: number,
    body: UpdateMerchantBody
): Promise<Merchant> {
    const current = await getMerchant(db, userId, merchantId);
    const name =
        body.name === undefined
            ? current.name
            : normalizeMerchantName(body.name);
    if (!name) {
        throw new MerchantNameError('Merchant name is required.');
    }

    const normalizedName = merchantNormalizedName(name);
    if (normalizedName !== current.normalizedName) {
        const existing = (await db.merchants
            .where(merchant => merchant.userId, userId)
            .where(merchant => merchant.normalizedName, normalizedName)
            .first()) as MerchantDb | undefined;
        if (existing && existing.id !== current.id) {
            throw new MerchantNameError(
                'A merchant with this name already exists.'
            );
        }
    }

    const update: Partial<MerchantDb> = {
        name,
        normalizedName,
        updatedAt: new Date(),
        ...(body.brandName !== undefined
            ? { brandName: nullableText(body.brandName, 160) }
            : {}),
        ...(body.domain !== undefined
            ? { domain: nullableDomain(body.domain) }
            : {}),
        ...(body.description !== undefined
            ? { description: nullableText(body.description, 1000) }
            : {}),
        ...(body.logoUrl !== undefined
            ? { logoUrl: nullableLogoUrl(body.logoUrl) }
            : {}),
        ...(body.primaryColor !== undefined
            ? { primaryColor: nullablePrimaryColor(body.primaryColor) }
            : {})
    };

    await db.merchants
        .where(candidate => candidate.id, current.id)
        .where(candidate => candidate.userId, userId)
        .update(update as never);

    return getMerchantDetails(db, userId, merchantId);
}

export async function retryMerchantEnrichment(
    db: AppDb,
    config: Config,
    userId: number,
    merchantId: number
): Promise<Merchant> {
    const [user, merchant] = await Promise.all([
        getUser(db, userId),
        getMerchant(db, userId, merchantId)
    ]);

    await enrichMerchant(db, config, user, merchant, { force: true });
    return getMerchantDetails(db, userId, merchantId);
}
