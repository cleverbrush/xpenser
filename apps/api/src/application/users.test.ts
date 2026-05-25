import { describe, expect, it } from 'vitest';
import {
    InvalidPassportIdentityError,
    PasswordMismatchError,
    transactionCurrenciesByRecentPopularity
} from './users.js';

describe('user domain errors', () => {
    it('uses a specific error for password mismatch', () => {
        expect(new PasswordMismatchError('x')).toBeInstanceOf(Error);
    });

    it('uses a specific error for invalid Passport identities', () => {
        expect(new InvalidPassportIdentityError('x')).toBeInstanceOf(Error);
    });
});

describe('transaction currency ordering', () => {
    it('sorts configured currencies by recent transaction popularity', () => {
        expect(
            transactionCurrenciesByRecentPopularity(
                ['USD', 'EUR', 'GBP'],
                [{ currency: 'EUR' }, { currency: 'GBP' }, { currency: 'EUR' }]
            )
        ).toEqual(['EUR', 'GBP', 'USD']);
    });

    it('breaks popularity ties by the currency used latest', () => {
        expect(
            transactionCurrenciesByRecentPopularity(
                ['USD', 'EUR', 'GBP'],
                [
                    { currency: 'GBP' },
                    { currency: 'EUR' },
                    { currency: 'EUR' },
                    { currency: 'GBP' }
                ]
            )
        ).toEqual(['GBP', 'EUR', 'USD']);
    });

    it('includes recent currencies outside primary and favorites', () => {
        expect(
            transactionCurrenciesByRecentPopularity(
                ['USD', 'EUR'],
                [{ currency: 'UAH' }, { currency: 'USD' }, { currency: 'UAH' }]
            )
        ).toEqual(['UAH', 'USD', 'EUR']);
    });

    it('falls back to original configured order without recent transactions', () => {
        expect(
            transactionCurrenciesByRecentPopularity(['USD', 'EUR'], [])
        ).toEqual(['USD', 'EUR']);
    });
});
