import { alias, eq, query, resolveColumnRef } from '@cleverbrush/knex-schema';
import type { Knex } from 'knex';
import {
    type AppDb,
    BudgetDbSchema,
    BudgetMemberDbSchema,
    UserDbSchema
} from '../db/schemas.js';

export type BudgetListStatus = 'active' | 'archived' | 'all';

const member = alias(BudgetMemberDbSchema, 'member');
const budget = alias(BudgetDbSchema, 'budget');
const user = alias(UserDbSchema, 'user');

export function budgetMembershipsQuery(
    knex: Knex,
    userId: number,
    status: BudgetListStatus = 'active',
    mainBudgetId = 0
) {
    const builder = query(knex, member)
        .join(budget, t => eq(t.member.budgetId, t.budget.id))
        .where(t => t.member.userId, userId);
    if (status === 'active') builder.whereNull(t => t.budget.archivedAt);
    if (status === 'archived') builder.whereNotNull(t => t.budget.archivedAt);
    return builder
        .orderByRaw('case when ?? = ? then 0 else 1 end', [
            'member.budget_id',
            mainBudgetId
        ])
        .orderBy(t => t.member.displayName, 'asc')
        .select(t => ({
            budgetId: t.member.budgetId,
            userId: t.member.userId,
            displayName: t.member.displayName,
            role: t.member.role,
            canCreateTransactions: t.member.canCreateTransactions,
            canUpdateTransactions: t.member.canUpdateTransactions,
            canDeleteTransactions: t.member.canDeleteTransactions,
            canManageCategories: t.member.canManageCategories,
            canManageVendors: t.member.canManageVendors,
            canManageTags: t.member.canManageTags,
            canManageMembers: t.member.canManageMembers,
            createdAt: t.member.createdAt,
            updatedAt: t.member.updatedAt,
            name: t.budget.name,
            defaultCurrency: t.budget.defaultCurrency,
            countryCode: t.budget.countryCode,
            createdByUserId: t.budget.createdByUserId,
            archivedAt: t.budget.archivedAt,
            budgetCreatedAt: t.budget.createdAt,
            budgetUpdatedAt: t.budget.updatedAt
        }));
}

export function budgetMembersQuery(knex: Knex, budgetId: number) {
    return query(knex, member)
        .join(user, t => eq(t.member.userId, t.user.id))
        .where(t => t.member.budgetId, budgetId)
        .orderBy(t => t.user.email, 'asc')
        .select(t => ({
            budgetId: t.member.budgetId,
            userId: t.member.userId,
            displayName: t.member.displayName,
            role: t.member.role,
            canCreateTransactions: t.member.canCreateTransactions,
            canUpdateTransactions: t.member.canUpdateTransactions,
            canDeleteTransactions: t.member.canDeleteTransactions,
            canManageCategories: t.member.canManageCategories,
            canManageVendors: t.member.canManageVendors,
            canManageTags: t.member.canManageTags,
            canManageMembers: t.member.canManageMembers,
            createdAt: t.member.createdAt,
            updatedAt: t.member.updatedAt,
            email: t.user.email,
            avatarUrl: t.user.avatarUrl,
            avatarImageMimeType: t.user.avatarImageMimeType,
            avatarImageFileName: t.user.avatarImageFileName,
            avatarImageUpdatedAt: t.user.avatarImageUpdatedAt
        }));
}

export function uniqueActiveBudgetNameQuery(
    db: AppDb,
    userId: number,
    name: string,
    excludingBudgetId?: number
) {
    const activeBudgetIds = db.budgets
        .whereNull(row => row.archivedAt)
        .select(row => row.id)
        .toKnexQuery();
    const builder = db.budgetMembers
        .where(row => row.userId, userId)
        .whereIn(row => row.budgetId, activeBudgetIds)
        .whereRaw('lower(??) = lower(?)', [
            resolveColumnRef(
                'displayName',
                BudgetMemberDbSchema,
                'displayName'
            ),
            name
        ]);
    if (excludingBudgetId !== undefined)
        builder.whereNot(row => row.budgetId, excludingBudgetId);
    return builder.select(row => ({ budgetId: row.budgetId })).limit(1);
}

export function budgetAdminCountQuery(db: AppDb, budgetId: number) {
    return db.budgetMembers
        .where(row => row.budgetId, budgetId)
        .where(row => row.role, 'admin')
        .countValue();
}

export function reportBudgetsQuery(knex: Knex, userId: number) {
    const activeBudgetIds = query(knex, BudgetDbSchema)
        .whereNull(row => row.archivedAt)
        .select(row => row.id)
        .toKnexQuery();
    return query(knex, BudgetMemberDbSchema)
        .where(row => row.userId, userId)
        .whereIn(row => row.budgetId, activeBudgetIds)
        .orderBy(row => row.displayName, 'asc')
        .select(row => ({ id: row.budgetId, name: row.displayName }));
}
