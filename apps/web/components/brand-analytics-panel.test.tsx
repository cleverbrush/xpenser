/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type { DashboardSummary } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import { BrandAnalyticsPanel } from './brand-analytics-panel';

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
        trend: [id * 5, id * 10],
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

describe('BrandAnalyticsPanel', () => {
    it('renders brand rows with charts and transaction links', () => {
        const merchants = [merchant(1), merchant(2)];
        const { container } = render(
            <BrandAnalyticsPanel
                summary={summary({
                    merchantCount: 2,
                    topMerchants: merchants
                })}
                timezone="UTC"
            />
        );

        expect(screen.getByText('Brands')).toBeTruthy();
        expect(screen.getByText('2 brands in this period')).toBeTruthy();
        expect(
            screen.getByLabelText('Brand grouping info').getAttribute('title')
        ).toContain('Only expenses linked to a merchant');
        expect(screen.getByText('Merchant 1')).toBeTruthy();
        expect(screen.getByText(/merchant-1\.example/)).toBeTruthy();
        expect(screen.getByText(/1 purchase/)).toBeTruthy();
        expect(screen.getByText('2.5%')).toBeTruthy();
        expect(screen.getAllByText('{l:50,100}').length).toBeGreaterThan(0);
        expect(
            container.querySelector(
                'img[src="https://merchant-1.example/logo.svg"]'
            )
        ).toBeTruthy();

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
    });

    it('renders an empty state when the selected period has no linked brands', () => {
        render(<BrandAnalyticsPanel summary={summary()} timezone="UTC" />);

        expect(screen.getByText('0 brands in this period')).toBeTruthy();
        expect(screen.getByText('No brands in this period.')).toBeTruthy();
    });
});
