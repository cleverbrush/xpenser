import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as documents from '../src/db/migrations/021_scan_item_jsonb.js';
import { scanReads } from '../src/jobs/scan-reads.js';
import { postgresFixture, seedBudgetOwners } from './postgres-fixture.js';
import {
    draft,
    occurredAt,
    seedTransactionScan
} from './transaction-scan-fixtures.js';

const { db, knex } = postgresFixture('scan_item_jsonb');
beforeAll(async () => {
    await seedBudgetOwners(knex);
    await seedTransactionScan(db);
});
beforeEach(async () => {
    // Each migration case owns its document, independently of other feature tests.
    await knex('transaction_scan_items').delete();
    const document = {
        ...draft,
        confidence: { ...draft.confidence, extra: { flags: [true, null] } },
        extension: { values: [1, 'two', null] }
    };
    const correction = {
        amount: 13,
        categoryId: 1,
        currency: 'USD',
        occurredAt,
        vendorId: null,
        note: null,
        extra: { note: 'kept' }
    };
    await db.transactionScanItems.insert({
        budgetId: 1,
        userId: 1,
        scanId: 1,
        draft: document,
        correctedTransaction: correction
    });
});

describe('scan item JSONB migration', () => {
    it('migrates text documents up/down without losing extension data or SQL null', async () => {
        await documents.down(knex);
        const stored = await knex('transaction_scan_items').first();
        expect(typeof stored.draft_json).toBe('string');
        expect(typeof stored.corrected_json).toBe('string');
        expect(JSON.parse(stored.corrected_json)).toMatchObject({
            extra: { note: 'kept' }
        });
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
