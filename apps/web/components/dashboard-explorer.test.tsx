/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { DashboardSummary } from '@xpenser/contracts';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DashboardPeriodPanel } from './dashboard-explorer';

vi.mock('@/components/add-transaction-dialog', () => ({
    AddTransactionDialog: () => null
}));

type DashboardCategory = DashboardSummary['byCategory'][number];
type DashboardCategoryVendor =
    DashboardSummary['categoryVendorBreakdown'][number];

function category(
    id: number,
    name: string,
    overrides: Partial<DashboardCategory> = {}
): DashboardCategory {
    return {
        categoryId: id,
        categoryName: name,
        categoryDisplayName: name,
        categoryParentId: null,
        categoryKind: 'normal',
        percentChange: 0,
        previousPeriodTotal: 0,
        total: 100,
        transactionCount: 2,
        trend: [100],
        type: 'expense',
        ...overrides
    };
}

function categoryVendor(
    categoryRow: DashboardCategory,
    vendorId: number,
    vendorName: string,
    total: number
): DashboardCategoryVendor {
    return {
        categoryId: categoryRow.categoryId,
        categoryName: categoryRow.categoryName,
        categoryDisplayName: categoryRow.categoryDisplayName,
        categoryParentId: categoryRow.categoryParentId,
        categoryParentName: categoryRow.categoryParentName,
        categoryKind: categoryRow.categoryKind,
        vendorId,
        vendorName,
        vendorDomain: `${vendorName.toLowerCase().replaceAll(' ', '-')}.example`,
        vendorLogoUrl: undefined,
        vendorPrimaryColor: undefined,
        type: categoryRow.type,
        total,
        transactionCount: 1,
        trend: [total]
    };
}

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
    return {
        byCategory: [],
        byParentCategory: [],
        categoryVendorBreakdown: [],
        comparison: {
            previousPeriod: {
                from: new Date('2026-04-01T00:00:00.000Z'),
                to: new Date('2026-04-30T23:59:59.999Z'),
                expenseTotal: 80,
                incomeTotal: 0,
                netTotal: -80
            }
        },
        currency: 'USD',
        expenseTotal: 100,
        from: new Date('2026-05-01T00:00:00.000Z'),
        incomeTotal: 0,
        period: 'month',
        to: new Date('2026-05-31T23:59:59.999Z'),
        topVendors: [],
        vendorCount: 0,
        ...overrides
    };
}

describe('DashboardPeriodPanel', () => {
    it('renders controlled expanded category and vendor rows', () => {
        const food = category(1, 'Food');
        const coffee = category(2, 'Coffee', {
            categoryDisplayName: 'Food -> Coffee',
            categoryParentId: food.categoryId,
            categoryParentName: food.categoryName
        });
        const dashboardSummary = summary({
            byCategory: [coffee],
            byParentCategory: [food],
            categoryVendorBreakdown: [
                categoryVendor(coffee, 1, 'Alpha Shop', 30),
                categoryVendor(coffee, 2, 'Beta Market', 70)
            ]
        });

        function ControlledPanel() {
            const [expandedRows, setExpandedRows] = useState<
                ReadonlySet<string>
            >(new Set());
            const expansionKeys = [
                'category:expense:1',
                'category-vendors:expense:2'
            ];
            const allExpanded = expansionKeys.every(key =>
                expandedRows.has(key)
            );

            return (
                <DashboardPeriodPanel
                    expansionAction={{
                        allExpanded,
                        onToggle: () =>
                            setExpandedRows(
                                allExpanded
                                    ? new Set<string>()
                                    : new Set(expansionKeys)
                            )
                    }}
                    expandedRows={expandedRows}
                    onToggleExpansion={key => {
                        setExpandedRows(current => {
                            const next = new Set(current);
                            if (next.has(key)) {
                                next.delete(key);
                            } else {
                                next.add(key);
                            }
                            return next;
                        });
                    }}
                    summary={dashboardSummary}
                    timezone="UTC"
                />
            );
        }

        render(<ControlledPanel />);

        expect(screen.queryByText('Coffee')).toBeNull();
        expect(screen.queryByText('Beta Market')).toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Expand all categories' })
        );

        expect(screen.getByText('Coffee')).toBeTruthy();
        expect(screen.getByText('Beta Market')).toBeTruthy();

        fireEvent.click(
            screen.getByRole('button', { name: 'Collapse all categories' })
        );

        expect(screen.queryByText('Coffee')).toBeNull();
        expect(screen.queryByText('Beta Market')).toBeNull();
    });

    it('nests sorted vendor rows under leaf category rows', () => {
        const food = category(1, 'Food');
        const coffee = category(2, 'Coffee', {
            categoryDisplayName: 'Food -> Coffee',
            categoryParentId: food.categoryId,
            categoryParentName: food.categoryName
        });
        const { container } = render(
            <DashboardPeriodPanel
                summary={summary({
                    byCategory: [coffee],
                    byParentCategory: [food],
                    categoryVendorBreakdown: [
                        categoryVendor(coffee, 1, 'Alpha Shop', 30),
                        categoryVendor(coffee, 2, 'Beta Market', 70)
                    ]
                })}
                timezone="UTC"
            />
        );

        expect(screen.queryByText('Coffee')).toBeNull();
        expect(screen.queryByText('Beta Market')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Expand Food' }));

        expect(screen.getByText('Coffee')).toBeTruthy();
        expect(screen.queryByText('Beta Market')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Expand Coffee' }));

        expect(screen.getByText('Beta Market')).toBeTruthy();
        expect(screen.getByText('Alpha Shop')).toBeTruthy();
        expect(screen.getByText('70%')).toBeTruthy();
        expect(
            (container.textContent ?? '').indexOf('Beta Market')
        ).toBeLessThan((container.textContent ?? '').indexOf('Alpha Shop'));

        const betaLink = screen
            .getAllByRole('link')
            .find(link => link.textContent?.includes('Beta Market'));
        if (!betaLink) {
            throw new Error('Beta Market link was not rendered.');
        }
        expect(betaLink.getAttribute('href')).toContain('/transactions?');
        expect(betaLink.getAttribute('href')).toContain('type=expense');
        expect(betaLink.getAttribute('href')).toContain('categoryId=2');
        expect(betaLink.getAttribute('href')).toContain('vendorId=2');
        expect(betaLink.getAttribute('href')).toContain('from=2026-05-01');
        expect(betaLink.getAttribute('href')).toContain('to=2026-05-31');
    });
});
