/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { UserPreference } from '@xpenser/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferencesForm } from './preferences-form';
import { XpenserWebFormProvider } from './schema-fields';

const updatePreferencesAction = vi.fn();

vi.mock('@/lib/actions', () => ({
    updatePreferencesAction: (formData: FormData) =>
        updatePreferencesAction(formData)
}));

const me: UserPreference = {
    id: 1,
    email: 'jane@example.com',
    defaultCurrency: 'USD',
    countryCode: 'US',
    favoriteCurrencies: ['EUR'],
    transactionCurrencies: ['USD', 'EUR'],
    timezone: 'UTC',
    hasCategories: true,
    hasUploadedAvatar: false,
    mainBudgetId: 1,
    budgets: [
        {
            id: 1,
            name: 'Main',
            defaultCurrency: 'USD',
            favoriteCurrencies: ['EUR'],
            transactionCurrencies: ['USD', 'EUR'],
            countryCode: 'US',
            role: 'admin',
            permissions: {
                canCreateTransactions: true,
                canUpdateTransactions: true,
                canDeleteTransactions: true,
                canManageCategories: true,
                canManageVendors: true,
                canManageTags: true,
                canManageMembers: true
            },
            isMain: true,
            archivedAt: null,
            createdAt: new Date('2026-05-01T00:00:00.000Z'),
            updatedAt: new Date('2026-05-01T00:00:00.000Z')
        }
    ],
    weeklyEmailReportEnabled: true,
    monthlyEmailReportEnabled: true
};

describe('PreferencesForm', () => {
    afterEach(() => {
        updatePreferencesAction.mockReset();
    });

    it('submits email report preferences', async () => {
        updatePreferencesAction.mockResolvedValue(undefined);

        render(
            <XpenserWebFormProvider>
                <PreferencesForm me={me} />
            </XpenserWebFormProvider>
        );

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
