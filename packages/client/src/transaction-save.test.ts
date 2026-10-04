import { describe, expect, it, vi } from 'vitest';
import { TransactionSaveAttempt } from './transaction-save.js';

const input = { budgetId: 1, categoryId: 2, amount: 12, currency: 'USD' };
describe('transaction save attempts', () => {
    it('retains the key and generated timestamp across uncertain retries', () => {
        const state = new TransactionSaveAttempt();
        vi.useFakeTimers();
        try {
            const first = state.prepare(input);
            vi.advanceTimersByTime(60000);
            expect(state.prepare({ ...input })).toEqual(first);
            expect(state.prepare({ ...input, amount: 13 }).headers).not.toEqual(
                first.headers
            );
        } finally {
            vi.useRealTimers();
        }
    });
    it('separates changed budgets and intentional identical saves', () => {
        const state = new TransactionSaveAttempt();
        const first = state.prepare(input);
        const second = state.prepare({ ...input, budgetId: 2 });
        expect(second.headers).not.toEqual(first.headers);
        state.reset();
        expect(state.prepare({ ...input, budgetId: 2 }).headers).not.toEqual(
            second.headers
        );
    });
    it('snapshots mutable dates and tags from the form', () => {
        const state = new TransactionSaveAttempt();
        const date = new Date('2026-10-01T12:00:00Z');
        const tags = ['food'];
        const first = state.prepare({ ...input, occurredAt: date, tags });
        date.setUTCFullYear(2030);
        tags.push('work');
        expect(first.body.occurredAt.toISOString()).toBe(
            '2026-10-01T12:00:00.000Z'
        );
        expect(first.body.tags).toEqual(['food']);
    });
});
