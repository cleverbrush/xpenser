/** Shared labels for budget forms and server-rendered permission summaries. */
export const permissionOptions = [
    ['canCreateTransactions', 'Add transactions', true],
    ['canUpdateTransactions', 'Edit transactions', false],
    ['canDeleteTransactions', 'Delete transactions', false],
    ['canManageCategories', 'Manage categories', false],
    ['canManageVendors', 'Manage vendors', false],
    ['canManageTags', 'Manage tags', false],
    ['canManageMembers', 'Manage members', false]
] as const;

export function defaultMemberPermissions() {
    return {
        canCreateTransactions: true,
        canUpdateTransactions: false,
        canDeleteTransactions: false,
        canManageCategories: false,
        canManageVendors: false,
        canManageTags: false,
        canManageMembers: false
    };
}
