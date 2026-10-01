import { mapper } from '@cleverbrush/mapper';
import { array, number, object, string } from '@cleverbrush/schema';
import {
    BudgetAccessInvitationRowSchema,
    BudgetMemberSchema,
    BudgetSchema,
    UserAvatarSummarySchema
} from '@xpenser/contracts';
import {
    invitationPermissions,
    memberPermissions,
    normalizeCountryCode
} from '../budget-permissions.js';
import {
    budgetInvitationRead,
    budgetMemberRead,
    budgetRead
} from '../entity-reads.js';
import { perConnection } from '../read-models.js';

/** Query-derived source schema and reusable synchronous DTO mapping. */
export const budgetMapping = perConnection(knex => {
    const BudgetMappingSourceSchema = object({
        budget: budgetRead(knex).rowSchema,
        member: budgetMemberRead(knex).rowSchema.pick([
            'displayName',
            'role',
            'canCreateTransactions',
            'canUpdateTransactions',
            'canDeleteTransactions',
            'canManageCategories',
            'canManageVendors',
            'canManageTags',
            'canManageMembers'
        ]),
        mainBudgetId: number().nullable().optional(),
        favoriteCurrencies: array(string()),
        transactionCurrencies: array(string())
    });
    return mapper()
        .configure(BudgetMappingSourceSchema, BudgetSchema, mapping =>
            mapping
                .for(target => target.id)
                .from(source => source.budget.id)
                .for(target => target.name)
                .compute(
                    source => source.member.displayName || source.budget.name
                )
                .for(target => target.defaultCurrency)
                .from(source => source.budget.defaultCurrency)
                .for(target => target.countryCode)
                .compute(source =>
                    normalizeCountryCode(source.budget.countryCode)
                )
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
        .getSyncMapper(BudgetMappingSourceSchema, BudgetSchema);
});

/** Query-derived source schema and reusable synchronous DTO mapping. */
export const budgetMemberMapping = perConnection(knex => {
    const BudgetMemberMappingSourceSchema = budgetMemberRead(knex)
        .rowSchema.pick([
            'budgetId',
            'userId',
            'role',
            'canCreateTransactions',
            'canUpdateTransactions',
            'canDeleteTransactions',
            'canManageCategories',
            'canManageVendors',
            'canManageTags',
            'canManageMembers',
            'createdAt',
            'updatedAt'
        ])
        .addProps({ email: string(), user: UserAvatarSummarySchema });
    return mapper()
        .configure(
            BudgetMemberMappingSourceSchema,
            BudgetMemberSchema,
            mapping =>
                mapping
                    .for(target => target.role)
                    .compute(source =>
                        source.role === 'admin' ? 'admin' : 'member'
                    )
                    .for(target => target.permissions)
                    .compute(source => memberPermissions(source))
        )
        .getSyncMapper(BudgetMemberMappingSourceSchema, BudgetMemberSchema);
});

/** Query-derived source schema and reusable synchronous DTO mapping. */
export const budgetInvitationMapping = perConnection(knex => {
    const BudgetInvitationMappingSourceSchema = budgetInvitationRead(
        knex
    ).rowSchema.addProps({ status: string() });
    return mapper()
        .configure(
            BudgetInvitationMappingSourceSchema,
            BudgetAccessInvitationRowSchema,
            mapping =>
                mapping
                    .for(target => target.invitationId)
                    .from(source => source.id)
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
        .getSyncMapper(
            BudgetInvitationMappingSourceSchema,
            BudgetAccessInvitationRowSchema
        );
});
