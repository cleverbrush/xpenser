import { getTableName, query as schemaQuery } from '@cleverbrush/knex-schema';
import { mapper } from '@cleverbrush/mapper';
import { date, number, object, string, union } from '@cleverbrush/schema';
import type {
    TransactionTag,
    TransactionTagListQuery
} from '@xpenser/contracts';
import {
    FieldLimits,
    TransactionTagLimits,
    TransactionTagSchema
} from '@xpenser/contracts';
import type { Knex } from 'knex';
import {
    type AppDb,
    type TransactionTagDb,
    TransactionTagDbSchema,
    TransactionTagLinkDbSchema
} from '../db/schemas.js';
import { resolveBudgetAccess } from './budgets.js';

export class TransactionTagError extends Error {}

export type TransactionTagMappingRow = {
    readonly budgetId: number;
    readonly id: number;
    readonly name: string;
    readonly transactionCount: number | string;
    readonly createdAt: Date;
    readonly updatedAt: Date;
};

export type TransactionTagAssignment = {
    readonly name: string;
    readonly normalizedName: string;
};

export function normalizeTransactionTagName(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function normalizedTransactionTagKey(value: string): string {
    return normalizeTransactionTagName(value).toLowerCase();
}

export function normalizeTransactionTagAssignments(
    tags: readonly string[] | undefined
): TransactionTagAssignment[] {
    if (!tags) {
        return [];
    }

    const assignments: TransactionTagAssignment[] = [];
    const seen = new Set<string>();
    for (const tag of tags) {
        const name = normalizeTransactionTagName(tag);
        if (!name) {
            throw new TransactionTagError('Tag name is required.');
        }
        if (name.length > FieldLimits.transactionTagName) {
            throw new TransactionTagError('Tag name is too long.');
        }

        const normalizedName = normalizedTransactionTagKey(name);
        if (seen.has(normalizedName)) {
            continue;
        }
        seen.add(normalizedName);
        assignments.push({ name, normalizedName });
    }

    if (assignments.length > TransactionTagLimits.maxTagsPerTransaction) {
        throw new TransactionTagError(
            `Transactions can have at most ${TransactionTagLimits.maxTagsPerTransaction} tags.`
        );
    }

    return assignments;
}

const TransactionTagMappingSourceSchema = object({
    id: number(),
    budgetId: number(),
    name: string(),
    transactionCount: union(number()).or(string()),
    createdAt: date(),
    updatedAt: date()
});

const mapTransactionTagRow = mapper()
    .configure(
        TransactionTagMappingSourceSchema,
        TransactionTagSchema,
        mapping =>
            mapping
                .for(target => target.id)
                .compute(source => Number(source.id))
                .for(target => target.budgetId)
                .compute(source => Number(source.budgetId))
                .for(target => target.transactionCount)
                .compute(source => Number(source.transactionCount))
    )
    .getMapper(TransactionTagMappingSourceSchema, TransactionTagSchema);

export function mapTransactionTag(
    row: TransactionTagMappingRow
): Promise<TransactionTag> {
    return mapTransactionTagRow(row);
}

export function transactionTagListQuery(
    knex: Knex,
    budgetId: number,
    search: string | undefined,
    limit: number
): Knex.QueryBuilder {
    const tagTable = getTableName(TransactionTagDbSchema);
    const linkTable = getTableName(TransactionTagLinkDbSchema);
    const tagIdColumn = 'id';
    const linkTagIdColumn = 'tag_id';
    const linkTransactionIdColumn = 'transaction_id';
    const builder = schemaQuery(knex, TransactionTagDbSchema).where(
        tag => tag.budgetId,
        budgetId
    );
    if (search) {
        builder.whereILike(tag => tag.name, `%${search}%`);
    }
    return builder
        .orderBy(tag => tag.name, 'asc')
        .limit(limit)
        .select(tag => ({
            budgetId: tag.budgetId,
            id: tag.id,
            name: tag.name,
            createdAt: tag.createdAt,
            updatedAt: tag.updatedAt
        }))
        .selectRaw(`(select count(??) from ?? where ??.?? = ??.??) as ??`, [
            linkTransactionIdColumn,
            linkTable,
            linkTable,
            linkTagIdColumn,
            tagTable,
            tagIdColumn,
            'transactionCount'
        ])
        .toKnexQuery();
}

export async function listTransactionTags(
    db: AppDb,
    userId: number,
    query: TransactionTagListQuery
): Promise<TransactionTag[]> {
    const access = await resolveBudgetAccess(db, userId, query.budgetId);
    const search = query.search?.trim().toLowerCase();
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const builder = transactionTagListQuery(
        db.knex,
        access.budget.id,
        search,
        limit
    );

    const rows = (await builder) as TransactionTagMappingRow[];
    return Promise.all(rows.map(mapTransactionTag));
}

export async function getOrCreateTransactionTag(
    knex: Knex,
    userId: number,
    budgetId: number,
    assignment: TransactionTagAssignment
): Promise<number> {
    const tableName = getTableName(TransactionTagDbSchema);
    const tag = await schemaQuery(knex, TransactionTagDbSchema)
        .onConflict(
            tag => tag.budgetId,
            tag => tag.normalizedName
        )
        .merge(
            {
                budgetId,
                userId,
                name: assignment.name,
                normalizedName: assignment.normalizedName
            },
            {
                name: ({ column, raw }) =>
                    raw('??.??', [tableName, column(tag => tag.name)])
            }
        );

    if (!tag) {
        throw new TransactionTagError('Could not save transaction tag.');
    }

    return Number((tag as TransactionTagDb).id);
}

export async function pruneUnusedTransactionTags(
    knex: Knex,
    budgetId: number
): Promise<void> {
    const tagTable = getTableName(TransactionTagDbSchema);
    const linkTable = getTableName(TransactionTagLinkDbSchema);
    const linkQuery = schemaQuery(knex, TransactionTagLinkDbSchema)
        .select(link => link.tagId)
        .whereRaw('??.?? = ??.??', [linkTable, 'tag_id', tagTable, 'id'])
        .toKnexQuery();
    await schemaQuery(knex, TransactionTagDbSchema)
        .where(tag => tag.budgetId, budgetId)
        .whereNotExists(linkQuery)
        .delete();
}

export async function replaceTransactionTags(
    knex: Knex,
    userId: number,
    budgetId: number,
    transactionId: number,
    tags: readonly string[]
): Promise<void> {
    const assignments = normalizeTransactionTagAssignments(tags);
    await schemaQuery(knex, TransactionTagLinkDbSchema)
        .where(link => link.transactionId, transactionId)
        .delete();

    if (assignments.length > 0) {
        const tagIds = await Promise.all(
            assignments.map(assignment =>
                getOrCreateTransactionTag(knex, userId, budgetId, assignment)
            )
        );
        await schemaQuery(knex, TransactionTagLinkDbSchema).insertMany(
            tagIds.map(tagId => ({
                transactionId,
                tagId
            }))
        );
    }

    await pruneUnusedTransactionTags(knex, budgetId);
}
