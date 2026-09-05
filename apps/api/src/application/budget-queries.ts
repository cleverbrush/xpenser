import {
    getTableName,
    object,
    query,
    resolveColumnRef
} from '@cleverbrush/knex-schema';
import type { Knex } from 'knex';
import {
    type AppDb,
    BudgetDbSchema,
    BudgetMemberDbSchema,
    UserDbSchema
} from '../db/schemas.js';

export type BudgetListStatus = 'active' | 'archived' | 'all';

type ColumnMetadata = { getExtension(key: string): unknown };
type QualifiableColumn = ColumnMetadata & {
    withExtension(key: string, value: unknown): unknown;
};

function qualifiedProperties<T extends Record<string, QualifiableColumn>>(
    properties: T,
    table: string
): T {
    // Qualification changes SQL metadata only; each property's value type stays intact.
    return Object.fromEntries(
        Object.entries(properties).map(([key, schema]) => [
            key,
            schema.withExtension(
                'columnName',
                `${table}.${schema.getExtension('columnName') ?? key}`
            )
        ])
    ) as T;
}

const memberTable = getTableName(BudgetMemberDbSchema);
const budgetTable = getTableName(BudgetDbSchema);
const userTable = getTableName(UserDbSchema);
const member = qualifiedProperties(
    BudgetMemberDbSchema.omit(['budget', 'user']).introspect().properties,
    memberTable
);
const budget = qualifiedProperties(
    BudgetDbSchema.introspect().properties,
    budgetTable
);
const user = qualifiedProperties(
    UserDbSchema.pick([
        'id',
        'email',
        'avatarUrl',
        'avatarImageMimeType',
        'avatarImageFileName',
        'avatarImageUpdatedAt'
    ]).introspect().properties,
    userTable
);

const BudgetMembershipRowSchema = object({
    ...member,
    name: budget.name,
    defaultCurrency: budget.defaultCurrency,
    countryCode: budget.countryCode,
    createdByUserId: budget.createdByUserId,
    archivedAt: budget.archivedAt,
    budgetCreatedAt: budget.createdAt,
    budgetUpdatedAt: budget.updatedAt
}).hasTableName(memberTable);

const BudgetMemberRowSchema = object({
    ...member,
    email: user.email,
    avatarUrl: user.avatarUrl,
    avatarImageMimeType: user.avatarImageMimeType,
    avatarImageFileName: user.avatarImageFileName,
    avatarImageUpdatedAt: user.avatarImageUpdatedAt
}).hasTableName(memberTable);

function columnName(schema: ColumnMetadata): string {
    return String(schema.getExtension('columnName'));
}

function projection(properties: Record<string, ColumnMetadata>) {
    return Object.fromEntries(
        Object.entries(properties).map(([key, schema]) => [
            key,
            String(schema.getExtension('columnName') ?? key)
        ])
    );
}

export function budgetMembershipsQuery(
    knex: Knex,
    userId: number,
    status: BudgetListStatus = 'active',
    mainBudgetId = 0
) {
    // Flat schema-backed joins keep ORDER BY on the final SELECT. Eager-loading
    // puts it inside a CTE, whose ordering does not constrain the outer join.
    const builder = query(knex, BudgetMembershipRowSchema)
        .apply(sql =>
            sql
                .join(
                    budgetTable,
                    columnName(budget.id),
                    columnName(member.budgetId)
                )
                .select(
                    projection(
                        BudgetMembershipRowSchema.introspect().properties
                    )
                )
        )
        .where(row => row.userId, userId);
    if (status === 'active') builder.whereNull(row => row.archivedAt);
    if (status === 'archived') builder.whereNotNull(row => row.archivedAt);
    return builder
        .orderByRaw('case when ?? = ? then 0 else 1 end', [
            columnName(member.budgetId),
            mainBudgetId
        ])
        .orderBy(row => row.displayName, 'asc');
}

export function budgetMembersQuery(knex: Knex, budgetId: number) {
    return query(knex, BudgetMemberRowSchema)
        .apply(sql =>
            sql
                .join(userTable, columnName(user.id), columnName(member.userId))
                .select(
                    projection(BudgetMemberRowSchema.introspect().properties)
                )
        )
        .where(row => row.budgetId, budgetId)
        .orderBy(row => row.email, 'asc');
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
        .count();
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
