/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { Currency } from '@xpenser/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { AmountPrivacyProvider } from './amount-privacy';
import { DashboardViewSettingsMenu } from './dashboard-view-settings-menu';

const currencies = [
    { code: 'USD', name: 'United States Dollar' },
    { code: 'EUR', name: 'Euro' }
] as Currency[];

describe('DashboardViewSettingsMenu', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('keeps currencies in a submenu without expansion controls', () => {
        render(
            <DashboardViewSettingsMenu
                basePath="/dashboard"
                currencies={currencies}
                currentDate="2026-05-01"
                defaultCurrency="USD"
                favoriteCurrencies={['EUR']}
                period="month"
                selectedCurrency="USD"
                timezone="UTC"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'View settings' }));

        expect(screen.queryByRole('menuitem', { name: 'Expand all' })).toBe(
            null
        );
        expect(screen.queryByRole('menuitem', { name: 'Collapse all' })).toBe(
            null
        );
        expect(screen.queryByRole('menuitemradio', { name: /USD/ })).toBeNull();

        fireEvent.click(
            screen.getByRole('menuitem', { name: /Display currency/ })
        );

        expect(screen.getByRole('menuitemradio', { name: /USD/ })).toBeTruthy();
        expect(screen.getByRole('menuitemradio', { name: /EUR/ })).toBeTruthy();
    });

    it('requires at least one selected currency before exporting', () => {
        render(
            <DashboardViewSettingsMenu
                basePath="/dashboard"
                currencies={currencies}
                currentDate="2026-05-01"
                defaultCurrency="USD"
                exportAction={{
                    href: '/app-api/transactions/export.csv?from=2026-05-01&to=2026-05-31'
                }}
                favoriteCurrencies={['EUR']}
                period="month"
                selectedCurrency="USD"
                timezone="UTC"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'View settings' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Export CSV' }));

        const usd = screen.getByLabelText(/USD/) as HTMLInputElement;
        const eur = screen.getByLabelText(/EUR/) as HTMLInputElement;
        expect(usd.checked).toBe(true);
        expect(eur.checked).toBe(false);
        expect(
            (
                screen.getByRole('button', {
                    name: /Export/
                }) as HTMLButtonElement
            ).disabled
        ).toBe(false);

        fireEvent.click(usd);

        expect(usd.checked).toBe(false);
        expect(
            (
                screen.getByRole('button', {
                    name: /Export/
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
    });

    it('toggles the hide amounts menu state', () => {
        render(
            <AmountPrivacyProvider>
                <DashboardViewSettingsMenu
                    basePath="/dashboard"
                    currencies={currencies}
                    currentDate="2026-05-01"
                    defaultCurrency="USD"
                    favoriteCurrencies={['EUR']}
                    period="month"
                    selectedCurrency="USD"
                    timezone="UTC"
                />
            </AmountPrivacyProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'View settings' }));
        fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Hide/ }));
        fireEvent.click(screen.getByRole('button', { name: 'View settings' }));

        expect(
            screen.getByRole('menuitemcheckbox', { name: /Show amounts/ })
        ).toBeTruthy();
        expect(localStorage.getItem('xpenser:hide-amounts')).toBe('true');
    });
});
