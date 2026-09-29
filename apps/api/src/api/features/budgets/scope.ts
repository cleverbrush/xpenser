import { implement } from '@cleverbrush/server';
import { api } from '@xpenser/contracts';
import { ConfigToken, DbToken } from '../../../di/tokens.js';

/** Server-only configuration for the shared budgets contract. */
export const budgetsScope = implement(api).group('budgets', {
    inject: { db: DbToken },
    tags: ['budgets'],
    operations: {
        list: {
            operationId: 'listBudgets',
            description: 'Lists budgets accessible to the authenticated user.',
            summary: 'List budgets'
        },
        create: {
            operationId: 'createBudget',
            description: 'Creates a new budget with the current user as admin.',
            summary: 'Create budget'
        },
        update: {
            operationId: 'updateBudget',
            description: 'Updates budget name, defaults, or archive state.',
            summary: 'Update budget'
        },
        delete: {
            operationId: 'deleteBudget',
            description: 'Permanently deletes an archived non-main budget.',
            summary: 'Delete budget'
        },
        members: {
            operationId: 'listBudgetMembers',
            description:
                'Lists members for a budget the current user can manage.',
            summary: 'List budget members'
        },
        access: {
            operationId: 'listBudgetAccess',
            description:
                'Lists active members and invitation statuses for a budget the current user can manage.',
            summary: 'List budget access'
        },
        invite: {
            operationId: 'inviteBudgetMember',
            description: 'Sends a magic link invitation for an existing user.',
            summary: 'Invite budget member',
            inject: { config: ConfigToken }
        },
        updateMember: {
            operationId: 'updateBudgetMember',
            description: 'Updates budget member role and permissions.',
            summary: 'Update budget member'
        },
        removeMember: {
            operationId: 'removeBudgetMember',
            description: 'Removes a user from a shared budget.',
            summary: 'Remove budget member'
        },
        acceptInvitation: {
            operationId: 'acceptBudgetInvitation',
            description: 'Consumes a budget invitation magic link.',
            summary: 'Accept budget invitation'
        }
    }
});
