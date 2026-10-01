import {
    aggregate,
    alias,
    and,
    eq,
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
import { perConnection } from './read-models.js';

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

/** Stable projection definition; no tenant filters or SQL execution are cached. */
export const transactionListRead = perConnection(knex =>
    schemaQuery(knex, alias(TransactionDbSchema, 'transactions'))
        .join(alias(CategoryDbSchema, 'category'), t =>
            eq(t.transactions.categoryId, t.category.id)
        )
        .leftJoin(alias(CategoryDbSchema, 'parent'), t =>
            eq(t.category.parentId, t.parent.id)
        )
        .leftJoin(alias(VendorDbSchema, 'vendor'), t =>
            eq(t.transactions.vendorId, t.vendor.id)
        )
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
);

/** Immutable filtered source shared safely by count and page branches. */
export function transactionListBaseQuery(
    knex: Knex,
    budgetId: number,
    query: TransactionFilterQuery
) {
    let source = transactionListRead(knex).where(
        t => t.transactions.budgetId,
        budgetId
    );
    if (query.categoryId)
        source = source.where(t => t.transactions.categoryId, query.categoryId);
    if (query.from)
        source = source.where(t => t.transactions.occurredAt, '>=', query.from);
    if (query.to)
        source = source.where(t => t.transactions.occurredAt, '<=', query.to);
    if (query.vendorId === 'none')
        source = source.whereNull(t => t.transactions.vendorId);
    else if (query.vendorId)
        source = source.where(t => t.transactions.vendorId, query.vendorId);
    // Bound raw predicates keep application-specific search/type semantics.
    if (query.type) {
        source = source.whereRaw(
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
        source = source.where(parentBuilder => {
            return parentBuilder
                .where(t => t.transactions.categoryId, query.parentCategoryId)
                .orWhere(t => t.category.parentId, query.parentCategoryId);
        });
    }

    const tagIds = transactionTagIds(query.tagIds);
    for (const tagId of tagIds) {
        source = source.whereExists(
            schemaQuery(knex, TransactionTagLinkDbSchema)
                .select(link => link.tagId)
                .where(link => link.tagId, tagId)
                .where(
                    link => link.transactionId,
                    source.ref(t => t.transactions.id)
                )
                .toKnexQuery()
        );
    }
    if (query.untagged === true) {
        source = source.whereNotExists(
            schemaQuery(knex, TransactionTagLinkDbSchema)
                .select(link => link.tagId)
                .where(
                    link => link.transactionId,
                    source.ref(t => t.transactions.id)
                )
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
            .where(
                link => link.transactionId,
                source.ref(t => t.transactions.id)
            )
            .toKnexQuery();
        source = source.where(searchBuilder => {
            return searchBuilder
                .whereRaw("category.name ILIKE ? ESCAPE '!'", [pattern])
                .orWhereRaw(
                    "COALESCE(parent.name || ' -> ' || category.name, category.name) ILIKE ? ESCAPE '!'",
                    [pattern]
                )
                .orWhereRaw("vendor.name ILIKE ? ESCAPE '!'", [pattern])
                .orWhereRaw("vendor.domain ILIKE ? ESCAPE '!'", [pattern])
                .orWhereRaw("transactions.note ILIKE ? ESCAPE '!'", [pattern])
                .orWhereExists(tagSearch);
        });
    }
    return source;
}

export function transactionListCountQuery(
    builder: ReturnType<typeof transactionListBaseQuery>
) {
    return builder.select(t => {
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

export const scanAttachmentRead = perConnection(knex =>
    confirmedScanImagesQuery(knex).select(t => ({
        transactionId: t.item.transactionId,
        budgetId: t.item.budgetId,
        scanId: t.item.scanId,
        scanItemId: t.item.id,
        fileName: t.image.fileName,
        mimeType: t.image.mimeType,
        sizeBytes: t.image.sizeBytes,
        createdAt: t.image.createdAt
    }))
);

export function scanAttachmentsQuery(
    knex: Knex,
    budgetId: number,
    transactionIds: readonly number[]
) {
    return scanAttachmentRead(knex)
        .where(t => t.item.budgetId, budgetId)
        .where(t => t.image.budgetId, budgetId)
        .whereIn(t => t.item.transactionId, transactionIds);
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
