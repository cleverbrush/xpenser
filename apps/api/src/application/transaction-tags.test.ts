import { FieldLimits, TransactionTagLimits } from '@xpenser/contracts';
import type { Knex } from 'knex';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getOrCreateTransactionTag,
    normalizeTransactionTagAssignments,
    normalizeTransactionTagName,
    TransactionTagError
} from './transaction-tags.js';

const ormMocks = vi.hoisted(() => ({
    query: vi.fn()
}));

vi.mock('@cleverbrush/orm', async importOriginal => ({
    ...(await importOriginal<typeof import('@cleverbrush/orm')>()),
    getTableName: vi.fn(() => 'transaction_tags'),
    query: ormMocks.query
}));

describe('transaction tags', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('normalizes, deduplicates, and preserves display casing', () => {
        expect(normalizeTransactionTagName('  my   wife  ')).toBe('my wife');
        expect(
            normalizeTransactionTagAssignments([
                ' wife ',
                'WIFE',
                'travel',
                '  travel  '
            ])
        ).toEqual([
            { name: 'wife', normalizedName: 'wife' },
            { name: 'travel', normalizedName: 'travel' }
        ]);
    });

    it('rejects blank, overlong, and excessive tag assignments', () => {
        expect(() => normalizeTransactionTagAssignments(['   '])).toThrow(
            TransactionTagError
        );
        expect(() =>
            normalizeTransactionTagAssignments([
                'x'.repeat(FieldLimits.transactionTagName + 1)
            ])
        ).toThrow('Tag name is too long.');
        expect(() =>
            normalizeTransactionTagAssignments(
                Array.from(
                    {
                        length: TransactionTagLimits.maxTagsPerTransaction + 1
                    },
                    (_, index) => `tag-${index}`
                )
            )
        ).toThrow(
            `Transactions can have at most ${TransactionTagLimits.maxTagsPerTransaction} tags.`
        );
    });

    it('gets or creates tags with a schema-aware upsert', async () => {
        const merge = vi.fn().mockResolvedValue({ id: 42 });
        const onConflict = vi.fn(() => ({ merge }));
        ormMocks.query.mockReturnValue({ onConflict });

        await expect(
            getOrCreateTransactionTag({} as Knex, 7, 1, {
                name: 'Travel',
                normalizedName: 'travel'
            })
        ).resolves.toBe(42);

        expect(onConflict).toHaveBeenCalledWith(
            expect.any(Function),
            expect.any(Function)
        );
        expect(merge).toHaveBeenCalledWith(
            {
                budgetId: 1,
                userId: 7,
                name: 'Travel',
                normalizedName: 'travel'
            },
            { name: expect.any(Function) }
        );

        const mergeCall = merge.mock.calls[0];
        expect(mergeCall).toBeDefined();

        const updateData = mergeCall?.[1] as {
            readonly name: (helpers: {
                readonly column: (selector: unknown) => string;
                readonly raw: (
                    sql: string,
                    bindings: readonly unknown[]
                ) => unknown;
            }) => unknown;
        };
        const rawResult = {};
        const helpers = {
            column: vi.fn(() => 'name'),
            raw: vi.fn(() => rawResult)
        };

        expect(updateData.name(helpers)).toBe(rawResult);
        expect(helpers.raw).toHaveBeenCalledWith('??.??', [
            'transaction_tags',
            'name'
        ]);
    });

    it('reports a failed tag upsert', async () => {
        const merge = vi.fn().mockResolvedValue(undefined);
        ormMocks.query.mockReturnValue({
            onConflict: vi.fn(() => ({ merge }))
        });

        await expect(
            getOrCreateTransactionTag({} as Knex, 7, 1, {
                name: 'Travel',
                normalizedName: 'travel'
            })
        ).rejects.toThrow(TransactionTagError);
    });
});
