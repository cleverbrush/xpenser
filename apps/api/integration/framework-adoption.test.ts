import { createHash, randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { createDb } from '@cleverbrush/orm';
import type { Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    authenticateApiKey,
    createApiKey,
    revokeApiKey
} from '../src/application/api-keys.js';
import { budgetAccessReads } from '../src/application/budget-access-reads.js';
import { budgetMembersRead } from '../src/application/budget-queries.js';
import {
    BudgetAccessError,
    resolveBudgetAccess
} from '../src/application/budgets.js';
import { uploadTransactionScanImage } from '../src/application/transaction-scans.js';
import * as documents from '../src/db/migrations/021_scan_item_jsonb.js';
import { createPostgresConnection } from '../src/db/postgres.js';
import { entityMap, type TransactionScanItemDb } from '../src/db/schemas.js';
import { scanReads } from '../src/jobs/scan-reads.js';
import { loadScanResult } from '../src/jobs/scan-results.js';

const connection = process.env.QUERY_TEST_DATABASE_URL;
if (!connection || new URL(connection).pathname !== '/xpenser_queries')
    throw new Error('Use a dedicated xpenser_queries database');
const schema = 'adoption_' + randomUUID().replaceAll('-', '');
const knex = createPostgresConnection({
    connection,
    searchPath: [schema],
    pool: { min: 0, max: 4 }
});
const db = createDb(knex, entityMap);
let created = false;
const occurredAt = new Date('2026-06-01T12:34:56.789Z');
const draft: TransactionScanItemDb['draft'] = {
    amount: 12.34,
    categoryId: null,
    suggestedCategory: null,
    currency: 'USD',
    occurredAt,
    vendorId: null,
    suggestedVendorName: null,
    transactionType: 'expense',
    note: null,
    evidence: 'Receipt',
    confidence: {
        amount: 'high',
        category: 'high',
        currency: 'high',
        date: 'high',
        overall: 'high',
        vendor: 'high'
    },
    possibleDuplicateTransactionIds: []
};
const attachment = {
    imageBase64: Buffer.from('receipt').toString('base64'),
    mimeType: 'image/png' as const,
    fileName: 'receipt.png'
};

beforeAll(async () => {
    await knex.schema.createSchema(schema);
    created = true;
    const directory = new URL('../src/db/migrations/', import.meta.url);
    for (const file of readdirSync(directory)
        .filter(file => file.endsWith('.ts'))
        .sort())
        await (await import(new URL(file, directory).href)).up(knex);
    await knex('users').insert([
        { id: 1, email: 'one@example.test' },
        { id: 2, email: 'two@example.test' }
    ]);
    await knex('budgets').insert([
        { id: 1, name: 'One', default_currency: 'USD', created_by_user_id: 1 },
        { id: 2, name: 'Two', default_currency: 'USD', created_by_user_id: 2 }
    ]);
    await knex('budget_members').insert([
        { budget_id: 1, user_id: 1, display_name: 'One', role: 'admin' },
        { budget_id: 2, user_id: 2, display_name: 'Two', role: 'admin' }
    ]);
    await db.transactionScans.insert({
        id: 1,
        userId: 1,
        budgetId: 1,
        documentKind: 'receipt',
        imageHash: createHash('sha256').update('receipt').digest('hex'),
        model: 'test',
        warningsJson: '[]'
    });
});
afterAll(async () => {
    if (created) await knex.schema.dropSchema(schema, true);
    await knex.destroy();
});

describe('compiled queries and document storage on PostgreSQL', () => {
    it('reuses templates but isolates concurrent budget/user bindings', async () => {
        expect(budgetAccessReads(knex)).toBe(budgetAccessReads(knex));
        const reads = budgetAccessReads(knex);
        expect(reads.member.toSQL(1, 1).bindings).toEqual([1, 1, 1]);
        expect(reads.member.toSQL(2, 2).bindings).toEqual([2, 2, 1]);
        const rows = await Promise.all([
            reads.member(1, 1),
            reads.member(2, 2),
            reads.member(1, 2)
        ]);
        expect(rows.map(items => items.map(row => row.userId))).toEqual([
            [1],
            [2],
            []
        ]);
        expect(
            (await budgetMembersRead(knex)(1)).map(row => row.userId)
        ).toEqual([1]);
        expect(scanReads(knex).request.toSQL('run').sql).not.toContain(
            'image_base64'
        );
    });

    it('observes revoked access and respects transaction-local writes and rollback', async () => {
        await resolveBudgetAccess(db, 1, 1);
        const rollback = new Error('rollback test');
        await expect(
            db.transaction(async transaction => {
                await transaction.budgetMembers
                    .where(row => row.budgetId, 1)
                    .where(row => row.userId, 1)
                    .delete();
                await expect(
                    resolveBudgetAccess(transaction, 1, 1)
                ).rejects.toBeInstanceOf(BudgetAccessError);
                // A derivative of the already-compiled template uses the same transaction.
                expect(
                    await budgetAccessReads(knex).member.transacting(
                        transaction.knex as Knex.Transaction
                    )(1, 1)
                ).toEqual([]);
                throw rollback;
            })
        ).rejects.toBe(rollback);
        expect((await resolveBudgetAccess(db, 1, 1)).member.userId).toBe(1);
        await expect(resolveBudgetAccess(db, 1, 2)).rejects.toBeInstanceOf(
            BudgetAccessError
        );
    });

    it('does not cache authentication results after revocation', async () => {
        const key = await createApiKey(db, 1, { name: 'Compiled auth' });
        expect((await authenticateApiKey(db, key.key))?.userId).toBe(1);
        await revokeApiKey(db, 1, key.apiKey.id);
        expect(await authenticateApiKey(db, key.key)).toBeUndefined();
    });

    it('round-trips JSONB dates, null corrections, and nested extension data through compiled results', async () => {
        const document = {
            ...draft,
            confidence: { ...draft.confidence, extra: { flags: [true, null] } },
            suggestedCategory: {
                name: 'Food',
                type: 'expense' as const,
                parentId: null,
                kind: 'normal' as const,
                reason: 'Receipt',
                extra: { score: 3 }
            },
            extension: { values: [1, 'two', null] }
        };
        const item = await db.transactionScanItems.insert({
            budgetId: 1,
            userId: 1,
            scanId: 1,
            draft: document,
            correctedTransaction: null
        });
        const [row] = await scanReads(knex).items(1, 1);
        if (!row) throw new Error('Expected stored draft');
        expect(row.draft).toMatchObject(document);
        expect(row.draft.occurredAt).toBeInstanceOf(Date);
        expect(row.correctedTransaction).toBeNull();
        const correction = {
            amount: 13,
            categoryId: 1,
            currency: 'USD',
            occurredAt,
            vendorId: null,
            note: null,
            extra: { note: 'kept' }
        };
        await db.transactionScanItems
            .where(row => row.id, item.id)
            .update({ correctedTransaction: correction });
        expect(
            (await scanReads(knex).items(1, 1))[0]?.correctedTransaction
        ).toMatchObject(correction);
        expect((await loadScanResult(db, 1, 1)).drafts[0]?.occurredAt).toEqual(
            occurredAt
        );
        await expect(loadScanResult(db, 1, 2)).rejects.toThrow('unavailable');
        expect(await scanReads(knex).items(1, 2)).toEqual([]);
    });

    it('atomically upserts concurrent image retries and rejects mismatches or other budgets', async () => {
        await Promise.all(
            Array.from({ length: 6 }, () =>
                uploadTransactionScanImage(db, 1, 1, attachment)
            )
        );
        expect(await db.transactionScanImages.countValue()).toBe(1);
        expect((await db.transactionScanImages.first())?.imageBase64).toBe(
            attachment.imageBase64
        );
        await expect(
            uploadTransactionScanImage(db, 1, 1, {
                ...attachment,
                imageBase64: Buffer.from('wrong').toString('base64')
            })
        ).rejects.toThrow('did not match');
        await expect(
            uploadTransactionScanImage(db, 2, 1, attachment)
        ).rejects.toBeInstanceOf(BudgetAccessError);
        expect(await db.transactions.countValue()).toBe(0);
    });

    it('migrates text documents up/down without losing extension data or SQL null', async () => {
        await documents.down(knex);
        const stored = await knex('transaction_scan_items').first();
        expect(typeof stored.draft_json).toBe('string');
        const document = JSON.parse(stored.draft_json);
        await knex('transaction_scan_items').update({ corrected_json: null });
        await documents.up(knex);
        const converted = await knex('transaction_scan_items').first();
        expect(converted.draft_json).toEqual(document);
        expect(converted.corrected_json).toBeNull();
        expect(
            (await scanReads(knex).items(1, 1))[0]?.draft.occurredAt
        ).toEqual(occurredAt);
    });

    it.each([
        '[]',
        'null',
        '"text"',
        '{broken'
    ])('rejects invalid legacy document %s without destructive conversion', async invalid => {
        await documents.down(knex);
        const original = await knex('transaction_scan_items').first();
        try {
            await knex('transaction_scan_items').update({
                draft_json: invalid
            });
            await expect(documents.up(knex)).rejects.toThrow();
            expect(
                (await knex('transaction_scan_items').first()).draft_json
            ).toBe(invalid);
        } finally {
            await knex('transaction_scan_items').update({
                draft_json: original.draft_json
            });
            await documents.up(knex);
        }
    });
});
