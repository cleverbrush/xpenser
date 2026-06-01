/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Currency, UserPreference } from '@xpenser/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferencesForm } from './preferences-form';

const updatePreferencesAction = vi.fn();

vi.mock('@/lib/actions', () => ({
    updatePreferencesAction: (formData: FormData) =>
        updatePreferencesAction(formData)
}));

const currencies: Currency[] = [
    { code: 'USD', name: 'US dollar' },
    { code: 'EUR', name: 'Euro' }
];

const me: UserPreference = {
    id: 1,
    email: 'jane@example.com',
    defaultCurrency: 'USD',
    favoriteCurrencies: ['EUR'],
    transactionCurrencies: ['USD', 'EUR'],
    timezone: 'UTC',
    hasCategories: true,
    weeklyEmailReportEnabled: true,
    monthlyEmailReportEnabled: true
};

describe('PreferencesForm', () => {
    afterEach(() => {
        updatePreferencesAction.mockReset();
    });

    it('submits email report preferences', async () => {
        updatePreferencesAction.mockResolvedValue(undefined);

        render(<PreferencesForm currencies={currencies} me={me} />);

        fireEvent.click(
            screen.getByRole('checkbox', { name: /weekly report/i })
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Save preferences' })
        );

        await waitFor(() =>
            expect(updatePreferencesAction).toHaveBeenCalledOnce()
        );

        const formData = updatePreferencesAction.mock.calls.at(0)?.[0];
        expect(formData).toBeInstanceOf(FormData);
        expect(formData?.get('weeklyEmailReportEnabled')).toBe('false');
        expect(formData?.get('monthlyEmailReportEnabled')).toBe('true');
    });
});
