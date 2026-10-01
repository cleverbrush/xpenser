import type { BudgetPermissions } from '@xpenser/contracts';
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

type BudgetPermissionSource = BudgetPermissions & { readonly role: string };

export function normalizeCountryCode(value: string | undefined): string {
    const countryCode = (value ?? 'US').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(countryCode) ? countryCode : 'US';
}

export function memberPermissions(
    member: BudgetPermissionSource
): BudgetPermissions {
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

export function invitationPermissions(
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
