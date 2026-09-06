import { createHash, randomBytes } from 'node:crypto';
import { mapper } from '@cleverbrush/mapper';
import {
    array,
    boolean,
    date,
    number,
    object,
    string,
    union
} from '@cleverbrush/schema';
import type {
    Budget,
    BudgetAccessRow,
    BudgetMember,
    BudgetPermissions,
    BudgetRole,
    CreateBudgetBody,
    InviteBudgetMemberBody,
    UpdateBudgetBody,
    UpdateBudgetMemberBody
} from '@xpenser/contracts';
import {
    BudgetAccessInvitationRowSchema,
    BudgetMemberSchema,
    BudgetSchema,
    UserAvatarSummarySchema
} from '@xpenser/contracts';
import type { Config } from '../config.js';
import type {
    AppDb,
    BudgetDb,
    BudgetInvitationDb,
    BudgetMemberDb,
    TransactionDb,
    UserDb
} from '../db/schemas.js';
import {
    type BudgetListStatus,
    budgetAdminCountQuery,
    budgetMembershipsQuery,
    budgetMembersQuery,
    uniqueActiveBudgetNameQuery
} from './budget-queries.js';
import { sendEmail } from './email.js';

export type { BudgetListStatus } from './budget-queries.js';

import { mapUserAvatarSummary } from './user-avatars.js';

export class BudgetAccessError extends Error {}
export class BudgetInvitationInvalidError extends Error {}
export class BudgetMemberError extends Error {}
export class BudgetNotFoundError extends Error {}
export class BudgetPermissionError extends Error {}

export type BudgetPermission = keyof BudgetPermissions;

export type BudgetAccess = {
    readonly budget: BudgetDb;
    readonly member: BudgetMemberDb;
    readonly permissions: BudgetPermissions;
};

const invitationTtlMs = 7 * 24 * 60 * 60 * 1000;
const budgetInvitationMessage =
    'If that email belongs to an xpenser user, a budget invitation has been sent.';
const mainBudgetName = 'Main';

export const adminBudgetPermissions: BudgetPermissions = {
    canCreateTransactions: true,
    canUpdateTransactions: true,
    canDeleteTransactions: true,
    canManageCategories: true,
    canManageVendors: true,
    canManageTags: true,
    canManageMembers: true
};

export const defaultMemberBudgetPermissions: BudgetPermissions = {
    canCreateTransactions: true,
    canUpdateTransactions: false,
    canDeleteTransactions: false,
    canManageCategories: false,
    canManageVendors: false,
    canManageTags: false,
    canManageMembers: false
};

function normalizedBudgetName(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

function normalizedEmail(value: string): string {
    return value.trim().toLowerCase();
}

function normalizeCountryCode(value: string | undefined): string {
    const countryCode = (value ?? 'US').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(countryCode) ? countryCode : 'US';
}

function normalizeCurrency(
    value: string | undefined,
    fallback: string
): string {
    const currency = (value ?? fallback).trim().toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : fallback;
}

function normalizeCurrencyList(
    values: readonly string[] | undefined,
    defaultCurrency: string
): string[] {
    const normalizedDefault = defaultCurrency.trim().toUpperCase();
    const result: string[] = [];
    const seen = new Set<string>();
    for (const value of values ?? []) {
        const currency = value.trim().toUpperCase();
        if (
            !/^[A-Z]{3}$/.test(currency) ||
            currency === normalizedDefault ||
            seen.has(currency)
        ) {
            continue;
        }
        seen.add(currency);
        result.push(currency);
    }
    return result;
}

async function setBudgetFavoriteCurrencies(
    db: AppDb,
    budgetId: number,
    currencies: readonly string[],
    defaultCurrency: string
): Promise<void> {
    const normalized = normalizeCurrencyList(currencies, defaultCurrency);
    await db.budgetFavoriteCurrencies
        .where(currency => currency.budgetId, budgetId)
        .delete();
    if (normalized.length > 0) {
        await db.budgetFavoriteCurrencies.insertMany(
            normalized.map(currency => ({ budgetId, currency }))
        );
    }
}

async function loadBudgetFavoriteCurrencies(
    db: AppDb,
    budgetIds: readonly number[]
): Promise<ReadonlyMap<number, readonly string[]>> {
    if (budgetIds.length === 0) {
        return new Map();
    }

    const ids = [...new Set(budgetIds)];
    const byBudget = new Map<number, string[]>(ids.map(id => [id, []]));
    const rows = await db.budgetFavoriteCurrencies.whereIn(
        currency => currency.budgetId,
        ids
    );
    for (const row of rows) {
        byBudget.get(row.budgetId)!.push(row.currency.trim().toUpperCase());
    }
    for (const currencies of byBudget.values()) {
        currencies.sort((left, right) => left.localeCompare(right));
    }
    return byBudget;
}

async function loadBudgetFavoriteCurrencyList(
    db: AppDb,
    budgetId: number
): Promise<string[]> {
    const values = await loadBudgetFavoriteCurrencies(db, [budgetId]);
    return [...(values.get(budgetId) ?? [])];
}

function transactionCurrenciesByRecentPopularity(
    currencies: readonly string[],
    recentTransactions: readonly Pick<TransactionDb, 'currency'>[]
): string[] {
    const configuredOrder = new Map<string, number>();
    const configuredCurrencies: string[] = [];

    for (const currency of currencies) {
        const normalized = currency.trim().toUpperCase();
        if (!configuredOrder.has(normalized)) {
            configuredOrder.set(normalized, configuredCurrencies.length);
            configuredCurrencies.push(normalized);
        }
    }

    const usage = new Map<string, { count: number; latestIndex: number }>();
    recentTransactions.forEach((transaction, index) => {
        const currency = transaction.currency.trim().toUpperCase();
        if (currency === '') {
            return;
        }
        const current = usage.get(currency);
        if (current) {
            current.count += 1;
        } else {
            usage.set(currency, { count: 1, latestIndex: index });
        }
    });

    return Array.from(new Set([...usage.keys(), ...configuredCurrencies])).sort(
        (left, right) => {
            const leftUsage = usage.get(left);
            const rightUsage = usage.get(right);
            const usageDelta =
                (rightUsage?.count ?? 0) - (leftUsage?.count ?? 0);
            if (usageDelta !== 0) {
                return usageDelta;
            }
            if (
                leftUsage &&
                rightUsage &&
                leftUsage.latestIndex !== rightUsage.latestIndex
            ) {
                return leftUsage.latestIndex - rightUsage.latestIndex;
            }
            if (leftUsage && !rightUsage) {
                return -1;
            }
            if (!leftUsage && rightUsage) {
                return 1;
            }
            return (
                (configuredOrder.get(left) ?? configuredCurrencies.length) -
                (configuredOrder.get(right) ?? configuredCurrencies.length)
            );
        }
    );
}

async function loadRecentTransactionsByBudget(
    db: AppDb,
    budgetIds: readonly number[]
): Promise<ReadonlyMap<number, readonly Pick<TransactionDb, 'currency'>[]>> {
    if (budgetIds.length === 0) {
        return new Map();
    }
    const rows = await db.transactions
        .whereIn(transaction => transaction.budgetId, budgetIds)
        .orderBy(transaction => transaction.occurredAt, 'desc')
        .orderBy(transaction => transaction.id, 'desc')
        .select(transaction => ({
            budgetId: transaction.budgetId,
            currency: transaction.currency
        }));
    const byBudget = new Map<number, Array<Pick<TransactionDb, 'currency'>>>();
    for (const row of rows) {
        const values = byBudget.get(row.budgetId) ?? [];
        if (values.length >= 10) {
            continue;
        }
        values.push({ currency: row.currency });
        byBudget.set(row.budgetId, values);
    }
    return byBudget;
}

function permissionsForRole(
    role: BudgetRole,
    permissions?: Partial<BudgetPermissions>
): BudgetPermissions {
    if (role === 'admin') {
        return adminBudgetPermissions;
    }

    return {
        ...defaultMemberBudgetPermissions,
        ...Object.fromEntries(
            Object.entries(permissions ?? {}).filter(
                ([, value]) => typeof value === 'boolean'
            )
        )
    } as BudgetPermissions;
}

type BudgetPermissionSource = BudgetPermissions & { readonly role: string };

function memberPermissions(member: BudgetPermissionSource): BudgetPermissions {
    if (member.role === 'admin') {
        return adminBudgetPermissions;
    }

    return {
        canCreateTransactions: member.canCreateTransactions,
        canUpdateTransactions: member.canUpdateTransactions,
        canDeleteTransactions: member.canDeleteTransactions,
        canManageCategories: member.canManageCategories,
        canManageVendors: member.canManageVendors,
        canManageTags: member.canManageTags,
        canManageMembers: member.canManageMembers
    };
}

function invitationPermissions(
    invitation: BudgetPermissionSource
): BudgetPermissions {
    if (invitation.role === 'admin') {
        return adminBudgetPermissions;
    }

    return {
        canCreateTransactions: invitation.canCreateTransactions,
        canUpdateTransactions: invitation.canUpdateTransactions,
        canDeleteTransactions: invitation.canDeleteTransactions,
        canManageCategories: invitation.canManageCategories,
        canManageVendors: invitation.canManageVendors,
        canManageTags: invitation.canManageTags,
        canManageMembers: invitation.canManageMembers
    };
}

function budgetMemberValues(
    role: BudgetRole,
    permissions?: Partial<BudgetPermissions>
) {
    const resolved = permissionsForRole(role, permissions);
    return {
        role,
        canCreateTransactions: resolved.canCreateTransactions,
        canUpdateTransactions: resolved.canUpdateTransactions,
        canDeleteTransactions: resolved.canDeleteTransactions,
        canManageCategories: resolved.canManageCategories,
        canManageVendors: resolved.canManageVendors,
        canManageTags: resolved.canManageTags,
        canManageMembers: resolved.canManageMembers
    };
}

async function ensureUniqueActiveBudgetDisplayName(
    db: AppDb,
    userId: number,
    name: string,
    excludingBudgetId?: number
): Promise<void> {
    const existing = await uniqueActiveBudgetNameQuery(
        db,
        userId,
        name,
        excludingBudgetId
    ).first();
    if (existing) {
        throw new BudgetMemberError(
            'You already have an active budget with this name.'
        );
    }
}

const BudgetMappingMemberSchema = object({
    displayName: string(),
    role: string(),
    canCreateTransactions: boolean(),
    canUpdateTransactions: boolean(),
    canDeleteTransactions: boolean(),
    canManageCategories: boolean(),
    canManageVendors: boolean(),
    canManageTags: boolean(),
    canManageMembers: boolean()
});

const BudgetMappingSourceSchema = object({
    budget: object({
        id: number(),
        name: string(),
        defaultCurrency: string(),
        countryCode: string(),
        archivedAt: date().optional(),
        createdAt: date(),
        updatedAt: date()
    }),
    member: BudgetMappingMemberSchema,
    mainBudgetId: number().nullable().optional(),
    favoriteCurrencies: array(string()),
    transactionCurrencies: array(string())
});

const mapBudgetDto = mapper()
    .configure(BudgetMappingSourceSchema, BudgetSchema, mapping =>
        mapping
            .for(target => target.id)
            .from(source => source.budget.id)
            .for(target => target.name)
            .compute(source => source.member.displayName || source.budget.name)
            .for(target => target.defaultCurrency)
            .from(source => source.budget.defaultCurrency)
            .for(target => target.countryCode)
            .compute(source => normalizeCountryCode(source.budget.countryCode))
            .for(target => target.role)
            .compute(source =>
                source.member.role === 'admin' ? 'admin' : 'member'
            )
            .for(target => target.permissions)
            .compute(source => memberPermissions(source.member))
            .for(target => target.isMain)
            .compute(source => source.budget.id === source.mainBudgetId)
            .for(target => target.archivedAt)
            .compute(source => source.budget.archivedAt ?? null)
            .for(target => target.createdAt)
            .from(source => source.budget.createdAt)
            .for(target => target.updatedAt)
            .from(source => source.budget.updatedAt)
    )
    .getMapper(BudgetMappingSourceSchema, BudgetSchema);

async function mapBudget(
    budget: BudgetDb,
    member: BudgetMemberDb,
    mainBudgetId: number | null | undefined,
    favoriteCurrencies: readonly string[] = [],
    transactionCurrencies: readonly string[] = []
): Promise<Budget> {
    return mapBudgetDto({
        budget: {
            id: budget.id,
            name: budget.name,
            defaultCurrency: budget.defaultCurrency,
            countryCode: budget.countryCode,
            archivedAt: budget.archivedAt
                ? new Date(budget.archivedAt)
                : undefined,
            createdAt: new Date(budget.createdAt),
            updatedAt: new Date(budget.updatedAt)
        },
        member,
        mainBudgetId,
        favoriteCurrencies: [...favoriteCurrencies],
        transactionCurrencies: [...transactionCurrencies]
    });
}

type BudgetMemberRow = BudgetMemberDb & {
    readonly avatarImageFileName?: string | null;
    readonly avatarImageMimeType?: string | null;
    readonly avatarImageUpdatedAt?: Date | null;
    readonly avatarUrl?: string | null;
    readonly email: string;
};

const BudgetMemberMappingSourceSchema = object({
    budgetId: number(),
    userId: number(),
    email: string(),
    user: UserAvatarSummarySchema,
    role: string(),
    canCreateTransactions: boolean(),
    canUpdateTransactions: boolean(),
    canDeleteTransactions: boolean(),
    canManageCategories: boolean(),
    canManageVendors: boolean(),
    canManageTags: boolean(),
    canManageMembers: boolean(),
    createdAt: date(),
    updatedAt: date()
});

const mapBudgetMemberDto = mapper()
    .configure(BudgetMemberMappingSourceSchema, BudgetMemberSchema, mapping =>
        mapping
            .for(target => target.role)
            .compute(source => (source.role === 'admin' ? 'admin' : 'member'))
            .for(target => target.permissions)
            .compute(source => memberPermissions(source))
    )
    .getMapper(BudgetMemberMappingSourceSchema, BudgetMemberSchema);

async function mapBudgetMember(row: BudgetMemberRow): Promise<BudgetMember> {
    const user = await mapUserAvatarSummary(
        {
            id: row.userId,
            email: row.email,
            avatarUrl: row.avatarUrl ?? undefined,
            avatarImageMimeType: row.avatarImageMimeType ?? undefined,
            avatarImageFileName: row.avatarImageFileName ?? undefined,
            avatarImageUpdatedAt: row.avatarImageUpdatedAt ?? undefined
        },
        row.displayName
    );
    return mapBudgetMemberDto({
        ...row,
        user
    });
}

export function hashBudgetInvitationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function createBudgetInvitationToken(): string {
    return randomBytes(32).toString('base64url');
}

export async function ensureMainBudget(
    db: AppDb,
    userId: number
): Promise<BudgetDb> {
    const user = (await db.users.find(userId)) as UserDb | undefined;
    if (!user) {
        throw new BudgetNotFoundError('User was not found.');
    }

    if (user.mainBudgetId) {
        const [budget, member] = await Promise.all([
            db.budgets.find(user.mainBudgetId),
            db.budgetMembers
                .where(row => row.budgetId, user.mainBudgetId)
                .where(row => row.userId, userId)
                .first()
        ]);
        if (budget && member) {
            return budget as BudgetDb;
        }
    }

    return db.transaction(async trx => {
        const created = (await trx.budgets.insert({
            name: 'Main',
            defaultCurrency: user.defaultCurrency,
            countryCode: normalizeCountryCode(user.countryCode),
            createdByUserId: user.id,
            archivedAt: null
        })) as BudgetDb;

        await trx.budgetMembers.insert({
            budgetId: created.id,
            userId,
            displayName: mainBudgetName,
            ...budgetMemberValues('admin')
        });
        await trx.users
            .where(row => row.id, userId)
            .update({ mainBudgetId: created.id, updatedAt: new Date() });

        return created;
    });
}

export async function createMainBudgetForUser(
    db: AppDb,
    user: Pick<UserDb, 'countryCode' | 'defaultCurrency' | 'id'>,
    favoriteCurrencies: readonly string[] = []
): Promise<BudgetDb> {
    const budget = (await db.budgets.insert({
        name: 'Main',
        defaultCurrency: user.defaultCurrency,
        countryCode: normalizeCountryCode(user.countryCode),
        createdByUserId: user.id,
        archivedAt: null
    })) as BudgetDb;

    await db.budgetMembers.insert({
        budgetId: budget.id,
        userId: user.id,
        displayName: mainBudgetName,
        ...budgetMemberValues('admin')
    });
    await setBudgetFavoriteCurrencies(
        db,
        budget.id,
        favoriteCurrencies,
        budget.defaultCurrency
    );
    await db.users
        .where(row => row.id, user.id)
        .update({ mainBudgetId: budget.id, updatedAt: new Date() });

    return budget;
}

export async function resolveBudgetAccess(
    db: AppDb,
    userId: number,
    budgetId?: number | null,
    options: { readonly allowArchived?: boolean } = {}
): Promise<BudgetAccess> {
    const selectedBudgetId =
        budgetId ?? (await ensureMainBudget(db, userId)).id;
    const [budget, member] = await Promise.all([
        db.budgets.find(selectedBudgetId),
        db.budgetMembers
            .where(row => row.budgetId, selectedBudgetId)
            .where(row => row.userId, userId)
            .first()
    ]);

    if (!budget || !member) {
        throw new BudgetAccessError('Budget was not found.');
    }
    if ((budget as BudgetDb).archivedAt && !options.allowArchived) {
        throw new BudgetAccessError('Budget was archived.');
    }

    return {
        budget: budget as BudgetDb,
        member: member as BudgetMemberDb,
        permissions: memberPermissions(member as BudgetMemberDb)
    };
}

export function requireBudgetPermission(
    access: BudgetAccess,
    permission: BudgetPermission
): void {
    if (!access.permissions[permission]) {
        throw new BudgetPermissionError(
            'You do not have permission to perform this budget action.'
        );
    }
}

export async function listBudgets(
    db: AppDb,
    userId: number,
    status: BudgetListStatus = 'active'
): Promise<Budget[]> {
    await ensureMainBudget(db, userId);
    const user = (await db.users.find(userId)) as UserDb | undefined;
    const rows = await budgetMembershipsQuery(
        db.knex,
        userId,
        status,
        user?.mainBudgetId ?? 0
    );

    const budgetIds = rows.map(row => row.budgetId);
    const [favoritesByBudget, recentTransactionsByBudget] = await Promise.all([
        loadBudgetFavoriteCurrencies(db, budgetIds),
        loadRecentTransactionsByBudget(db, budgetIds)
    ]);

    return Promise.all(
        rows.map(row => {
            const budgetId = row.budgetId;
            const favorites = favoritesByBudget.get(budgetId) ?? [];
            const transactionCurrencies =
                transactionCurrenciesByRecentPopularity(
                    [row.defaultCurrency, ...favorites],
                    recentTransactionsByBudget.get(budgetId) ?? []
                );
            return mapBudget(
                {
                    id: budgetId,
                    name: row.name,
                    defaultCurrency: row.defaultCurrency,
                    countryCode: row.countryCode,
                    createdByUserId: row.createdByUserId,
                    archivedAt: row.archivedAt,
                    createdAt: row.budgetCreatedAt,
                    updatedAt: row.budgetUpdatedAt
                },
                row,
                user?.mainBudgetId,
                favorites,
                transactionCurrencies
            );
        })
    );
}

export async function createBudget(
    db: AppDb,
    userId: number,
    body: CreateBudgetBody
): Promise<Budget> {
    const user = (await db.users.find(userId)) as UserDb | undefined;
    if (!user) {
        throw new BudgetNotFoundError('User was not found.');
    }
    const name = normalizedBudgetName(body.name);
    if (!name) {
        throw new BudgetMemberError('Budget name is required.');
    }
    await ensureUniqueActiveBudgetDisplayName(db, userId, name);

    const budget = await db.transaction(async trx => {
        const created = (await trx.budgets.insert({
            name,
            defaultCurrency: normalizeCurrency(
                body.defaultCurrency,
                user.defaultCurrency
            ),
            countryCode: normalizeCountryCode(
                body.countryCode ?? user.countryCode
            ),
            createdByUserId: userId,
            archivedAt: null
        })) as BudgetDb;
        await trx.budgetMembers.insert({
            budgetId: created.id,
            userId,
            displayName: name,
            ...budgetMemberValues('admin')
        });
        await setBudgetFavoriteCurrencies(
            trx,
            created.id,
            body.favoriteCurrencies,
            created.defaultCurrency
        );
        return created;
    });

    const access = await resolveBudgetAccess(db, userId, budget.id);
    const favorites = await loadBudgetFavoriteCurrencyList(db, budget.id);
    return mapBudget(
        budget,
        access.member,
        user.mainBudgetId,
        favorites,
        transactionCurrenciesByRecentPopularity(
            [budget.defaultCurrency, ...favorites],
            []
        )
    );
}

export async function updateBudget(
    db: AppDb,
    userId: number,
    budgetId: number,
    body: UpdateBudgetBody
): Promise<Budget> {
    const access = await resolveBudgetAccess(db, userId, budgetId, {
        allowArchived: true
    });
    const user = (await db.users.find(userId)) as UserDb | undefined;
    const isMain = access.budget.id === user?.mainBudgetId;
    const sharedSettingsChanged =
        body.defaultCurrency !== undefined ||
        body.favoriteCurrencies !== undefined ||
        body.countryCode !== undefined ||
        body.archived !== undefined;
    if (sharedSettingsChanged) {
        requireBudgetPermission(access, 'canManageMembers');
    }

    const update: {
        archivedAt?: Date | null;
        countryCode?: string;
        defaultCurrency?: string;
        updatedAt: Date;
    } = { updatedAt: new Date() };
    let nextDisplayName = access.member.displayName || access.budget.name;
    if (body.name !== undefined) {
        const name = normalizedBudgetName(body.name);
        if (!name) {
            throw new BudgetMemberError('Budget name is required.');
        }
        nextDisplayName = name;
    }
    if (body.defaultCurrency !== undefined) {
        update.defaultCurrency = normalizeCurrency(
            body.defaultCurrency,
            access.budget.defaultCurrency
        );
    }
    if (body.countryCode !== undefined) {
        update.countryCode = normalizeCountryCode(body.countryCode);
    }
    if (body.archived !== undefined) {
        if (isMain && body.archived) {
            throw new BudgetMemberError('Main budget cannot be archived.');
        }
        update.archivedAt = body.archived ? new Date() : null;
    }

    const willBeArchived =
        update.archivedAt !== undefined
            ? update.archivedAt
            : access.budget.archivedAt;
    if (
        !willBeArchived &&
        (body.name !== undefined || body.archived === false)
    ) {
        await ensureUniqueActiveBudgetDisplayName(
            db,
            userId,
            nextDisplayName,
            budgetId
        );
    }

    const updated = await db.transaction(async trx => {
        let budget = access.budget;
        let member = access.member;
        if (body.name !== undefined) {
            const [updatedMember] = (await trx.budgetMembers
                .where(row => row.budgetId, budgetId)
                .where(row => row.userId, userId)
                .update({
                    displayName: nextDisplayName,
                    updatedAt: new Date()
                } as never)) as BudgetMemberDb[];
            if (!updatedMember) {
                throw new BudgetNotFoundError('Budget member was not found.');
            }
            member = updatedMember;
        }
        if (sharedSettingsChanged) {
            const [updatedBudget] = (await trx.budgets
                .where(row => row.id, budgetId)
                .update(update as never)) as BudgetDb[];
            if (!updatedBudget) {
                throw new BudgetNotFoundError('Budget was not found.');
            }
            budget = updatedBudget;
        }
        if (body.favoriteCurrencies !== undefined) {
            await setBudgetFavoriteCurrencies(
                trx,
                budgetId,
                body.favoriteCurrencies,
                budget.defaultCurrency
            );
        } else if (body.defaultCurrency !== undefined) {
            const favorites = await loadBudgetFavoriteCurrencyList(
                trx,
                budgetId
            );
            await setBudgetFavoriteCurrencies(
                trx,
                budgetId,
                favorites,
                budget.defaultCurrency
            );
        }
        return { budget, member };
    });

    const [favorites, recentTransactions] = await Promise.all([
        loadBudgetFavoriteCurrencyList(db, budgetId),
        loadRecentTransactionsByBudget(db, [budgetId])
    ]);
    return mapBudget(
        updated.budget,
        updated.member,
        user?.mainBudgetId,
        favorites,
        transactionCurrenciesByRecentPopularity(
            [updated.budget.defaultCurrency, ...favorites],
            recentTransactions.get(budgetId) ?? []
        )
    );
}

export async function deleteBudget(
    db: AppDb,
    userId: number,
    budgetId: number
): Promise<void> {
    const access = await resolveBudgetAccess(db, userId, budgetId, {
        allowArchived: true
    });
    requireBudgetPermission(access, 'canManageMembers');
    const user = (await db.users.find(userId)) as UserDb | undefined;
    if (access.budget.id === user?.mainBudgetId) {
        throw new BudgetMemberError('Main budget cannot be deleted.');
    }
    if (!access.budget.archivedAt) {
        throw new BudgetMemberError(
            'Archive the budget before deleting it permanently.'
        );
    }

    const deleted = await db.budgets.where(row => row.id, budgetId).delete();
    if (deleted === 0) {
        throw new BudgetNotFoundError('Budget was not found.');
    }
}

export async function listBudgetMembers(
    db: AppDb,
    userId: number,
    budgetId: number,
    options: { readonly allowArchived?: boolean } = {}
): Promise<BudgetMember[]> {
    const access = await resolveBudgetAccess(db, userId, budgetId, options);
    requireBudgetPermission(access, 'canManageMembers');

    const rows = await budgetMembersQuery(db.knex, budgetId);
    return Promise.all(rows.map(mapBudgetMember));
}

function invitationAccessStatus(
    invitation: Pick<BudgetInvitationDb, 'consumedAt' | 'expiresAt'>,
    now: Date
): 'accepted' | 'expired' | 'pending' {
    if (invitation.consumedAt) {
        return 'accepted';
    }
    if (invitation.expiresAt.getTime() <= now.getTime()) {
        return 'expired';
    }
    return 'pending';
}

const BudgetInvitationMappingSourceSchema = object({
    invitationId: number(),
    budgetId: number(),
    email: string(),
    role: string(),
    canCreateTransactions: boolean(),
    canUpdateTransactions: boolean(),
    canDeleteTransactions: boolean(),
    canManageCategories: boolean(),
    canManageVendors: boolean(),
    canManageTags: boolean(),
    canManageMembers: boolean(),
    expiresAt: date(),
    consumedAt: date().nullable(),
    createdAt: date(),
    updatedAt: date(),
    status: string()
});

const mapBudgetInvitationDto = mapper()
    .configure(
        BudgetInvitationMappingSourceSchema,
        BudgetAccessInvitationRowSchema,
        mapping =>
            mapping
                .for(target => target.status)
                .compute(source => {
                    if (source.status === 'accepted') return 'accepted';
                    if (source.status === 'expired') return 'expired';
                    return 'pending';
                })
                .for(target => target.role)
                .compute(source =>
                    source.role === 'admin' ? 'admin' : 'member'
                )
                .for(target => target.permissions)
                .compute(source => invitationPermissions(source))
    )
    .getMapper(
        BudgetInvitationMappingSourceSchema,
        BudgetAccessInvitationRowSchema
    );

async function mapInvitationAccessRow(
    invitation: BudgetInvitationDb,
    now: Date
): Promise<BudgetAccessRow> {
    return mapBudgetInvitationDto({
        status: invitationAccessStatus(invitation, now),
        invitationId: invitation.id,
        budgetId: invitation.budgetId,
        email: invitation.email,
        role: invitation.role === 'admin' ? 'admin' : 'member',
        canCreateTransactions: invitation.canCreateTransactions,
        canUpdateTransactions: invitation.canUpdateTransactions,
        canDeleteTransactions: invitation.canDeleteTransactions,
        canManageCategories: invitation.canManageCategories,
        canManageVendors: invitation.canManageVendors,
        canManageTags: invitation.canManageTags,
        canManageMembers: invitation.canManageMembers,
        expiresAt: invitation.expiresAt,
        consumedAt: invitation.consumedAt ?? null,
        createdAt: invitation.createdAt,
        updatedAt: invitation.updatedAt
    });
}

export async function listBudgetAccess(
    db: AppDb,
    userId: number,
    budgetId: number
): Promise<BudgetAccessRow[]> {
    const access = await resolveBudgetAccess(db, userId, budgetId, {
        allowArchived: true
    });
    requireBudgetPermission(access, 'canManageMembers');

    const [members, invitations] = await Promise.all([
        listBudgetMembers(db, userId, budgetId, { allowArchived: true }),
        db.budgetInvitations.where(invitation => invitation.budgetId, budgetId)
    ]);
    const now = new Date();
    const invitationRows = await Promise.all(
        (invitations as BudgetInvitationDb[]).map(invitation =>
            mapInvitationAccessRow(invitation, now)
        )
    );
    return [
        ...members.map(member => ({ status: 'active' as const, ...member })),
        ...invitationRows.sort((left, right) => {
            const statusDelta = left.status.localeCompare(right.status);
            if (statusDelta !== 0) {
                return statusDelta;
            }
            return left.email.localeCompare(right.email);
        })
    ];
}

const CountRowSchema = object({ count: union(number()).or(string()) });

async function adminCount(db: AppDb, budgetId: number): Promise<number> {
    const row: unknown = await budgetAdminCountQuery(db, budgetId).first();
    return Number(CountRowSchema.parse(row).count);
}

async function ensureCanChangeMember(
    db: AppDb,
    budgetId: number,
    targetUserId: number,
    nextRole?: BudgetRole
): Promise<void> {
    const current = (await db.budgetMembers
        .where(row => row.budgetId, budgetId)
        .where(row => row.userId, targetUserId)
        .first()) as BudgetMemberDb | undefined;
    if (!current) {
        throw new BudgetNotFoundError('Budget member was not found.');
    }
    if (current.role === 'admin' && nextRole !== 'admin') {
        const count = await adminCount(db, budgetId);
        if (count <= 1) {
            throw new BudgetMemberError(
                'A budget must have at least one admin.'
            );
        }
    }
}

export async function updateBudgetMember(
    db: AppDb,
    userId: number,
    budgetId: number,
    targetUserId: number,
    body: UpdateBudgetMemberBody
): Promise<BudgetMember> {
    const access = await resolveBudgetAccess(db, userId, budgetId);
    requireBudgetPermission(access, 'canManageMembers');
    await ensureCanChangeMember(db, budgetId, targetUserId, body.role);

    const values = {
        ...budgetMemberValues(body.role, body.permissions),
        updatedAt: new Date()
    };
    const [updated] = (await db.budgetMembers
        .where(row => row.budgetId, budgetId)
        .where(row => row.userId, targetUserId)
        .update(values as never)) as BudgetMemberDb[];
    if (!updated) {
        throw new BudgetNotFoundError('Budget member was not found.');
    }

    const user = (await db.users.find(targetUserId)) as UserDb | undefined;
    if (!user) {
        throw new BudgetNotFoundError('Budget member was not found.');
    }
    return mapBudgetMember({ ...updated, email: user.email });
}

export async function removeBudgetMember(
    db: AppDb,
    userId: number,
    budgetId: number,
    targetUserId: number
): Promise<void> {
    const access = await resolveBudgetAccess(db, userId, budgetId);
    requireBudgetPermission(access, 'canManageMembers');
    await ensureCanChangeMember(db, budgetId, targetUserId, undefined);

    const deleted = await db.budgetMembers
        .where(row => row.budgetId, budgetId)
        .where(row => row.userId, targetUserId)
        .delete();
    if (deleted === 0) {
        throw new BudgetNotFoundError('Budget member was not found.');
    }
}

function invitationLink(config: Config, token: string): string {
    const url = new URL('/budgets/invitations/accept', config.app.url);
    url.searchParams.set('token', token);
    return url.toString();
}

function htmlEscape(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

async function sendBudgetInvitationEmail(
    config: Config,
    email: string,
    budgetName: string,
    token: string
): Promise<void> {
    const url = invitationLink(config, token);
    const safeBudgetName = htmlEscape(budgetName);
    const safeUrl = htmlEscape(url);
    await sendEmail(config, {
        to: email,
        subject: `Join ${budgetName} on xpenser`,
        text: `Open this magic link to join ${budgetName} on xpenser: ${url}`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Join ${safeBudgetName} on xpenser</h2>
                <p>Open this magic link to join the shared budget.</p>
                <p style="margin: 28px 0;">
                    <a href="${safeUrl}" style="background: #111827; color: #ffffff; padding: 12px 18px; border-radius: 6px; text-decoration: none; display: inline-block;">
                        Join budget
                    </a>
                </p>
                <p style="color: #4b5563; font-size: 14px;">If the button does not work, paste this link into your browser:</p>
                <p style="word-break: break-all; color: #4b5563; font-size: 14px;">${safeUrl}</p>
            </div>
        `
    });
}

export async function inviteBudgetMember(
    db: AppDb,
    config: Config,
    userId: number,
    budgetId: number,
    body: InviteBudgetMemberBody
): Promise<{ readonly message: string }> {
    const access = await resolveBudgetAccess(db, userId, budgetId);
    requireBudgetPermission(access, 'canManageMembers');

    const email = normalizedEmail(body.email);
    const target = (await db.users.where(row => row.email, email).first()) as
        | UserDb
        | undefined;
    if (!target) {
        return { message: budgetInvitationMessage };
    }

    const existingMember = await db.budgetMembers
        .where(row => row.budgetId, budgetId)
        .where(row => row.userId, target.id)
        .first();
    if (existingMember) {
        return { message: budgetInvitationMessage };
    }

    const token = createBudgetInvitationToken();
    const role = body.role === 'admin' ? 'admin' : 'member';
    const values = budgetMemberValues(role, body.permissions);

    await db.budgetInvitations.insert({
        budgetId,
        invitedByUserId: userId,
        email,
        ...values,
        tokenHash: hashBudgetInvitationToken(token),
        expiresAt: new Date(Date.now() + invitationTtlMs),
        consumedAt: undefined
    });
    await sendBudgetInvitationEmail(
        config,
        email,
        access.member.displayName || access.budget.name,
        token
    );

    return { message: budgetInvitationMessage };
}

export async function acceptBudgetInvitation(
    db: AppDb,
    userId: number,
    token: string,
    name: string
): Promise<Budget> {
    const tokenHash = hashBudgetInvitationToken(token);
    const user = (await db.users.find(userId)) as UserDb | undefined;
    if (!user) {
        throw new BudgetInvitationInvalidError(
            'Budget invitation is invalid or expired.'
        );
    }

    const now = new Date();
    const invitation = (await db.budgetInvitations
        .where(row => row.tokenHash, tokenHash)
        .first()) as BudgetInvitationDb | undefined;
    if (
        !invitation ||
        invitation.consumedAt ||
        invitation.expiresAt.getTime() <= now.getTime() ||
        normalizedEmail(invitation.email) !== normalizedEmail(user.email)
    ) {
        throw new BudgetInvitationInvalidError(
            'Budget invitation is invalid or expired.'
        );
    }
    const budget = (await db.budgets.find(invitation.budgetId)) as
        | BudgetDb
        | undefined;
    if (!budget || budget.archivedAt) {
        throw new BudgetInvitationInvalidError(
            'Budget invitation is invalid or expired.'
        );
    }
    const displayName = normalizedBudgetName(name);
    if (!displayName) {
        throw new BudgetInvitationInvalidError('Budget name is required.');
    }
    await ensureUniqueActiveBudgetDisplayName(db, userId, displayName);

    await db.transaction(async trx => {
        const permissions = invitationPermissions(invitation);
        await trx.budgetMembers
            .onConflict(
                member => member.budgetId,
                member => member.userId
            )
            .merge({
                budgetId: invitation.budgetId,
                userId,
                displayName,
                role: invitation.role,
                ...permissions
            });
        await trx.budgetInvitations
            .where(row => row.id, invitation.id)
            .update({ consumedAt: now, updatedAt: now });
    });

    const access = await resolveBudgetAccess(db, userId, invitation.budgetId);
    const [favorites, recentTransactions] = await Promise.all([
        loadBudgetFavoriteCurrencyList(db, invitation.budgetId),
        loadRecentTransactionsByBudget(db, [invitation.budgetId])
    ]);
    return mapBudget(
        access.budget,
        access.member,
        user.mainBudgetId,
        favorites,
        transactionCurrenciesByRecentPopularity(
            [access.budget.defaultCurrency, ...favorites],
            recentTransactions.get(invitation.budgetId) ?? []
        )
    );
}
