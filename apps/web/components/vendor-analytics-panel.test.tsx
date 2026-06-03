/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type { DashboardSummary } from '@xpenser/contracts';
import { describe, expect, it } from 'vitest';
import { VendorAnalyticsPanel } from './vendor-analytics-panel';

type DashboardVendor = DashboardSummary['topVendors'][number];

function vendor(
    id: number,
    overrides: Partial<DashboardVendor> = {}
): DashboardVendor {
    return {
        vendorId: id,
        vendorName: `Vendor ${id}`,
        vendorDomain: `vendor-${id}.example`,
        vendorLogoUrl: `https://vendor-${id}.example/logo.svg`,
        vendorPrimaryColor: '#3366cc',
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
        vendorCount: 0,
        period: 'month',
        to: new Date('2026-05-31T23:59:59.999Z'),
        topVendors: [],
        ...overrides
    };
}

describe('VendorAnalyticsPanel', () => {
    it('renders vendor rows with charts and transaction links', () => {
        const vendors = [vendor(1), vendor(2)];
        const { container } = render(
            <VendorAnalyticsPanel
                summary={summary({
                    vendorCount: 2,
                    topVendors: vendors
                })}
                timezone="UTC"
            />
        );

        expect(screen.getByText('Vendors')).toBeTruthy();
        expect(screen.getByText('2 vendors in this period')).toBeTruthy();
        expect(
            screen.getByLabelText('Vendor grouping info').getAttribute('title')
        ).toContain('Only expenses linked to a vendor');
        expect(screen.getByText('Vendor 1')).toBeTruthy();
        expect(screen.getByText(/vendor-1\.example/)).toBeTruthy();
        expect(screen.getByText(/1 purchase/)).toBeTruthy();
        expect(screen.getByText('2.5%')).toBeTruthy();
        expect(screen.getAllByText('{l:50,100}').length).toBeGreaterThan(0);
        expect(
            container.querySelector(
                'img[src="https://vendor-1.example/logo.svg"]'
            )
        ).toBeTruthy();

        const vendorLink = screen
            .getAllByRole('link')
            .find(link => link.getAttribute('href')?.includes('vendorId=1'));
        if (!vendorLink) {
            throw new Error('Vendor 1 link was not rendered.');
        }
        expect(vendorLink.getAttribute('href')).toContain('/transactions?');
        expect(vendorLink.getAttribute('href')).toContain('type=expense');
        expect(vendorLink.getAttribute('href')).toContain('vendorId=1');
        expect(vendorLink.getAttribute('href')).toContain('from=2026-05-01');
        expect(vendorLink.getAttribute('href')).toContain('to=2026-05-31');
    });

    it('renders an empty state when the selected period has no linked vendors', () => {
        render(<VendorAnalyticsPanel summary={summary()} timezone="UTC" />);

        expect(screen.getByText('0 vendors in this period')).toBeTruthy();
        expect(screen.getByText('No vendors in this period.')).toBeTruthy();
    });
});
