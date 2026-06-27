/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { Currency } from '@xpenser/contracts';
import { describe, expect, it, vi } from 'vitest';
import { DashboardViewSettingsMenu } from './dashboard-view-settings-menu';

const currencies = [
    { code: 'USD', name: 'United States Dollar' },
    { code: 'EUR', name: 'Euro' }
] as Currency[];

describe('DashboardViewSettingsMenu', () => {
    it('shows expand all at the top level and currencies in a submenu', () => {
        const onToggle = vi.fn();
        render(
            <DashboardViewSettingsMenu
                basePath="/dashboard"
                currencies={currencies}
                currentDate="2026-05-01"
                defaultCurrency="USD"
                expansionAction={{
                    allExpanded: false,
                    onToggle
                }}
                favoriteCurrencies={['EUR']}
                period="month"
                selectedCurrency="USD"
                timezone="UTC"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'View settings' }));

        expect(
            screen.getByRole('menuitem', { name: 'Expand all' })
        ).toBeTruthy();
        expect(screen.queryByRole('menuitemradio', { name: /USD/ })).toBeNull();

        fireEvent.click(
            screen.getByRole('menuitem', { name: /Display currency/ })
        );

        expect(screen.getByRole('menuitemradio', { name: /USD/ })).toBeTruthy();
        expect(screen.getByRole('menuitemradio', { name: /EUR/ })).toBeTruthy();

        fireEvent.click(screen.getByRole('menuitem', { name: 'Expand all' }));

        expect(onToggle).toHaveBeenCalledTimes(1);
    });
});
