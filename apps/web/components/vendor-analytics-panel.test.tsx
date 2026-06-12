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
        type: 'expense',
        total: id * 10,
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

function renderedVendorNames(names: readonly string[]): string[] {
    return screen.getAllByRole('link').flatMap(link => {
        const text = link.textContent ?? '';
        const name = names.find(candidate => text.includes(candidate));
        return name ? [name] : [];
    });
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
        expect(screen.getByText('2 vendor groups in this period')).toBeTruthy();
        expect(
            screen.getByLabelText('Vendor grouping info').getAttribute('title')
        ).toContain('including transactions without a vendor');
        expect(screen.getAllByText('Expenses').length).toBeGreaterThan(0);
        expect(screen.getByText('Vendor 1')).toBeTruthy();
        expect(screen.getByText(/vendor-1\.example/)).toBeTruthy();
        expect(screen.getByText(/1 transaction/)).toBeTruthy();
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

    it('sorts vendor rows by displayed share within each group', () => {
        const names = [
            'Large Income',
            'Small Income',
            'Large Expense',
            'Small Expense'
        ];
        render(
            <VendorAnalyticsPanel
                summary={summary({
                    expenseTotal: 400,
                    incomeTotal: 1000,
                    vendorCount: 4,
                    topVendors: [
                        vendor(1, {
                            vendorName: 'Small Expense',
                            total: 40,
                            transactionCount: 5
                        }),
                        vendor(2, {
                            vendorName: 'Large Expense',
                            total: 200,
                            transactionCount: 1
                        }),
                        vendor(3, {
                            vendorName: 'Small Income',
                            type: 'income',
                            total: 250,
                            transactionCount: 5
                        }),
                        vendor(4, {
                            vendorName: 'Large Income',
                            type: 'income',
                            total: 500,
                            transactionCount: 1
                        })
                    ]
                })}
                timezone="UTC"
            />
        );

        expect(renderedVendorNames(names)).toEqual(names);
    });

    it('renders no vendor income and expense groups', () => {
        render(
            <VendorAnalyticsPanel
                summary={summary({
                    expenseTotal: 100,
                    incomeTotal: 200,
                    vendorCount: 2,
                    topVendors: [
                        vendor(1, {
                            vendorId: null,
                            vendorName: 'No vendor',
                            vendorDomain: undefined,
                            vendorLogoUrl: undefined,
                            vendorPrimaryColor: undefined,
                            type: 'income',
                            total: 200,
                            transactionCount: 1,
                            trend: [0, 200]
                        }),
                        vendor(2, {
                            vendorId: null,
                            vendorName: 'No vendor',
                            vendorDomain: undefined,
                            vendorLogoUrl: undefined,
                            vendorPrimaryColor: undefined,
                            type: 'expense',
                            total: 100,
                            transactionCount: 1,
                            trend: [0, 100]
                        })
                    ]
                })}
                timezone="UTC"
            />
        );

        expect(screen.getAllByText('Income').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Expenses').length).toBeGreaterThan(0);
        const links = screen
            .getAllByRole('link')
            .filter(link =>
                link.getAttribute('href')?.includes('vendorId=none')
            );
        expect(links).toHaveLength(6);
        expect(
            links.some(link =>
                link.getAttribute('href')?.includes('type=income')
            )
        ).toBe(true);
        expect(
            links.some(link =>
                link.getAttribute('href')?.includes('type=expense')
            )
        ).toBe(true);
    });

    it('renders an empty state when the selected period has no vendor groups', () => {
        render(<VendorAnalyticsPanel summary={summary()} timezone="UTC" />);

        expect(screen.getByText('0 vendor groups in this period')).toBeTruthy();
        expect(
            screen.getByText('No vendor groups in this period.')
        ).toBeTruthy();
    });
});
