import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { createDb } from '@cleverbrush/orm';
import knexFactory, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    budgetAdminCountQuery,
    budgetMembershipsQuery,
    budgetMembersQuery
} from '../src/application/budget-queries.js';
import { BudgetAccessError } from '../src/application/budgets.js';
import {
    scanAttachmentsQuery,
    type TransactionFilterQuery,
    transactionListBaseQuery,
    transactionListCountQuery,
    transactionListPageQuery,
    transactionScanImageQuery,
    transactionTagCountsQuery,
    transactionTagsQuery
} from '../src/application/transaction-queries.js';
import { transactionTagListQuery } from '../src/application/transaction-tags.js';
import {
    exportTransactionsCsv,
    getTransactionScanImage,
    listTransactions
} from '../src/application/transactions.js';
import { entityMap } from '../src/db/schemas.js';

const connection = process.env.QUERY_TEST_DATABASE_URL;
if (!connection || new URL(connection).pathname !== '/xpenser_queries')
    throw new Error(
        'QUERY_TEST_DATABASE_URL must point to a dedicated xpenser_queries database'
    );
const schema = 'xpenser_queries_' + randomUUID().replaceAll('-', '');
const knex = knexFactory({
    client: 'pg',
    connection,
    searchPath: [schema],
    pool: { min: 0, max: 4 }
});
const db = createDb(knex, entityMap);
let createdSchema = false;
const timestamp = '2026-06-01T12:00:00.123456Z';

beforeAll(async () => {
    await knex.schema.createSchema(schema);
    createdSchema = true;
    // Actual application migrations, confined to this randomly named schema.
    const directory = new URL('../src/db/migrations/', import.meta.url);
    for (const file of readdirSync(directory)
        .filter(f => f.endsWith('.ts'))
        .sort()) {
        const migration = await import(new URL(file, directory).href);
        await migration.up(knex);
    }
    await knex('users').insert([
        { id: 1, email: 'z@example.test' },
        { id: 2, email: 'a@example.test' },
        { id: 3, email: 'outsider@example.test' }
    ]);
    await knex('budgets').insert([
        { id: 1, name: 'Main', default_currency: 'USD', created_by_user_id: 1 },
        {
            id: 2,
            name: 'Archived',
            default_currency: 'USD',
            created_by_user_id: 1,
            archived_at: timestamp
        },
        {
            id: 3,
            name: 'Private',
            default_currency: 'USD',
            created_by_user_id: 3
        },
        { id: 4, name: 'Alpha', default_currency: 'USD', created_by_user_id: 1 }
    ]);
    await knex('users').where('id', 1).update({ main_budget_id: 1 });
    await knex('budget_members').insert([
        { budget_id: 1, user_id: 1, display_name: 'Main', role: 'admin' },
        { budget_id: 1, user_id: 2, display_name: 'Shared', role: 'admin' },
        { budget_id: 2, user_id: 1, display_name: 'Archived', role: 'admin' },
        { budget_id: 3, user_id: 3, display_name: 'Private', role: 'admin' },
        { budget_id: 4, user_id: 1, display_name: 'Alpha', role: 'admin' }
    ]);
    await knex('categories').insert([
        {
            id: 10,
            budget_id: 1,
            user_id: 1,
            name: 'Food',
            type: 'expense',
            kind: 'normal'
        },
        {
            id: 13,
            budget_id: 1,
            user_id: 1,
            name: 'Salary',
            type: 'income',
            kind: 'normal'
        },
        {
            id: 30,
            budget_id: 3,
            user_id: 3,
            name: 'Private',
            type: 'expense',
            kind: 'normal'
        }
    ]);
    await knex('categories').insert([
        {
            id: 11,
            budget_id: 1,
            user_id: 1,
            name: 'Meals',
            parent_id: 10,
            type: 'expense',
            kind: 'normal'
        },
        {
            id: 12,
            budget_id: 1,
            user_id: 1,
            name: 'Refund',
            parent_id: 10,
            type: 'expense',
            kind: 'offset'
        }
    ]);
    await knex('vendors').insert({
        id: 20,
        budget_id: 1,
        user_id: 1,
        name: 'Cafe',
        normalized_name: 'cafe',
        domain: 'cafe.example'
    });
    const base = {
        budget_id: 1,
        user_id: 1,
        type: 'expense',
        amount: '12.34',
        currency: 'USD',
        default_currency_amount: '12.34',
        default_currency: 'USD',
        exchange_rate: '1.00000000',
        exchange_rate_date: '2026-06-01',
        occurred_at: timestamp
    };
    await knex('transactions').insert([
        {
            ...base,
            id: 101,
            category_id: 11,
            vendor_id: 20,
            note: 'literal 50%_!'
        },
        { ...base, id: 102, category_id: 11 },
        {
            ...base,
            id: 103,
            category_id: 12,
            occurred_at: '2026-06-01T11:00:00Z'
        },
        {
            ...base,
            id: 104,
            category_id: 13,
            type: 'income',
            occurred_at: '2026-06-01T12:00:00.123457Z'
        },
        { ...base, id: 301, budget_id: 3, user_id: 3, category_id: 30 }
    ]);
    await knex('transaction_tags').insert([
        {
            id: 40,
            budget_id: 1,
            user_id: 1,
            name: 'Travel',
            normalized_name: 'travel'
        },
        {
            id: 41,
            budget_id: 1,
            user_id: 1,
            name: 'Joint',
            normalized_name: 'joint'
        },
        {
            id: 42,
            budget_id: 1,
            user_id: 1,
            name: 'Unused',
            normalized_name: 'unused'
        },
        {
            id: 43,
            budget_id: 3,
            user_id: 3,
            name: 'Private',
            normalized_name: 'private'
        }
    ]);
    await knex('transaction_tag_links').insert([
        { transaction_id: 101, tag_id: 40 },
        { transaction_id: 101, tag_id: 41 },
        { transaction_id: 102, tag_id: 40 },
        { transaction_id: 301, tag_id: 43 }
    ]);
    for (const id of [51, 52, 53, 54]) {
        const budgetId = id === 54 ? 3 : 1,
            userId = id === 54 ? 3 : 1;
        await knex('transaction_scans').insert({
            id,
            budget_id: budgetId,
            user_id: userId,
            document_kind: 'receipt',
            image_hash: String(id),
            model: 'fixture',
            warnings_json: '[]'
        });
        await knex('transaction_scan_images').insert({
            scan_id: id,
            budget_id: budgetId,
            user_id: userId,
            image_hash: String(id),
            mime_type: 'image/png',
            file_name: id === 52 ? null : 'old.png',
            size_bytes: 5,
            image_base64: Buffer.from('image').toString('base64')
        });
        await knex('transaction_scan_items').insert({
            id: id + 10,
            scan_id: id,
            budget_id: budgetId,
            user_id: userId,
            transaction_id: id === 54 ? 301 : id === 53 ? 102 : 101,
            decision: id === 53 ? null : 'confirmed',
            draft_json: '{}',
            decided_at: id === 51 ? '2026-05-31T12:00:00Z' : timestamp
        });
    }
});

afterAll(async () => {
    try {
        if (createdSchema) await knex.schema.dropSchemaIfExists(schema, true);
    } finally {
        await knex.destroy();
    }
});

describe('published Framework queries on PostgreSQL', () => {
    it('keeps main-budget-first sorting, archive filters and membership scope', async () => {
        expect(
            (await budgetMembershipsQuery(knex, 1, 'active', 1)).map(
                r => r.budgetId
            )
        ).toEqual([1, 4]);
        expect(
            (await budgetMembershipsQuery(knex, 1, 'archived', 1)).map(
                r => r.budgetId
            )
        ).toEqual([2]);
        expect(await budgetMembershipsQuery(knex, 99, 'all')).toEqual([]);
        expect(
            (await budgetMembershipsQuery(knex, 1, 'all', 1)).map(
                r => r.budgetId
            )
        ).not.toContain(3);
    });
    it('orders members and exposes only summary fields', async () => {
        const rows = await budgetMembersQuery(knex, 1);
        expect(rows.map(r => r.email)).toEqual([
            'a@example.test',
            'z@example.test'
        ]);
        expect(rows[0]).toMatchObject({ avatarUrl: null, budgetId: 1 });
        expect(rows[0]).not.toHaveProperty('passwordHash');
        expect(rows[0]).not.toHaveProperty('avatarImageBase64');
    });
    it('decodes scalar counts and keeps the caller transaction', async () => {
        expect(await budgetAdminCountQuery(db, 1)).toBe(2);
        expect(await budgetAdminCountQuery(db, 999)).toBe(0);
        const rollback = new Error('fixture rollback');
        await expect(
            db.transaction(async tx => {
                await tx.knex('budget_members').insert({
                    budget_id: 1,
                    user_id: 3,
                    role: 'admin',
                    display_name: 'Temporary'
                });
                expect(await budgetAdminCountQuery(tx, 1)).toBe(3);
                throw rollback;
            })
        ).rejects.toBe(rollback);
        expect(await budgetAdminCountQuery(db, 1)).toBe(2);
    });
    it.each([
        'asc',
        'desc'
    ] as const)('keeps ties, page boundaries and totals in %s order', async direction => {
        const first = await listTransactions(db, 1, {
            budgetId: 1,
            direction,
            limit: 2,
            page: 1
        });
        const second = await listTransactions(db, 1, {
            budgetId: 1,
            direction,
            limit: 2,
            page: 2
        });
        const ids = [...first.items, ...second.items].map(r => r.id);
        expect(ids).toEqual(
            direction === 'asc' ? [103, 101, 102, 104] : [104, 102, 101, 103]
        );
        expect(first).toMatchObject({ total: 4, page: 1, limit: 2 });
        expect(second.total).toBe(4);
        expect(new Set(ids).size).toBe(4);
        const row = [...first.items, ...second.items].find(r => r.id === 101)!;
        expect(row).toMatchObject({
            amount: 12.34,
            exchangeRate: 1,
            categoryDisplayName: 'Food -> Meals'
        });
        expect(row.tags.map(t => t.name)).toEqual(['Joint', 'Travel']);
        expect(row.scanAttachment).toMatchObject({
            scanId: 52,
            fileName: null
        });
    });
    const filters: Array<
        [Omit<TransactionFilterQuery, 'direction'>, number[]]
    > = [
        [{ categoryId: 11 }, [102, 101]],
        [{ parentCategoryId: 10 }, [102, 101, 103]],
        [{ vendorId: 'none' }, [104, 102, 103]],
        [{ vendorId: 20 }, [101]],
        [{ type: 'income' }, [104, 103]],
        [{ tagIds: '40,41,40' }, [101]],
        [{ untagged: true }, [104, 103]],
        [{ search: '50%_!' }, [101]],
        [{ search: 'Food -> Meals' }, [102, 101]],
        [{ search: 'cafe.example' }, [101]],
        [{ search: 'Travel' }, [102, 101]],
        [{ search: 'missing' }, []],
        [
            {
                from: new Date('2026-06-01T11:30:00Z'),
                to: new Date('2026-06-01T12:30:00Z')
            },
            [104, 102, 101]
        ]
    ];
    it.each(
        filters
    )('matches page/count filters for %j', async (filter, ids) => {
        const rows = await transactionListPageQuery(
            transactionListBaseQuery(knex, 1, { direction: 'desc', ...filter }),
            'desc',
            100,
            0
        );
        expect(rows.map(r => r.id)).toEqual(ids);
        expect(
            (
                await transactionListCountQuery(knex, 1, {
                    direction: 'desc',
                    ...filter
                }).first()
            )?.total
        ).toBe(ids.length);
    });
    it('keeps nullable joins, driver decimals and out-of-range pages', async () => {
        const rows = await transactionListPageQuery(
            transactionListBaseQuery(knex, 1, { direction: 'asc' }),
            'asc',
            100,
            0
        );
        expect(rows.find(r => r.id === 104)).toMatchObject({
            vendorName: null,
            categoryParentName: null
        });
        expect(rows.find(r => r.id === 101)?.amount).toBe('12.34');
        expect(
            await listTransactions(db, 1, {
                budgetId: 1,
                limit: 2,
                page: 99,
                direction: 'asc'
            })
        ).toEqual({ items: [], total: 4, limit: 2, page: 99 });
        await expect(
            listTransactions(db, 3, {
                budgetId: 1,
                limit: 2,
                page: 1,
                direction: 'asc'
            })
        ).rejects.toBeInstanceOf(BudgetAccessError);
    });
    it('counts groups and unused tags without multiplying parent rows', async () => {
        expect(await transactionTagCountsQuery(knex, [])).toEqual([]);
        expect(
            (await transactionTagCountsQuery(knex, [40, 40, 41, 42])).sort(
                (a, b) => a.tagId - b.tagId
            )
        ).toEqual([
            { tagId: 40, transactionCount: 2 },
            { tagId: 41, transactionCount: 1 }
        ]);
        const tags = await transactionTagListQuery(knex, 1, undefined, 100);
        expect(tags.map(t => [t.name, t.transactionCount])).toEqual([
            ['Joint', 1],
            ['Travel', 2],
            ['Unused', 0]
        ]);
        expect(
            (await transactionTagListQuery(knex, 1, 'trav', 1)).map(t => t.id)
        ).toEqual([40]);
        expect(
            (await transactionTagsQuery(knex, 1, [101, 301])).map(
                t => t.transactionId
            )
        ).toEqual([101, 101]);
    });
    it('selects confirmed scan summaries and authorizes image reads', async () => {
        const attachments = await scanAttachmentsQuery(
            knex,
            1,
            [101, 102, 301]
        );
        expect(attachments.map(r => r.scanId)).toEqual([52, 51]);
        expect(attachments[0]).not.toHaveProperty('imageBase64');
        expect(
            (await transactionScanImageQuery(knex, 101).first())?.scanId
        ).toBe(52);
        expect(
            await transactionScanImageQuery(knex, 102).first()
        ).toBeUndefined();
        expect(await getTransactionScanImage(db, knex, 1, 101)).toMatchObject({
            scanId: 52,
            sizeBytes: 5
        });
        await expect(
            getTransactionScanImage(db, knex, 3, 101)
        ).rejects.toBeInstanceOf(BudgetAccessError);
    });
    it('preserves eager parent ordering and parent page size', async () => {
        const rows = await db.budgetMembers
            .include(t => t.budget)
            .where(t => t.userId, 1)
            .orderBy(t => t.displayName, 'asc')
            .orderBy(t => t.budgetId, 'asc')
            .limit(2)
            .offset(1);
        expect(rows.map(r => r.budgetId)).toEqual([2, 1]);
        expect(rows.every(r => r.budget !== null)).toBe(true);
    });
    it('exports in database order without a redundant in-memory sort', async () => {
        const { csv } = await exportTransactionsCsv(
            db,
            {} as never,
            1,
            {
                budgetId: 1,
                direction: 'desc',
                currencies: 'USD'
            },
            knex
        );
        const lines = csv.trim().split('\n').slice(1);
        expect(lines.map(line => Number(line.split(',')[0]))).toEqual([
            104, 102, 101, 103
        ]);
    });
    it('keeps enrichment query count constant as the page grows', async () => {
        let queries = 0;
        const count = () => {
            queries++;
        };
        knex.on('query', count);
        try {
            await listTransactions(db, 1, {
                budgetId: 1,
                direction: 'asc',
                limit: 1,
                page: 2
            });
            const single = queries;
            queries = 0;
            await listTransactions(db, 1, {
                budgetId: 1,
                direction: 'asc',
                limit: 4,
                page: 1
            });
            expect(queries).toBe(single);
            expect(queries).toBeLessThanOrEqual(10);
        } finally {
            knex.off('query', count);
        }
    });
    it('compares representative baseline and typed query plans', async () => {
        const rollback = new Error('performance fixture rollback');
        await expect(
            knex.transaction(async tx => {
                await tx('transaction_tags').insert(
                    Array.from({ length: 100 }, (_, i) => ({
                        id: 1000 + i,
                        budget_id: 1,
                        user_id: 1,
                        name: 'Tag ' + i,
                        normalized_name: 'tag ' + i
                    }))
                );
                for (let start = 0; start < 10_000; start += 1000) {
                    await tx('transactions').insert(
                        Array.from({ length: 1000 }, (_, j) => ({
                            id: 10000 + start + j,
                            budget_id: 1,
                            user_id: 1,
                            category_id: 11,
                            type: 'expense',
                            amount: '12.34',
                            currency: 'USD',
                            default_currency_amount: '12.34',
                            default_currency: 'USD',
                            exchange_rate: '1',
                            exchange_rate_date: '2026-06-01',
                            occurred_at: timestamp
                        }))
                    );
                    await tx('transaction_tag_links').insert(
                        Array.from({ length: 1000 }, (_, j) => ({
                            transaction_id: 10000 + start + j,
                            tag_id: 1000 + ((start + j) % 100)
                        }))
                    );
                }
                await tx.raw('analyze transactions');
                await tx.raw('analyze transaction_tags');
                await tx.raw('analyze transaction_tag_links');
                const page = transactionListPageQuery(
                    transactionListBaseQuery(tx, 1, { direction: 'desc' }),
                    'desc',
                    50,
                    0
                )
                    .toKnexQuery()
                    .toSQL();
                // Equivalent pre-adoption flat joins, without Framework's scoped-source wrappers.
                const baselinePage = {
                    ...page,
                    sql: page.sql.replace(
                        /\(select \* from "([^"]+)"\) as "([^"]+)"/g,
                        '"$1" as "$2"'
                    )
                };
                const oldTags = tx('transaction_tags')
                    .where('budget_id', 1)
                    .orderBy('name', 'asc')
                    .limit(25)
                    .select(
                        'id',
                        'budget_id',
                        'name',
                        'created_at',
                        'updated_at'
                    )
                    .select(
                        tx.raw(
                            '(select count(transaction_id) from transaction_tag_links where transaction_tag_links.tag_id = transaction_tags.id) as "transactionCount"'
                        )
                    );
                const tags = transactionTagListQuery(tx, 1, undefined, 25);
                expect(
                    (await oldTags).map(r => [r.id, Number(r.transactionCount)])
                ).toEqual((await tags).map(r => [r.id, r.transactionCount]));
                async function explain(
                    query: Pick<Knex.Sql, 'sql' | 'bindings'>
                ) {
                    const result = await tx.raw(
                        'explain (analyze, buffers, format json) ' + query.sql,
                        [...(query.bindings ?? [])]
                    );
                    const plan = result.rows[0]['QUERY PLAN'][0];
                    return {
                        rows: plan.Plan['Actual Rows'],
                        ms: plan['Execution Time']
                    };
                }
                const report = {
                    baselinePage: await explain(baselinePage),
                    typedPage: await explain(page),
                    baselineTags: await explain(oldTags.toSQL()),
                    typedTags: await explain(tags.toKnexQuery().toSQL())
                };
                expect(report.typedPage.rows).toBe(report.baselinePage.rows);
                expect(report.typedTags.rows).toBe(report.baselineTags.rows);
                // Diagnostic evidence, not a flaky wall-clock assertion or production speed claim.
                process.stdout.write(
                    `Query plan comparison (10k transactions, 100 tags): ${JSON.stringify(report)}\n`
                );
                throw rollback;
            })
        ).rejects.toBe(rollback);
    }, 30_000);
});
