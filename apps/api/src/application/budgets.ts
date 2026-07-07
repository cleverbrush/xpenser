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

const invitationTtlMs = 7 * 24 * 60 * 60 * 1000;
const budgetInvitationMessage =
    'If that email belongs to an xpenser user, a budget invitation has been sent.';

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

function mapBudget(
    budget: BudgetDb,
    member: BudgetMemberDb,
    mainBudgetId: number | null | undefined
): Budget {
    return {
        id: budget.id,
        name: budget.name,
        defaultCurrency: budget.defaultCurrency,
        countryCode: normalizeCountryCode(budget.countryCode),
        role: member.role === 'admin' ? 'admin' : 'member',
        permissions: memberPermissions(member),
        isMain: budget.id === mainBudgetId,
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
            createdByUserId: user.id
        })) as BudgetDb;

        await trx.budgetMembers.insert({
            budgetId: created.id,
            userId,
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
    user: Pick<UserDb, 'countryCode' | 'defaultCurrency' | 'id'>
): Promise<BudgetDb> {
    const budget = (await db.budgets.insert({
        name: 'Main',
        defaultCurrency: user.defaultCurrency,
        countryCode: normalizeCountryCode(user.countryCode),
        createdByUserId: user.id
    })) as BudgetDb;

    await db.budgetMembers.insert({
        budgetId: budget.id,
        userId: user.id,
        ...budgetMemberValues('admin')
    });
    await db.users
        .where(row => row.id, user.id)
        .update({ mainBudgetId: budget.id, updatedAt: new Date() });

    return budget;
}

export async function resolveBudgetAccess(
    db: AppDb,
    userId: number,
    budgetId?: number | null
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
    userId: number
): Promise<Budget[]> {
    await ensureMainBudget(db, userId);
    const user = (await db.users.find(userId)) as UserDb | undefined;
    const rows = (await db
        .knex('budget_members as member')
        .join('budgets as budget', 'budget.id', 'member.budget_id')
        .where('member.user_id', userId)
        .orderByRaw('case when budget.id = ? then 0 else 1 end', [
            user?.mainBudgetId ?? 0
        ])
        .orderBy('budget.name', 'asc')
        .select({
            budgetId: 'budget.id',
            name: 'budget.name',
            defaultCurrency: 'budget.default_currency',
            countryCode: 'budget.country_code',
            createdByUserId: 'budget.created_by_user_id',
            budgetCreatedAt: 'budget.created_at',
            budgetUpdatedAt: 'budget.updated_at',
            userId: 'member.user_id',
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
        readonly budgetCreatedAt: Date;
        readonly budgetUpdatedAt: Date;
        readonly userId: number;
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

    return rows.map(row =>
        mapBudget(
            {
                id: Number(row.budgetId),
                name: row.name,
                defaultCurrency: row.defaultCurrency,
                countryCode: row.countryCode,
                createdByUserId: row.createdByUserId ?? undefined,
                createdAt: row.budgetCreatedAt,
                updatedAt: row.budgetUpdatedAt
            },
            {
                budgetId: Number(row.budgetId),
                userId: row.userId,
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
            user?.mainBudgetId
        )
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
            createdByUserId: userId
        })) as BudgetDb;
        await trx.budgetMembers.insert({
            budgetId: created.id,
            userId,
            ...budgetMemberValues('admin')
        });
        return created;
    });

    const access = await resolveBudgetAccess(db, userId, budget.id);
    return mapBudget(budget, access.member, user.mainBudgetId);
}

export async function updateBudget(
    db: AppDb,
    userId: number,
    budgetId: number,
    body: UpdateBudgetBody
): Promise<Budget> {
    const access = await resolveBudgetAccess(db, userId, budgetId);
    requireBudgetPermission(access, 'canManageMembers');

    const update: {
        countryCode?: string;
        defaultCurrency?: string;
        name?: string;
        updatedAt: Date;
    } = { updatedAt: new Date() };
    if (body.name !== undefined) {
        const name = normalizedBudgetName(body.name);
        if (!name) {
            throw new BudgetMemberError('Budget name is required.');
        }
        update.name = name;
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

    const [updated] = (await db.budgets
        .where(row => row.id, budgetId)
        .update(update as never)) as BudgetDb[];
    if (!updated) {
        throw new BudgetNotFoundError('Budget was not found.');
    }

    const user = (await db.users.find(userId)) as UserDb | undefined;
    return mapBudget(updated, access.member, user?.mainBudgetId);
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
    budget: BudgetDb,
    token: string
): Promise<void> {
    const url = invitationLink(config, token);
    const safeBudgetName = htmlEscape(budget.name);
    const safeUrl = htmlEscape(url);
    await sendEmail(config, {
        to: email,
        subject: `Join ${budget.name} on xpenser`,
        text: `Open this magic link to join ${budget.name} on xpenser: ${url}`,
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
    await sendBudgetInvitationEmail(config, email, access.budget, token);

    return { message: budgetInvitationMessage };
}

export async function acceptBudgetInvitation(
    db: AppDb,
    userId: number,
    token: string
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

    await db.transaction(async trx => {
        await trx
            .knex('budget_members')
            .insert({
                budget_id: invitation.budgetId,
                user_id: userId,
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
    return mapBudget(access.budget, access.member, user.mainBudgetId);
}
