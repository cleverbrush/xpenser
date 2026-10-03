import { beforeAll, describe, expect, it } from 'vitest';
import { BudgetAccessError } from '../src/application/budgets.js';
import { uploadTransactionScanImage } from '../src/application/transaction-scans.js';
import { scanReads } from '../src/jobs/scan-reads.js';
import { loadScanResult } from '../src/jobs/scan-results.js';
import { postgresFixture, seedBudgetOwners } from './postgres-fixture.js';
import {
    attachment,
    draft,
    occurredAt,
    seedTransactionScan
} from './transaction-scan-fixtures.js';

const { db, knex } = postgresFixture('transaction_scans');
beforeAll(async () => {
    await seedBudgetOwners(knex);
    await seedTransactionScan(db);
});

describe('transaction scan persistence on PostgreSQL', () => {
    it('omits image bytes from the progress authorization read', () => {
        expect(scanReads(knex).request.toSQL('run').sql).not.toContain(
            'image_base64'
        );
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
});
