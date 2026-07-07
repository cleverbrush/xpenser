import { createHash, randomBytes } from 'node:crypto';
import type {
    Budget,
    BudgetMember,
    BudgetPermissions,
    BudgetRole,
    CreateBudgetBody,
    InviteBudgetMemberBody,
    UpdateBudgetBody,
    UpdateBudgetMemberBody
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
import { sendEmail } from './email.js';

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

export type BudgetListStatus = 'active' | 'archived' | 'all';

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

    const byBudget = new Map<number, readonly string[]>();
    await Promise.all(
        Array.from(new Set(budgetIds)).map(async budgetId => {
            const rows = await db.budgetFavoriteCurrencies.where(
                currency => currency.budgetId,
                budgetId
            );
            byBudget.set(
                budgetId,
                rows
                    .map(row => row.currency.trim().toUpperCase())
                    .sort((left, right) => left.localeCompare(right))
            );
        })
    );
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
    const rows = (await db
        .knex('transactions')
        .whereIn('budget_id', budgetIds)
        .orderBy('occurred_at', 'desc')
        .orderBy('id', 'desc')
        .select({
            budgetId: 'budget_id',
            currency: 'currency'
        })) as Array<{ readonly budgetId: number; readonly currency: string }>;
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

function memberPermissions(member: BudgetMemberDb): BudgetPermissions {
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
    invitation: BudgetInvitationDb
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
    const query = db
        .knex('budget_members as member')
        .join('budgets as budget', 'budget.id', 'member.budget_id')
        .where('member.user_id', userId)
        .whereNull('budget.archived_at')
        .whereRaw('lower(member.display_name) = lower(?)', [name]);
    if (excludingBudgetId) {
        query.whereNot('member.budget_id', excludingBudgetId);
    }
    const existing = await query.first('member.budget_id');
    if (existing) {
        throw new BudgetMemberError(
            'You already have an active budget with this name.'
        );
    }
}

function mapBudget(
    budget: BudgetDb,
    member: BudgetMemberDb,
    mainBudgetId: number | null | undefined,
    favoriteCurrencies: readonly string[] = [],
    transactionCurrencies: readonly string[] = []
): Budget {
    return {
        id: budget.id,
        name: member.displayName || budget.name,
        defaultCurrency: budget.defaultCurrency,
        favoriteCurrencies: [...favoriteCurrencies],
        transactionCurrencies: [...transactionCurrencies],
        countryCode: normalizeCountryCode(budget.countryCode),
        role: member.role === 'admin' ? 'admin' : 'member',
        permissions: memberPermissions(member),
        isMain: budget.id === mainBudgetId,
        archivedAt: budget.archivedAt ?? null,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt
    };
}

function mapBudgetMember(
    row: BudgetMemberDb & { readonly email: string }
): BudgetMember {
    return {
        budgetId: row.budgetId,
        userId: row.userId,
        email: row.email,
        role: row.role === 'admin' ? 'admin' : 'member',
        permissions: memberPermissions(row),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
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
    const query = db
        .knex('budget_members as member')
        .join('budgets as budget', 'budget.id', 'member.budget_id')
        .where('member.user_id', userId);
    if (status === 'active') {
        query.whereNull('budget.archived_at');
    } else if (status === 'archived') {
        query.whereNotNull('budget.archived_at');
    }
    const rows = (await query
        .orderByRaw('case when budget.id = ? then 0 else 1 end', [
            user?.mainBudgetId ?? 0
        ])
        .orderBy('member.display_name', 'asc')
        .select({
            budgetId: 'budget.id',
            name: 'budget.name',
            defaultCurrency: 'budget.default_currency',
            countryCode: 'budget.country_code',
            createdByUserId: 'budget.created_by_user_id',
            archivedAt: 'budget.archived_at',
            budgetCreatedAt: 'budget.created_at',
            budgetUpdatedAt: 'budget.updated_at',
            userId: 'member.user_id',
            displayName: 'member.display_name',
            role: 'member.role',
            canCreateTransactions: 'member.can_create_transactions',
            canUpdateTransactions: 'member.can_update_transactions',
            canDeleteTransactions: 'member.can_delete_transactions',
            canManageCategories: 'member.can_manage_categories',
            canManageVendors: 'member.can_manage_vendors',
            canManageTags: 'member.can_manage_tags',
            canManageMembers: 'member.can_manage_members',
            memberCreatedAt: 'member.created_at',
            memberUpdatedAt: 'member.updated_at'
        })) as Array<{
        readonly budgetId: number;
        readonly name: string;
        readonly defaultCurrency: string;
        readonly countryCode: string;
        readonly createdByUserId: number | null;
        readonly archivedAt: Date | null;
        readonly budgetCreatedAt: Date;
        readonly budgetUpdatedAt: Date;
        readonly userId: number;
        readonly displayName: string;
        readonly role: string;
        readonly canCreateTransactions: boolean;
        readonly canUpdateTransactions: boolean;
        readonly canDeleteTransactions: boolean;
        readonly canManageCategories: boolean;
        readonly canManageVendors: boolean;
        readonly canManageTags: boolean;
        readonly canManageMembers: boolean;
        readonly memberCreatedAt: Date;
        readonly memberUpdatedAt: Date;
    }>;

    const budgetIds = rows.map(row => Number(row.budgetId));
    const [favoritesByBudget, recentTransactionsByBudget] = await Promise.all([
        loadBudgetFavoriteCurrencies(db, budgetIds),
        loadRecentTransactionsByBudget(db, budgetIds)
    ]);

    return rows.map(row => {
        const budgetId = Number(row.budgetId);
        const favorites = favoritesByBudget.get(budgetId) ?? [];
        const transactionCurrencies = transactionCurrenciesByRecentPopularity(
            [row.defaultCurrency, ...favorites],
            recentTransactionsByBudget.get(budgetId) ?? []
        );
        return mapBudget(
            {
                id: budgetId,
                name: row.name,
                defaultCurrency: row.defaultCurrency,
                countryCode: row.countryCode,
                createdByUserId: row.createdByUserId ?? undefined,
                archivedAt: row.archivedAt ?? undefined,
                createdAt: row.budgetCreatedAt,
                updatedAt: row.budgetUpdatedAt
            },
            {
                budgetId,
                userId: row.userId,
                displayName: row.displayName,
                role: row.role,
                canCreateTransactions: row.canCreateTransactions,
                canUpdateTransactions: row.canUpdateTransactions,
                canDeleteTransactions: row.canDeleteTransactions,
                canManageCategories: row.canManageCategories,
                canManageVendors: row.canManageVendors,
                canManageTags: row.canManageTags,
                canManageMembers: row.canManageMembers,
                createdAt: row.memberCreatedAt,
                updatedAt: row.memberUpdatedAt
            },
            user?.mainBudgetId,
            favorites,
            transactionCurrencies
        );
    });
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
    budgetId: number
): Promise<BudgetMember[]> {
    const access = await resolveBudgetAccess(db, userId, budgetId);
    requireBudgetPermission(access, 'canManageMembers');

    const rows = (await db
        .knex('budget_members as member')
        .join('users as user', 'user.id', 'member.user_id')
        .where('member.budget_id', budgetId)
        .orderBy('user.email', 'asc')
        .select({
            budgetId: 'member.budget_id',
            userId: 'member.user_id',
            email: 'user.email',
            displayName: 'member.display_name',
            role: 'member.role',
            canCreateTransactions: 'member.can_create_transactions',
            canUpdateTransactions: 'member.can_update_transactions',
            canDeleteTransactions: 'member.can_delete_transactions',
            canManageCategories: 'member.can_manage_categories',
            canManageVendors: 'member.can_manage_vendors',
            canManageTags: 'member.can_manage_tags',
            canManageMembers: 'member.can_manage_members',
            createdAt: 'member.created_at',
            updatedAt: 'member.updated_at'
        })) as Array<BudgetMemberDb & { readonly email: string }>;

    return rows.map(mapBudgetMember);
}

async function adminCount(db: AppDb, budgetId: number): Promise<number> {
    const [row] = (await db
        .knex('budget_members')
        .where({ budget_id: budgetId, role: 'admin' })
        .count<{ readonly count: number | string }[]>({
            count: '*'
        })) as Array<{
        readonly count: number | string;
    }>;
    return Number(row?.count ?? 0);
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
        await trx
            .knex('budget_members')
            .insert({
                budget_id: invitation.budgetId,
                user_id: userId,
                display_name: displayName,
                ...Object.fromEntries(
                    Object.entries({
                        role: invitation.role,
                        can_create_transactions:
                            invitationPermissions(invitation)
                                .canCreateTransactions,
                        can_update_transactions:
                            invitationPermissions(invitation)
                                .canUpdateTransactions,
                        can_delete_transactions:
                            invitationPermissions(invitation)
                                .canDeleteTransactions,
                        can_manage_categories:
                            invitationPermissions(invitation)
                                .canManageCategories,
                        can_manage_vendors:
                            invitationPermissions(invitation).canManageVendors,
                        can_manage_tags:
                            invitationPermissions(invitation).canManageTags,
                        can_manage_members:
                            invitationPermissions(invitation).canManageMembers
                    })
                )
            })
            .onConflict(['budget_id', 'user_id'])
            .merge();
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
