import { FieldLimits, TransactionTagLimits } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import {
    normalizeTransactionTagAssignments,
    normalizeTransactionTagName,
    TransactionTagError
} from './transaction-tags.js';

describe('transaction tags', () => {
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
});
