import type { Currency } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import {
    getCurrencyDisplay,
    sortCurrenciesForDisplay
} from './currency-display';

describe('currency display metadata', () => {
    it('derives country names and flags from ISO-style currency codes', () => {
        const display = getCurrencyDisplay({
            code: 'USD',
            name: 'United States Dollar'
        } as Currency);

        expect(display).toMatchObject({
            code: 'USD',
            flag: '🇺🇸',
            mapped: true,
            regionName: 'United States'
        });
    });

    it('uses explicit labels for regional currencies', () => {
        expect(
            getCurrencyDisplay({ code: 'EUR', name: 'Euro' } as Currency)
        ).toMatchObject({
            flag: '🇪🇺',
            mapped: true,
            regionName: 'European Union'
        });
        expect(
            getCurrencyDisplay({
                code: 'XOF',
                name: 'West African Cfa Franc'
            } as Currency)
        ).toMatchObject({
            mapped: true,
            regionName: 'West Africa'
        });
    });

    it('sorts mapped currencies before fallback labels by region name', () => {
        const sorted = sortCurrenciesForDisplay([
            { code: 'ZZZ', name: 'Unknown Currency' },
            { code: 'USD', name: 'United States Dollar' },
            { code: 'AUD', name: 'Australian Dollar' }
        ] as Currency[]);

        expect(sorted.map(currency => currency.code)).toEqual([
            'AUD',
            'USD',
            'ZZZ'
        ]);
    });
});
