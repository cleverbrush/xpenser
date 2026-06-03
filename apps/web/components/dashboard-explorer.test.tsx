/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type { DashboardSummary } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import { DashboardMerchantPanel } from './dashboard-merchant-panel';

type DashboardMerchant = DashboardSummary['topMerchants'][number];

function merchant(
    id: number,
    overrides: Partial<DashboardMerchant> = {}
): DashboardMerchant {
    return {
        merchantId: id,
        merchantName: `Merchant ${id}`,
        merchantDomain: `merchant-${id}.example`,
        merchantLogoUrl: `https://merchant-${id}.example/logo.svg`,
        merchantPrimaryColor: '#3366cc',
        expenseTotal: id * 10,
        transactionCount: id,
        ...overrides
    };
}

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
    return {
        byCategory: [],
        byParentCategory: [],
        currency: 'USD',
        expenseTotal: 400,
        from: new Date('2026-05-01T00:00:00.000Z'),
        incomeTotal: 800,
        merchantCount: 0,
        period: 'month',
        to: new Date('2026-05-31T23:59:59.999Z'),
        topMerchants: [],
        ...overrides
    };
}

describe('DashboardMerchantPanel', () => {
    it('renders ranked merchant rows and overflow links for the selected period', () => {
        const merchants = Array.from({ length: 24 }, (_, index) =>
            merchant(index + 1)
        );
        render(
            <DashboardMerchantPanel
                summary={summary({
                    merchantCount: 30,
                    topMerchants: merchants
                })}
                timezone="UTC"
            />
        );

        expect(screen.getByText('Merchants')).toBeTruthy();
        expect(screen.getByText('30 brands in this period')).toBeTruthy();
        expect(screen.getByText('Merchant 1')).toBeTruthy();
        expect(screen.getByText(/merchant-1\.example/)).toBeTruthy();
        expect(screen.getByText(/1 purchase/)).toBeTruthy();
        expect(screen.getByText('Merchant 8')).toBeTruthy();
        expect(screen.queryByText('Merchant 9')).toBeNull();

        const merchantLink = screen
            .getAllByRole('link')
            .find(link => link.getAttribute('href')?.includes('merchantId=1'));
        if (!merchantLink) {
            throw new Error('Merchant 1 link was not rendered.');
        }
        expect(merchantLink.getAttribute('href')).toContain('/transactions?');
        expect(merchantLink.getAttribute('href')).toContain('type=expense');
        expect(merchantLink.getAttribute('href')).toContain('merchantId=1');
        expect(merchantLink.getAttribute('href')).toContain('from=2026-05-01');
        expect(merchantLink.getAttribute('href')).toContain('to=2026-05-31');

        expect(
            screen.getByRole('link', { name: /merchant 9 transactions/i })
        ).toBeTruthy();
        expect(screen.getByRole('link', { name: 'View all' })).toBeTruthy();
        expect(screen.getByText('+6')).toBeTruthy();
    });

    it('hides itself when the selected period has no linked merchants', () => {
        const { container } = render(
            <DashboardMerchantPanel summary={summary()} timezone="UTC" />
        );

        expect(container.innerHTML).toBe('');
    });
});
