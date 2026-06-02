/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CollapsibleReportCategoryGroup } from './report-category-group';

type TestCategory = {
    readonly categoryId: number;
    readonly categoryName: string;
    readonly categoryDisplayName: string;
    readonly categoryParentId: number | null;
    readonly categoryParentName?: string;
    readonly categoryKind: 'normal' | 'offset';
    readonly type: 'expense' | 'income';
};

function category(overrides: Partial<TestCategory>): TestCategory {
    return {
        categoryDisplayName: 'Category',
        categoryId: 1,
        categoryKind: 'normal',
        categoryName: 'Category',
        categoryParentId: null,
        type: 'expense',
        ...overrides
    };
}

describe('CollapsibleReportCategoryGroup', () => {
    it('hides duplicate child names until their parent rows are expanded', () => {
        const car = category({
            categoryDisplayName: 'Car',
            categoryId: 1,
            categoryName: 'Car',
            type: 'income'
        });
        const travel = category({
            categoryDisplayName: 'Travel',
            categoryId: 3,
            categoryName: 'Travel',
            type: 'income'
        });
        const carReturns = category({
            categoryDisplayName: 'Car -> Returns',
            categoryId: 2,
            categoryKind: 'offset',
            categoryName: 'Returns',
            categoryParentId: car.categoryId,
            categoryParentName: 'Car',
            type: 'income'
        });
        const travelReturns = category({
            categoryDisplayName: 'Travel -> Returns',
            categoryId: 4,
            categoryKind: 'offset',
            categoryName: 'Returns',
            categoryParentId: travel.categoryId,
            categoryParentName: 'Travel',
            type: 'income'
        });

        render(
            <CollapsibleReportCategoryGroup
                empty={<p>No categories</p>}
                nodes={[
                    { category: car, children: [carReturns] },
                    { category: travel, children: [travelReturns] }
                ]}
                renderChild={({ child, parent }) => (
                    <div data-testid={`${parent.categoryName}-child`}>
                        {child.categoryName}
                    </div>
                )}
                renderParent={({ expandable, expanded, node, onToggle }) => (
                    <div>
                        {expandable ? (
                            <button
                                aria-label={`${
                                    expanded ? 'Collapse' : 'Expand'
                                } ${node.category.categoryName}`}
                                onClick={onToggle}
                                type="button"
                            >
                                Toggle
                            </button>
                        ) : null}
                        <span>{node.category.categoryName}</span>
                    </div>
                )}
            />
        );

        expect(screen.getByText('Car')).toBeTruthy();
        expect(screen.getByText('Travel')).toBeTruthy();
        expect(screen.queryAllByText('Returns')).toHaveLength(0);

        fireEvent.click(screen.getByRole('button', { name: 'Expand Car' }));

        expect(screen.getByTestId('Car-child').textContent).toBe('Returns');
        expect(screen.queryAllByText('Returns')).toHaveLength(1);

        fireEvent.click(screen.getByRole('button', { name: 'Expand Travel' }));

        expect(screen.getByTestId('Travel-child').textContent).toBe('Returns');
        expect(screen.queryAllByText('Returns')).toHaveLength(2);
    });

    it('renders the empty state when there are no grouped categories', () => {
        render(
            <CollapsibleReportCategoryGroup
                empty={<p>No income activity for this period.</p>}
                nodes={[]}
                renderChild={({ child }) => <span>{child.categoryName}</span>}
                renderParent={({ node }) => (
                    <span>{node.category.categoryName}</span>
                )}
            />
        );

        expect(
            screen.getByText('No income activity for this period.')
        ).toBeTruthy();
    });
});
