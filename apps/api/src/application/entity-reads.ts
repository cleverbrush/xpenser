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
import { perConnection } from './read-models.js';

// Unscoped definitions contain no request data. Services add authorization filters.
export const apiKeyRead = perConnection(knex =>
    query(knex, ApiKeyDbSchema).select(k => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt
    }))
);
export const categoryRead = perConnection(knex =>
    query(knex, CategoryDbSchema)
);
export const vendorRead = perConnection(knex => query(knex, VendorDbSchema));
export const budgetRead = perConnection(knex => query(knex, BudgetDbSchema));
export const budgetMemberRead = perConnection(knex =>
    query(knex, BudgetMemberDbSchema.omit(['budget', 'user']))
);
export const budgetInvitationRead = perConnection(knex =>
    query(knex, BudgetInvitationDbSchema)
);
export const transactionTagRead = perConnection(knex =>
    query(knex, TransactionTagDbSchema)
);
export const userAvatarRead = perConnection(knex =>
    query(knex, UserDbSchema).select(u => ({
        id: u.id,
        email: u.email,
        avatarUrl: u.avatarUrl,
        avatarImageMimeType: u.avatarImageMimeType,
        avatarImageFileName: u.avatarImageFileName,
        avatarImageUpdatedAt: u.avatarImageUpdatedAt
    }))
);
