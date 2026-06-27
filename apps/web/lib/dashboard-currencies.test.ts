import { describe, expect, it } from 'vitest';
import {
    dashboardCurrencyOptions,
    selectedDashboardCurrency
} from './dashboard-currencies';

describe('dashboard currencies', () => {
    it('selects only the default currency or favorites', () => {
        expect(selectedDashboardCurrency('eur', 'USD', ['EUR', 'GBP'])).toBe(
            'EUR'
        );
        expect(selectedDashboardCurrency('JPY', 'USD', ['EUR', 'GBP'])).toBe(
            'USD'
        );
    });

    it('builds options from default currency and favorites', () => {
        expect(
            dashboardCurrencyOptions(
                [
                    { code: 'USD', name: 'US dollar' },
                    { code: 'EUR', name: 'Euro' }
                ],
                'USD',
                ['EUR']
            )
        ).toEqual([
            { code: 'USD', name: 'US dollar' },
            { code: 'EUR', name: 'Euro' }
        ]);
    });
});
