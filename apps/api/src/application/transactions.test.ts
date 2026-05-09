import { describe, expect, it } from 'vitest';
import {
    TransactionCategoryError,
    TransactionNotFoundError
} from './transactions.js';

describe('transaction domain errors', () => {
    it('has explicit errors for not-found and invalid category cases', () => {
        expect(new TransactionNotFoundError('missing')).toBeInstanceOf(Error);
        expect(new TransactionCategoryError('bad category')).toBeInstanceOf(
            Error
        );
    });
});
