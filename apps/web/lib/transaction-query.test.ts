import { describe, expect, it } from 'vitest';
import {
    buildTransactionListQuery,
    hasTransactionFilters,
    transactionHasMore,
    transactionPageSize
} from './transaction-query';

describe('transaction query helpers', () => {
    it('builds a sanitized transaction list query from URL params', () => {
        const query = buildTransactionListQuery(
            new URLSearchParams([
                ['categoryId', '12'],
                ['direction', 'asc'],
                ['from', '2026-05-01'],
                ['limit', '40'],
                ['page', '3'],
                ['search', ' coffee '],
                ['tagId', '2'],
                ['tagId', '5'],
                ['to', '2026-05-10'],
                ['type', 'expense'],
                ['vendorId', 'none']
            ])
        );

        expect(query).toMatchObject({
            categoryId: 12,
            direction: 'asc',
            limit: 40,
            page: 3,
            search: 'coffee',
            tagIds: '2,5',
            type: 'expense',
            vendorId: 'none'
        });
        expect(query.from).toEqual(new Date('2026-05-01T00:00:00.000Z'));
        expect(query.to).toEqual(new Date('2026-05-10T23:59:59.999Z'));
    });

    it('builds a sanitized transaction list query from plain params', () => {
        const query = buildTransactionListQuery({
            categoryId: '12',
            direction: 'asc',
            from: '2026-05-01',
            limit: '40',
            page: '3',
            search: ' coffee ',
            to: '2026-05-10',
            type: 'expense',
            vendorId: 'none',
            tagId: ['2', 'bad', '5']
        });

        expect(query).toMatchObject({
            categoryId: 12,
            direction: 'asc',
            limit: 40,
            page: 3,
            search: 'coffee',
            tagIds: '2,5',
            type: 'expense',
            vendorId: 'none'
        });
        expect(query.from).toEqual(new Date('2026-05-01T00:00:00.000Z'));
        expect(query.to).toEqual(new Date('2026-05-10T23:59:59.999Z'));
    });

    it('falls back for invalid pagination and filter values', () => {
        const query = buildTransactionListQuery(
            new URLSearchParams({
                categoryId: '-1',
                direction: 'sideways',
                limit: '0',
                page: 'x',
                type: 'transfer',
                vendorId: '0'
            })
        );

        expect(query).toMatchObject({
            categoryId: undefined,
            direction: 'desc',
            limit: transactionPageSize,
            page: 1,
            type: undefined,
            vendorId: undefined
        });
    });

    it('builds date filter boundaries in the user timezone', () => {
        const query = buildTransactionListQuery(
            new URLSearchParams({
                from: '2026-05-10',
                to: '2026-05-10'
            }),
            {},
            'America/Los_Angeles'
        );

        expect(query.from).toEqual(new Date('2026-05-10T07:00:00.000Z'));
        expect(query.to).toEqual(new Date('2026-05-11T06:59:59.999Z'));
    });

    it('detects filters and pagination end state', () => {
        expect(
            hasTransactionFilters(new URLSearchParams({ search: 'rent' }))
        ).toBe(true);
        expect(hasTransactionFilters(new URLSearchParams({ tagId: '2' }))).toBe(
            true
        );
        expect(hasTransactionFilters(new URLSearchParams({ page: '2' }))).toBe(
            false
        );
        expect(transactionHasMore({ total: 61, page: 2, limit: 30 })).toBe(
            true
        );
        expect(transactionHasMore({ total: 60, page: 2, limit: 30 })).toBe(
            false
        );
    });
});
