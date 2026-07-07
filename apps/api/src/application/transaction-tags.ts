import { getTableName, query } from '@cleverbrush/orm';
import type {
    TransactionTag,
    TransactionTagListQuery
} from '@xpenser/contracts';
import { FieldLimits, TransactionTagLimits } from '@xpenser/contracts';
import type { Knex } from 'knex';
import {
    type AppDb,
    type TransactionTagDb,
    TransactionTagDbSchema
} from '../db/schemas.js';
import { resolveBudgetAccess } from './budgets.js';

export class TransactionTagError extends Error {}

type TransactionTagRow = {
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

function mapTransactionTag(row: TransactionTagRow): TransactionTag {
    return {
        id: Number(row.id),
        budgetId: Number(row.budgetId),
        name: row.name,
        transactionCount: Number(row.transactionCount),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

export async function listTransactionTags(
    db: AppDb,
    userId: number,
    query: TransactionTagListQuery
): Promise<TransactionTag[]> {
    const access = await resolveBudgetAccess(db, userId, query.budgetId);
    const search = query.search?.trim().toLowerCase();
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const builder = db
        .knex('transaction_tags as tag')
        .leftJoin('transaction_tag_links as link', 'link.tag_id', 'tag.id')
        .where('tag.budget_id', access.budget.id)
        .groupBy('tag.id')
        .orderBy('tag.name', 'asc')
        .limit(limit)
        .select({
            budgetId: 'tag.budget_id',
            id: 'tag.id',
            name: 'tag.name',
            createdAt: 'tag.created_at',
            updatedAt: 'tag.updated_at'
        })
        .count({ transactionCount: 'link.transaction_id' });

    if (search) {
        builder.whereRaw('lower(tag.name) like ?', [`%${search}%`]);
    }

    const rows = (await builder) as TransactionTagRow[];
    return rows.map(mapTransactionTag);
}

export async function getOrCreateTransactionTag(
    knex: Knex,
    userId: number,
    budgetId: number,
    assignment: TransactionTagAssignment
): Promise<number> {
    const tableName = getTableName(TransactionTagDbSchema);
    const tag = await query(knex, TransactionTagDbSchema)
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
    await knex('transaction_tags as tag')
        .where('tag.budget_id', budgetId)
        .whereNotExists(function () {
            this.select(1)
                .from('transaction_tag_links as link')
                .whereRaw('link.tag_id = tag.id');
        })
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
    await knex('transaction_tag_links')
        .where('transaction_id', transactionId)
        .delete();

    if (assignments.length > 0) {
        const tagIds = await Promise.all(
            assignments.map(assignment =>
                getOrCreateTransactionTag(knex, userId, budgetId, assignment)
            )
        );
        await knex('transaction_tag_links').insert(
            tagIds.map(tagId => ({
                transaction_id: transactionId,
                tag_id: tagId
            }))
        );
    }

    await pruneUnusedTransactionTags(knex, budgetId);
}
