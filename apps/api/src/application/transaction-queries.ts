import {
    aggregate,
    alias,
    and,
    eq,
    getTableName,
    query as schemaQuery
} from '@cleverbrush/knex-schema';
import type { TransactionListQuery } from '@xpenser/contracts';
import type { Knex } from 'knex';
import {
    CategoryDbSchema,
    TransactionDbSchema,
    TransactionScanImageDbSchema,
    TransactionScanItemDbSchema,
    TransactionTagDbSchema,
    TransactionTagLinkDbSchema,
    VendorDbSchema
} from '../db/schemas.js';

export type TransactionFilterQuery = Pick<
    TransactionListQuery,
    | 'budgetId'
    | 'categoryId'
    | 'direction'
    | 'from'
    | 'parentCategoryId'
    | 'search'
    | 'tagIds'
    | 'to'
    | 'type'
    | 'untagged'
    | 'vendorId'
>;

export function transactionTagIds(value: string | undefined): number[] {
    if (!value) return [];
    return [
        ...new Set(
            value
                .split(',')
                .map(Number)
                .filter(item => Number.isInteger(item) && item > 0)
        )
    ];
}

function transactionSearchPattern(value: string): string {
    return `%${value.replaceAll('!', '!!').replaceAll('%', '!%').replaceAll('_', '!_')}%`;
}

/** A fresh filtered source for each count/page; neither query mutates the other. */
export function transactionListBaseQuery(
    knex: Knex,
    budgetId: number,
    query: TransactionFilterQuery
) {
    const source = schemaQuery(knex, alias(TransactionDbSchema, 'transactions'))
        .join(alias(CategoryDbSchema, 'category'), t =>
            eq(t.transactions.categoryId, t.category.id)
        )
        .leftJoin(alias(CategoryDbSchema, 'parent'), t =>
            eq(t.category.parentId, t.parent.id)
        )
        .leftJoin(alias(VendorDbSchema, 'vendor'), t =>
            eq(t.transactions.vendorId, t.vendor.id)
        )
        .where(t => t.transactions.budgetId, budgetId);
    if (query.categoryId)
        source.where(t => t.transactions.categoryId, query.categoryId);
    if (query.from)
        source.where(t => t.transactions.occurredAt, '>=', query.from);
    if (query.to) source.where(t => t.transactions.occurredAt, '<=', query.to);
    if (query.vendorId === 'none')
        source.whereNull(t => t.transactions.vendorId);
    else if (query.vendorId)
        source.where(t => t.transactions.vendorId, query.vendorId);
    // These application-specific predicates intentionally use bound Knex SQL.
    return source.apply(builder => {
        if (query.type) {
            builder.whereRaw(
                `CASE
                WHEN category.kind = 'offset'
                    THEN CASE category.type
                        WHEN 'expense' THEN 'income'
                        ELSE 'expense'
                    END
                ELSE category.type
            END = ?`,
                [query.type]
            );
        }
        if (query.parentCategoryId) {
            builder.where(parentBuilder => {
                parentBuilder
                    .where('transactions.category_id', query.parentCategoryId)
                    .orWhere('category.parent_id', query.parentCategoryId);
            });
        }

        const tagIds = transactionTagIds(query.tagIds);
        for (const tagId of tagIds) {
            builder.whereExists(
                schemaQuery(knex, TransactionTagLinkDbSchema)
                    .select(link => link.tagId)
                    .where(link => link.tagId, tagId)
                    .whereRaw('??.?? = ??.??', [
                        getTableName(TransactionTagLinkDbSchema),
                        'transaction_id',
                        getTableName(TransactionDbSchema),
                        'id'
                    ])
                    .toKnexQuery()
            );
        }
        if (query.untagged === true) {
            builder.whereNotExists(
                schemaQuery(knex, TransactionTagLinkDbSchema)
                    .select(link => link.tagId)
                    .whereRaw('??.?? = ??.??', [
                        getTableName(TransactionTagLinkDbSchema),
                        'transaction_id',
                        getTableName(TransactionDbSchema),
                        'id'
                    ])
                    .toKnexQuery()
            );
        }

        const search = query.search?.trim();
        if (search) {
            const pattern = transactionSearchPattern(search);
            const searchTagIds = schemaQuery(knex, TransactionTagDbSchema)
                .where(tag => tag.budgetId, budgetId)
                .whereRaw("?? ILIKE ? ESCAPE '!'", ['name', pattern])
                .select(tag => tag.id)
                .toKnexQuery();
            const tagSearch = schemaQuery(knex, TransactionTagLinkDbSchema)
                .select(link => link.tagId)
                .whereIn(link => link.tagId, searchTagIds)
                .whereRaw('??.?? = ??.??', [
                    getTableName(TransactionTagLinkDbSchema),
                    'transaction_id',
                    getTableName(TransactionDbSchema),
                    'id'
                ])
                .toKnexQuery();
            builder.where(searchBuilder => {
                searchBuilder
                    .whereRaw("category.name ILIKE ? ESCAPE '!'", [pattern])
                    .orWhereRaw(
                        "COALESCE(parent.name || ' -> ' || category.name, category.name) ILIKE ? ESCAPE '!'",
                        [pattern]
                    )
                    .orWhereRaw("vendor.name ILIKE ? ESCAPE '!'", [pattern])
                    .orWhereRaw("vendor.domain ILIKE ? ESCAPE '!'", [pattern])
                    .orWhereRaw("transactions.note ILIKE ? ESCAPE '!'", [
                        pattern
                    ])
                    .orWhereExists(tagSearch);
            });
        }
    });
}

export function transactionListCountQuery(
    knex: Knex,
    budgetId: number,
    query: TransactionFilterQuery
) {
    return transactionListBaseQuery(knex, budgetId, query).select(t => {
        const total = aggregate.count(t.transactions.id);
        return { total };
    });
}

export function transactionListPageQuery(
    builder: ReturnType<typeof transactionListBaseQuery>,
    direction: 'asc' | 'desc',
    limit: number,
    offset: number
) {
    return builder
        .select(t => ({
            id: t.transactions.id,
            budgetId: t.transactions.budgetId,
            userId: t.transactions.userId,
            categoryId: t.transactions.categoryId,
            vendorId: t.transactions.vendorId,
            type: t.transactions.type,
            amount: t.transactions.amount,
            currency: t.transactions.currency,
            defaultCurrencyAmount: t.transactions.defaultCurrencyAmount,
            defaultCurrency: t.transactions.defaultCurrency,
            exchangeRate: t.transactions.exchangeRate,
            exchangeRateDate: t.transactions.exchangeRateDate,
            occurredAt: t.transactions.occurredAt,
            note: t.transactions.note,
            createdAt: t.transactions.createdAt,
            updatedAt: t.transactions.updatedAt,
            categoryName: t.category.name,
            categoryType: t.category.type,
            categoryKind: t.category.kind,
            categoryParentId: t.category.parentId,
            categoryParentName: t.parent.name,
            vendorName: t.vendor.name,
            vendorLogoUrl: t.vendor.logoUrl
        }))
        .orderBy(t => t.transactions.occurredAt, direction)
        .orderBy(t => t.transactions.id, direction)
        .limit(limit)
        .offset(offset);
}

export type TransactionListRow = Awaited<
    ReturnType<typeof transactionListPageQuery>
>[number];

export function transactionTagCountsQuery(
    knex: Knex,
    tagIds: readonly number[]
) {
    return schemaQuery(knex, TransactionTagLinkDbSchema)
        .whereIn(t => t.tagId, [...new Set(tagIds)])
        .groupBy(t => t.tagId)
        .select(t => ({
            tagId: t.tagId,
            transactionCount: aggregate.count(t.transactionId)
        }));
}

export function transactionTagsQuery(
    knex: Knex,
    budgetId: number,
    transactionIds: readonly number[]
) {
    return schemaQuery(knex, alias(TransactionTagLinkDbSchema, 'link'))
        .join(alias(TransactionTagDbSchema, 'tag'), t =>
            eq(t.link.tagId, t.tag.id)
        )
        .where(t => t.tag.budgetId, budgetId)
        .whereIn(t => t.link.transactionId, transactionIds)
        .orderBy(t => t.tag.name, 'asc')
        .select(t => ({
            transactionId: t.link.transactionId,
            budgetId: t.tag.budgetId,
            id: t.tag.id,
            name: t.tag.name,
            createdAt: t.tag.createdAt,
            updatedAt: t.tag.updatedAt
        }));
}

function confirmedScanImagesQuery(knex: Knex) {
    return schemaQuery(knex, alias(TransactionScanItemDbSchema, 'item'))
        .join(alias(TransactionScanImageDbSchema, 'image'), t =>
            and(
                eq(t.item.scanId, t.image.scanId),
                eq(t.item.budgetId, t.image.budgetId)
            )
        )
        .where(t => t.item.decision, 'confirmed')
        .orderBy(t => t.item.decidedAt, 'desc');
}

export function scanAttachmentsQuery(
    knex: Knex,
    budgetId: number,
    transactionIds: readonly number[]
) {
    return confirmedScanImagesQuery(knex)
        .where(t => t.item.budgetId, budgetId)
        .where(t => t.image.budgetId, budgetId)
        .whereIn(t => t.item.transactionId, transactionIds)
        .select(t => ({
            transactionId: t.item.transactionId,
            budgetId: t.item.budgetId,
            scanId: t.item.scanId,
            scanItemId: t.item.id,
            fileName: t.image.fileName,
            mimeType: t.image.mimeType,
            sizeBytes: t.image.sizeBytes,
            createdAt: t.image.createdAt
        }));
}

export function transactionScanImageQuery(knex: Knex, transactionId: number) {
    return confirmedScanImagesQuery(knex)
        .where(t => t.item.transactionId, transactionId)
        .select(t => ({
            scanId: t.item.scanId,
            scanItemId: t.item.id,
            budgetId: t.item.budgetId,
            fileName: t.image.fileName,
            mimeType: t.image.mimeType,
            sizeBytes: t.image.sizeBytes,
            createdAt: t.image.createdAt,
            imageBase64: t.image.imageBase64
        }));
}
