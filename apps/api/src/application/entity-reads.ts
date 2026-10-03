import { query } from '@cleverbrush/knex-schema';
import {
    ApiKeyDbSchema,
    BudgetDbSchema,
    BudgetInvitationDbSchema,
    BudgetMemberDbSchema,
    CategoryDbSchema,
    TransactionTagDbSchema,
    UserDbSchema,
    VendorDbSchema
} from '../db/schemas.js';

// Unscoped definitions contain no request data. Services add authorization filters.
export const apiKeyRead = query(ApiKeyDbSchema).select(k => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt
}));
export const categoryRead = query(CategoryDbSchema);
export const vendorRead = query(VendorDbSchema);
export const budgetRead = query(BudgetDbSchema);
export const budgetMemberRead = query(
    BudgetMemberDbSchema.omit(['budget', 'user'])
);
export const budgetInvitationRead = query(BudgetInvitationDbSchema);
export const transactionTagRead = query(TransactionTagDbSchema);
export const userAvatarRead = query(UserDbSchema).select(u => ({
    id: u.id,
    email: u.email,
    avatarUrl: u.avatarUrl,
    avatarImageMimeType: u.avatarImageMimeType,
    avatarImageFileName: u.avatarImageFileName,
    avatarImageUpdatedAt: u.avatarImageUpdatedAt
}));
