/**
 * @vitest-environment jsdom
 */

import {
    fireEvent,
    render,
    screen,
    waitFor,
    within
} from '@testing-library/react';
import type { Category } from '@xpenser/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryManager } from './category-manager';

const refresh = vi.fn();
const createCategoryAction = vi.fn();
const setCategoryArchivedAction = vi.fn();
const deleteCategoryAction = vi.fn();
const timestamp = new Date('2026-05-10T12:30:00.000Z');

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh })
}));

vi.mock('@/lib/actions', () => ({
    createCategoryAction: (formData: FormData) =>
        createCategoryAction(formData),
    deleteCategoryAction: (formData: FormData) =>
        deleteCategoryAction(formData),
    setCategoryArchivedAction: (formData: FormData) =>
        setCategoryArchivedAction(formData),
    updateCategoryAction: (formData: FormData) => Promise.resolve(formData)
}));

function category(
    id: number,
    name: string,
    overrides: Partial<Category> = {}
): Category {
    return {
        id,
        name,
        type: 'expense',
        parentId: null,
        kind: 'normal',
        displayName: name,
        inUse: false,
        hasChildren: false,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...overrides
    };
}

describe('CategoryManager', () => {
    afterEach(() => {
        createCategoryAction.mockReset();
        deleteCategoryAction.mockReset();
        setCategoryArchivedAction.mockReset();
        refresh.mockReset();
    });

    it('creates a parent expense category from the inline form', async () => {
        createCategoryAction.mockResolvedValue(undefined);
        render(<CategoryManager categories={[]} />);

        const form = screen.getByTestId('expense-category-form');
        fireEvent.change(
            within(form).getByLabelText('New Expense category name'),
            { target: { value: 'Car' } }
        );
        fireEvent.submit(form);

        await waitFor(() =>
            expect(createCategoryAction).toHaveBeenCalledOnce()
        );
        const formData = createCategoryAction.mock.calls[0]?.[0] as FormData;
        expect(formData.get('name')).toBe('Car');
        expect(formData.get('type')).toBe('expense');
        expect(formData.get('kind')).toBe('normal');
        expect(formData.get('parentId')).toBeNull();
        expect(refresh).toHaveBeenCalledOnce();
    });

    it('creates an offset child category under its parent', async () => {
        createCategoryAction.mockResolvedValue(undefined);
        render(
            <CategoryManager
                categories={[
                    category(1, 'Car', {
                        displayName: 'Car',
                        hasChildren: true
                    })
                ]}
            />
        );

        const form = screen.getByTestId('subcategory-form');
        fireEvent.change(
            within(form).getByLabelText('New Car subcategory name'),
            { target: { value: 'Returns' } }
        );
        fireEvent.change(
            within(form).getByLabelText('Car subcategory behavior'),
            { target: { value: 'offset' } }
        );
        fireEvent.submit(form);

        await waitFor(() =>
            expect(createCategoryAction).toHaveBeenCalledOnce()
        );
        const formData = createCategoryAction.mock.calls[0]?.[0] as FormData;
        expect(formData.get('name')).toBe('Returns');
        expect(formData.get('type')).toBe('expense');
        expect(formData.get('kind')).toBe('offset');
        expect(formData.get('parentId')).toBe('1');
    });

    it('archives a category from its row action', async () => {
        setCategoryArchivedAction.mockResolvedValue(undefined);
        render(<CategoryManager categories={[category(1, 'Subscriptions')]} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Archive Subscriptions' })
        );

        await waitFor(() =>
            expect(setCategoryArchivedAction).toHaveBeenCalledOnce()
        );
        const formData = setCategoryArchivedAction.mock
            .calls[0]?.[0] as FormData;
        expect(formData.get('id')).toBe('1');
        expect(formData.get('archived')).toBe('true');
        expect(refresh).toHaveBeenCalledOnce();
    });
});
