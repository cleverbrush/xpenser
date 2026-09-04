import { mapper } from '@cleverbrush/mapper';
import {
    any as anySchema,
    array,
    date,
    number,
    object,
    string
} from '@cleverbrush/schema';
import type {
    CreateVendorBody,
    UpdateVendorBody,
    Vendor,
    VendorCandidate,
    VendorCandidateDetailsQuery,
    VendorCandidateSearchQuery,
    VendorListQuery
} from '@xpenser/contracts';
import {
    FieldLimits,
    UserAvatarSummarySchema,
    VendorCandidateSchema,
    VendorSchema
} from '@xpenser/contracts';
import type { Config } from '../config.js';
import type {
    AppDb,
    BudgetDb,
    CategoryDb,
    TransactionDb,
    UserDb,
    VendorDb
} from '../db/schemas.js';
import { requireBudgetPermission, resolveBudgetAccess } from './budgets.js';
import {
    categoryAvailableForTransactions,
    categoryDisplayName
} from './categories.js';
import {
    type ContributorBucket,
    contributorSummary,
    loadUserAvatarSummaries,
    recordContributor,
    userIdsFromTransactions
} from './user-avatars.js';

const brandfetchTransactionUrl =
    'https://api.brandfetch.io/v2/brands/transaction';
const brandfetchBrandUrl = 'https://api.brandfetch.io/v2/brands';
const brandfetchSearchUrl = 'https://api.brandfetch.io/v2/search';
const enrichmentTtlMs = 30 * 24 * 60 * 60 * 1000;

export class VendorNameError extends Error {}
export class VendorNotFoundError extends Error {}
export class VendorMetadataError extends Error {}

type VendorStats = {
    readonly contributors: ReturnType<typeof contributorSummary>;
    readonly latestAt?: Date;
    readonly transactionCount: number;
};

type VendorSuggestion = {
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

function normalizeVendorName(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

export function vendorNormalizedName(value: string): string {
    return normalizeVendorName(value).toLowerCase();
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
        FieldLimits.vendorDomain
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
            return truncate(src, FieldLimits.vendorLogoUrl);
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
    if (!config.vendorEnrichment.enabled || !config.brandfetch.apiKey) {
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
        config.vendorEnrichment.timeoutMs
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

const BrandSearchMappingSourceSchema = object({
    brandId: anySchema(),
    claimed: anySchema(),
    domain: anySchema(),
    icon: anySchema(),
    name: anySchema(),
    resolvedDomain: string()
});

const mapBrandSearchCandidate = mapper()
    .configure(BrandSearchMappingSourceSchema, VendorCandidateSchema, mapping =>
        mapping
            .for(target => target.brandfetchBrandId)
            .compute(source =>
                truncate(
                    nonemptyString(source.brandId),
                    FieldLimits.brandfetchBrandId
                )
            )
            .for(target => target.name)
            .compute(
                source =>
                    truncate(
                        nonemptyString(source.name),
                        FieldLimits.vendorName
                    ) ?? source.resolvedDomain
            )
            .for(target => target.domain)
            .from(source => source.resolvedDomain)
            .for(target => target.logoUrl)
            .compute(source =>
                truncate(
                    httpsUrl(nonemptyString(source.icon)),
                    FieldLimits.vendorLogoUrl
                )
            )
            .for(target => target.description)
            .ignore()
            .for(target => target.primaryColor)
            .ignore()
            .for(target => target.claimed)
            .compute(source =>
                typeof source.claimed === 'boolean' ? source.claimed : undefined
            )
    )
    .getMapper(BrandSearchMappingSourceSchema, VendorCandidateSchema);

async function mapBrandSearchResult(
    value: BrandfetchSearchResponse
): Promise<VendorCandidate | undefined> {
    const domain = domainText(nonemptyString(value.domain));
    if (!domain) {
        return undefined;
    }

    return mapBrandSearchCandidate({
        brandId: value.brandId,
        claimed: value.claimed,
        domain: value.domain,
        icon: value.icon,
        name: value.name,
        resolvedDomain: domain
    });
}

export async function searchVendorCandidates(
    config: Config,
    query: Partial<VendorCandidateSearchQuery>
): Promise<VendorCandidate[]> {
    const search = normalizeVendorName(query.query ?? '');
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

        const candidates = await Promise.all(
            json.map(value =>
                mapBrandSearchResult(value as BrandfetchSearchResponse)
            )
        );
        return candidates
            .filter((value): value is VendorCandidate => value !== undefined)
            .slice(0, limit);
    } catch {
        return [];
    }
}

export async function getVendorCandidateDetails(
    config: Config,
    query: Partial<VendorCandidateDetailsQuery>
): Promise<VendorCandidate | undefined> {
    const brandfetchBrandId = truncate(
        nonemptyString(query.brandfetchBrandId),
        100
    );
    const domain = domainText(nonemptyString(query.domain));
    const identifier = brandfetchBrandId ?? domain;
    if (!identifier || !config.brandfetch.apiKey) {
        return undefined;
    }

    let details: BrandfetchResponse | undefined;
    try {
        details = await brandfetchBrandDetails(config, identifier);
    } catch {
        return undefined;
    }
    if (!details) {
        return undefined;
    }

    const update = brandfetchUpdate(details);
    const resolvedDomain = domainText(
        nonemptyString(update.domain) ?? nonemptyString(domain)
    );
    if (!resolvedDomain) {
        return undefined;
    }

    const name =
        truncate(nonemptyString(update.resolvedName), FieldLimits.vendorName) ??
        resolvedDomain;
    return {
        ...(brandfetchBrandId ? { brandfetchBrandId } : {}),
        name,
        domain: resolvedDomain,
        ...(update.logoUrl ? { logoUrl: update.logoUrl } : {}),
        ...(update.description ? { description: update.description } : {}),
        ...(update.primaryColor ? { primaryColor: update.primaryColor } : {})
    };
}

function brandfetchUpdate(json: BrandfetchResponse) {
    const description =
        nonemptyString(json?.description) ??
        nonemptyString(json?.longDescription);

    const values = {
        resolvedName: truncate(
            nonemptyString(json?.name),
            FieldLimits.vendorName
        ),
        domain: truncate(
            nonemptyString(json?.domain),
            FieldLimits.vendorDomain
        ),
        description: truncate(description, FieldLimits.vendorDescription),
        logoUrl: chooseLogoUrl(json?.logos),
        primaryColor: choosePrimaryColor(json?.colors)
    };
    return Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined)
    ) as Partial<VendorDb>;
}

function shouldEnrich(vendor: VendorDb, force = false): boolean {
    if (force) {
        return true;
    }
    if (vendor.enrichedAt) {
        return Date.now() - vendor.enrichedAt.getTime() > enrichmentTtlMs;
    }
    return true;
}

async function enrichVendor(
    db: AppDb,
    config: Config,
    user: UserDb,
    budget: BudgetDb,
    vendor: VendorDb,
    options: { readonly force?: boolean } = {}
): Promise<void> {
    const now = new Date();
    if (!config.vendorEnrichment.enabled || !config.brandfetch.apiKey) {
        await db.vendors
            .where(candidate => candidate.id, vendor.id)
            .where(candidate => candidate.budgetId, budget.id)
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
    if (!shouldEnrich(vendor, options.force)) {
        return;
    }

    try {
        const json = await brandfetchTransaction(config, {
            transactionLabel: vendor.name,
            countryCode: budget.countryCode || user.countryCode
        });
        await db.vendors
            .where(candidate => candidate.id, vendor.id)
            .where(candidate => candidate.budgetId, budget.id)
            .update({
                ...(json ? brandfetchUpdate(json) : {}),
                enrichedAt: now,
                enrichmentProvider: 'brandfetch',
                enrichmentStatus: json ? 'success' : 'not_found',
                updatedAt: now
            } as never);
    } catch {
        await db.vendors
            .where(candidate => candidate.id, vendor.id)
            .where(candidate => candidate.budgetId, budget.id)
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
    budgetId: number
): Promise<Map<number, CategoryDb>> {
    const categories = (await db.categories.where(
        category => category.budgetId,
        budgetId
    )) as CategoryDb[];

    return new Map(
        categories.map(category => [category.id, category] as const)
    );
}

async function loadVendorTransactions(
    db: AppDb,
    budgetId: number
): Promise<TransactionDb[]> {
    return (await db.transactions.where(
        transaction => transaction.budgetId,
        budgetId
    )) as TransactionDb[];
}

function vendorStats(
    transactions: readonly TransactionDb[],
    usersById: Parameters<typeof contributorSummary>[1],
    currentUserId: number
) {
    const stats = new Map<number, VendorStats>();
    const contributorsByVendor = new Map<number, ContributorBucket>();
    for (const transaction of transactions) {
        if (!transaction.vendorId) {
            continue;
        }
        const bucket =
            contributorsByVendor.get(transaction.vendorId) ??
            new Map<number, Date>();
        contributorsByVendor.set(transaction.vendorId, bucket);
        recordContributor(bucket, transaction, currentUserId);
        const current = stats.get(transaction.vendorId);
        stats.set(transaction.vendorId, {
            contributors: { contributors: [], otherContributorCount: 0 },
            transactionCount: (current?.transactionCount ?? 0) + 1,
            latestAt:
                !current?.latestAt || transaction.occurredAt > current.latestAt
                    ? transaction.occurredAt
                    : current.latestAt
        });
    }
    for (const [vendorId, statsRow] of stats) {
        stats.set(vendorId, {
            ...statsRow,
            contributors: contributorSummary(
                contributorsByVendor.get(vendorId),
                usersById
            )
        });
    }
    return stats;
}

function categorySuggestions(
    transactions: readonly TransactionDb[],
    categoriesById: ReadonlyMap<number, CategoryDb>
) {
    const byVendor = new Map<
        number,
        Map<number, { count: number; latestAt: Date }>
    >();

    for (const transaction of transactions) {
        if (!transaction.vendorId) {
            continue;
        }
        const category = categoriesById.get(transaction.categoryId);
        if (
            !category ||
            !categoryAvailableForTransactions(category, categoriesById)
        ) {
            continue;
        }

        const vendorCategories =
            byVendor.get(transaction.vendorId) ?? new Map();
        const current = vendorCategories.get(transaction.categoryId);
        vendorCategories.set(transaction.categoryId, {
            count: (current?.count ?? 0) + 1,
            latestAt:
                !current?.latestAt || transaction.occurredAt > current.latestAt
                    ? transaction.occurredAt
                    : current.latestAt
        });
        byVendor.set(transaction.vendorId, vendorCategories);
    }

    const suggestions = new Map<number, VendorSuggestion>();
    for (const [vendorId, categories] of byVendor) {
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
            suggestions.set(vendorId, {
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

const VendorMappingSourceSchema = object({
    vendor: object({
        id: number(),
        budgetId: number(),
        name: string(),
        resolvedName: string().optional(),
        domain: string().optional(),
        description: string().optional(),
        logoUrl: string().optional(),
        primaryColor: string().optional(),
        enrichmentProvider: string().optional(),
        enrichmentStatus: string().optional(),
        enrichedAt: date().optional(),
        createdAt: date(),
        updatedAt: date()
    }),
    suggestion: object({
        categoryId: number(),
        categoryDisplayName: string()
    }).optional(),
    transactionCount: number(),
    contributors: array(UserAvatarSummarySchema),
    otherContributorCount: number()
});

const mapVendorDto = mapper()
    .configure(VendorMappingSourceSchema, VendorSchema, mapping =>
        mapping
            .for(target => target.id)
            .from(source => source.vendor.id)
            .for(target => target.budgetId)
            .from(source => source.vendor.budgetId)
            .for(target => target.name)
            .from(source => source.vendor.name)
            .for(target => target.displayName)
            .from(source => source.vendor.name)
            .for(target => target.resolvedName)
            .from(source => source.vendor.resolvedName)
            .for(target => target.domain)
            .from(source => source.vendor.domain)
            .for(target => target.description)
            .from(source => source.vendor.description)
            .for(target => target.logoUrl)
            .from(source => source.vendor.logoUrl)
            .for(target => target.primaryColor)
            .from(source => source.vendor.primaryColor)
            .for(target => target.enrichmentProvider)
            .from(source => source.vendor.enrichmentProvider)
            .for(target => target.enrichmentStatus)
            .compute(source => {
                const status = source.vendor.enrichmentStatus;
                if (
                    status === 'disabled' ||
                    status === 'success' ||
                    status === 'not_found' ||
                    status === 'failed'
                ) {
                    return status;
                }
                return undefined;
            })
            .for(target => target.enrichedAt)
            .from(source => source.vendor.enrichedAt)
            .for(target => target.suggestedCategoryId)
            .compute(source => source.suggestion?.categoryId)
            .for(target => target.suggestedCategoryDisplayName)
            .compute(source => source.suggestion?.categoryDisplayName)
            .for(target => target.createdAt)
            .from(source => source.vendor.createdAt)
            .for(target => target.updatedAt)
            .from(source => source.vendor.updatedAt)
    )
    .getMapper(VendorMappingSourceSchema, VendorSchema);

async function mapVendor(
    vendor: VendorDb,
    stats: VendorStats | undefined,
    suggestion: VendorSuggestion | undefined
): Promise<Vendor> {
    return mapVendorDto({
        vendor: {
            id: vendor.id,
            budgetId: vendor.budgetId,
            name: vendor.name,
            resolvedName: vendor.resolvedName ?? undefined,
            domain: vendor.domain ?? undefined,
            description: vendor.description ?? undefined,
            logoUrl: vendor.logoUrl ?? undefined,
            primaryColor: vendor.primaryColor ?? undefined,
            enrichmentProvider: vendor.enrichmentProvider ?? undefined,
            enrichmentStatus: vendor.enrichmentStatus ?? undefined,
            enrichedAt: vendor.enrichedAt ?? undefined,
            createdAt: vendor.createdAt,
            updatedAt: vendor.updatedAt
        },
        suggestion,
        transactionCount: stats?.transactionCount ?? 0,
        contributors: [...(stats?.contributors.contributors ?? [])],
        otherContributorCount: stats?.contributors.otherContributorCount ?? 0
    });
}

async function vendorReadContext(
    db: AppDb,
    budgetId: number,
    currentUserId: number
) {
    const [transactions, categoriesById] = await Promise.all([
        loadVendorTransactions(db, budgetId),
        loadCategoriesById(db, budgetId)
    ]);
    const usersById = await loadUserAvatarSummaries(
        db,
        userIdsFromTransactions(transactions, currentUserId)
    );
    return {
        stats: vendorStats(transactions, usersById, currentUserId),
        suggestions: categorySuggestions(transactions, categoriesById)
    };
}

export async function listVendors(
    db: AppDb,
    userId: number,
    query: Partial<VendorListQuery> = {}
): Promise<Vendor[]> {
    const access = await resolveBudgetAccess(db, userId, query.budgetId);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const search = query.search?.trim().toLowerCase();
    const [rows, context] = await Promise.all([
        db.vendors.where(vendor => vendor.budgetId, access.budget.id),
        vendorReadContext(db, access.budget.id, userId)
    ]);

    const selected = (rows as VendorDb[])
        .filter(vendor => {
            if (!search) {
                return true;
            }
            return [
                vendor.name,
                vendor.resolvedName,
                vendor.domain,
                vendor.description
            ].some(value => value?.toLowerCase().includes(search));
        })
        .sort((left, right) => {
            const leftStats = context.stats.get(left.id);
            const rightStats = context.stats.get(right.id);
            const leftTime = leftStats?.latestAt?.getTime() ?? 0;
            const rightTime = rightStats?.latestAt?.getTime() ?? 0;
            return rightTime - leftTime || left.name.localeCompare(right.name);
        })
        .slice(0, limit);
    return Promise.all(
        selected.map(vendor =>
            mapVendor(
                vendor,
                context.stats.get(vendor.id),
                context.suggestions.get(vendor.id)
            )
        )
    );
}

async function getUser(db: AppDb, userId: number): Promise<UserDb> {
    const user = (await db.users.find(userId)) as UserDb | undefined;
    if (!user) {
        throw new VendorNotFoundError('User was not found.');
    }
    return user;
}

async function vendorView(
    db: AppDb,
    userId: number,
    vendor: VendorDb
): Promise<Vendor> {
    await resolveBudgetAccess(db, userId, vendor.budgetId);
    const context = await vendorReadContext(db, vendor.budgetId, userId);
    return mapVendor(
        vendor,
        context.stats.get(vendor.id),
        context.suggestions.get(vendor.id)
    );
}

function selectedVendorMetadata(body: CreateVendorBody) {
    return {
        brandfetchBrandId: truncate(
            nonemptyString(body.brandfetchBrandId),
            FieldLimits.brandfetchBrandId
        ),
        resolvedName: truncate(
            nonemptyString(body.resolvedName),
            FieldLimits.vendorName
        ),
        domain: domainText(nonemptyString(body.domain)),
        logoUrl: truncate(
            httpsUrl(nonemptyString(body.logoUrl)),
            FieldLimits.vendorLogoUrl
        )
    };
}

async function selectedBrandUpdate(
    config: Config,
    body: CreateVendorBody
): Promise<Partial<VendorDb>> {
    const selected = selectedVendorMetadata(body);
    const identifier = selected.brandfetchBrandId ?? selected.domain;
    let detailUpdate: Partial<VendorDb> = {};

    if (identifier) {
        try {
            const details = await brandfetchBrandDetails(config, identifier);
            detailUpdate = details ? brandfetchUpdate(details) : {};
        } catch {
            detailUpdate = {};
        }
    }

    const values: Partial<VendorDb> = {
        ...Object.fromEntries(
            Object.entries({
                resolvedName: selected.resolvedName,
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

function findReusableVendor(
    vendors: readonly VendorDb[],
    selectedDomain: string | undefined
) {
    if (!selectedDomain) {
        return vendors[0];
    }

    const exact = vendors.find(vendor => vendor.domain === selectedDomain);
    if (exact) {
        return exact;
    }

    return vendors.find(
        vendor => !vendor.domain && !vendor.resolvedName && !vendor.logoUrl
    );
}

export async function createVendor(
    db: AppDb,
    config: Config,
    userId: number,
    body: CreateVendorBody
): Promise<Vendor> {
    const access = await resolveBudgetAccess(db, userId, body.budgetId);
    requireBudgetPermission(access, 'canManageVendors');
    const name = normalizeVendorName(body.name);
    if (!name) {
        throw new VendorNameError('Vendor name is required.');
    }

    const normalizedName = vendorNormalizedName(name);
    const user = await getUser(db, userId);
    const selected = selectedVendorMetadata(body);
    const selectedUpdate = await selectedBrandUpdate(config, body);

    const matchingVendors = (await db.vendors
        .where(vendor => vendor.budgetId, access.budget.id)
        .where(vendor => vendor.normalizedName, normalizedName)) as VendorDb[];
    const existing = findReusableVendor(matchingVendors, selected.domain);

    const vendor =
        existing ??
        ((await db.vendors.insert({
            budgetId: access.budget.id,
            userId,
            name,
            normalizedName,
            resolvedName: undefined,
            domain: undefined,
            description: undefined,
            logoUrl: undefined,
            primaryColor: undefined,
            enrichmentProvider: undefined,
            enrichmentStatus: undefined,
            enrichedAt: undefined,
            ...selectedUpdate
        } as never)) as VendorDb);

    if (existing && Object.keys(selectedUpdate).length > 0) {
        await db.vendors
            .where(candidate => candidate.id, existing.id)
            .where(candidate => candidate.budgetId, access.budget.id)
            .update({
                ...selectedUpdate,
                updatedAt: new Date()
            } as never);
    }

    if (Object.keys(selectedUpdate).length === 0) {
        await enrichVendor(db, config, user, access.budget, vendor);
    }

    const [updated, context] = await Promise.all([
        db.vendors
            .where(candidate => candidate.id, vendor.id)
            .where(candidate => candidate.budgetId, access.budget.id)
            .first(),
        vendorReadContext(db, access.budget.id, userId)
    ]);

    return mapVendor(
        (updated ?? vendor) as VendorDb,
        context.stats.get(vendor.id),
        context.suggestions.get(vendor.id)
    );
}

export async function getVendor(
    db: AppDb,
    userId: number,
    vendorId: number
): Promise<VendorDb> {
    const vendor = (await db.vendors
        .where(candidate => candidate.id, vendorId)
        .first()) as VendorDb | undefined;
    if (!vendor) {
        throw new VendorNotFoundError('Vendor was not found.');
    }
    await resolveBudgetAccess(db, userId, vendor.budgetId);
    return vendor;
}

export async function getVendorDetails(
    db: AppDb,
    userId: number,
    vendorId: number
): Promise<Vendor> {
    return vendorView(db, userId, await getVendor(db, userId, vendorId));
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
    const text = nullableText(value, FieldLimits.vendorDomain);
    if (!text) {
        return text;
    }

    return domainText(text);
}

function nullableLogoUrl(value: string | null | undefined) {
    const text = nullableText(value, FieldLimits.vendorLogoUrl);
    if (!text) {
        return text;
    }
    const url = httpsUrl(text);
    if (!url) {
        throw new VendorMetadataError('Logo URL must be a valid HTTPS URL.');
    }
    return url;
}

function nullablePrimaryColor(value: string | null | undefined) {
    const text = nullableText(value, FieldLimits.vendorPrimaryColor);
    if (!text) {
        return text;
    }
    if (!/^#[0-9a-f]{6}$/i.test(text)) {
        throw new VendorMetadataError(
            'Primary color must be a six-digit hex color.'
        );
    }
    return text.toLowerCase();
}

export async function updateVendor(
    db: AppDb,
    userId: number,
    vendorId: number,
    body: UpdateVendorBody
): Promise<Vendor> {
    const current = await getVendor(db, userId, vendorId);
    const access = await resolveBudgetAccess(db, userId, current.budgetId);
    requireBudgetPermission(access, 'canManageVendors');
    const name =
        body.name === undefined ? current.name : normalizeVendorName(body.name);
    if (!name) {
        throw new VendorNameError('Vendor name is required.');
    }

    const normalizedName = vendorNormalizedName(name);
    if (normalizedName !== current.normalizedName) {
        const existing = (await db.vendors
            .where(vendor => vendor.budgetId, access.budget.id)
            .where(vendor => vendor.normalizedName, normalizedName)
            .first()) as VendorDb | undefined;
        if (existing && existing.id !== current.id) {
            throw new VendorNameError(
                'A vendor with this name already exists.'
            );
        }
    }

    const update: Partial<VendorDb> = {
        name,
        normalizedName,
        updatedAt: new Date(),
        ...(body.resolvedName !== undefined
            ? {
                  resolvedName: nullableText(
                      body.resolvedName,
                      FieldLimits.vendorName
                  )
              }
            : {}),
        ...(body.domain !== undefined
            ? { domain: nullableDomain(body.domain) }
            : {}),
        ...(body.description !== undefined
            ? {
                  description: nullableText(
                      body.description,
                      FieldLimits.vendorDescription
                  )
              }
            : {}),
        ...(body.logoUrl !== undefined
            ? { logoUrl: nullableLogoUrl(body.logoUrl) }
            : {}),
        ...(body.primaryColor !== undefined
            ? { primaryColor: nullablePrimaryColor(body.primaryColor) }
            : {})
    };

    await db.vendors
        .where(candidate => candidate.id, current.id)
        .where(candidate => candidate.budgetId, access.budget.id)
        .update(update as never);

    return getVendorDetails(db, userId, vendorId);
}

export async function retryVendorEnrichment(
    db: AppDb,
    config: Config,
    userId: number,
    vendorId: number
): Promise<Vendor> {
    const [user, vendor] = await Promise.all([
        getUser(db, userId),
        getVendor(db, userId, vendorId)
    ]);
    const access = await resolveBudgetAccess(db, userId, vendor.budgetId);
    requireBudgetPermission(access, 'canManageVendors');

    await enrichVendor(db, config, user, access.budget, vendor, {
        force: true
    });
    return getVendorDetails(db, userId, vendorId);
}
