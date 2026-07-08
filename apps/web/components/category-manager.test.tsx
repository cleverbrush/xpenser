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
import { XpenserFormProvider } from '@xpenser/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategoryManager } from './category-manager';

Element.prototype.scrollIntoView = vi.fn();

const refresh = vi.fn();
const createCategoryAction = vi.fn();
const setCategoryArchivedAction = vi.fn();
const deleteCategoryAction = vi.fn();
const moveAndDeleteCategoryAction = vi.fn();
const timestamp = new Date('2026-05-10T12:30:00.000Z');

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh })
}));

vi.mock('@/lib/actions', () => ({
    createCategoryAction: (formData: FormData) =>
        createCategoryAction(formData),
    deleteCategoryAction: (formData: FormData) =>
        deleteCategoryAction(formData),
    moveAndDeleteCategoryAction: (formData: FormData) =>
        moveAndDeleteCategoryAction(formData),
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
        budgetId: 1,
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

function renderManager(categories: readonly Category[]) {
    return render(
        <XpenserFormProvider>
            <CategoryManager categories={categories} />
        </XpenserFormProvider>
    );
}

describe('CategoryManager', () => {
    afterEach(() => {
        createCategoryAction.mockReset();
        deleteCategoryAction.mockReset();
        moveAndDeleteCategoryAction.mockReset();
        setCategoryArchivedAction.mockReset();
        refresh.mockReset();
    });

    it('creates a parent expense category from the inline form', async () => {
        createCategoryAction.mockResolvedValue(undefined);
        renderManager([]);

        expect(screen.queryByTestId('expense-category-form')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));

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
        renderManager([
            category(1, 'Car', {
                displayName: 'Car',
                hasChildren: true
            })
        ]);

        fireEvent.click(screen.getByRole('button', { name: 'Expand Car' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add subcategory to Car' })
        );

        const form = screen.getByTestId('subcategory-form');
        fireEvent.change(
            within(form).getByLabelText('New Car subcategory name'),
            { target: { value: 'Returns' } }
        );
        fireEvent.click(within(form).getByRole('checkbox'));
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
        renderManager([category(1, 'Subscriptions')]);

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

    it('confirms deletion for unused categories', () => {
        renderManager([category(1, 'Subscriptions'), category(2, 'Fuel')]);

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete Subscriptions' })
        );

        const dialog = screen.getByRole('dialog', { name: 'Delete category?' });
        expect(dialog).toBeTruthy();
        expect(
            within(dialog).getByText(
                'Delete Subscriptions. This cannot be undone.'
            )
        ).toBeTruthy();
        expect(
            within(dialog).getByRole('button', { name: 'Delete' })
        ).toBeTruthy();
        expect(screen.queryByLabelText('Replacement category')).toBeNull();
    });

    it('moves transactions before deleting an in-use category', async () => {
        moveAndDeleteCategoryAction.mockResolvedValue(undefined);
        renderManager([
            category(1, 'Old fuel', { inUse: true }),
            category(2, 'Fuel'),
            category(3, 'Archived fuel', {
                archivedAt: new Date('2026-05-11T00:00:00.000Z')
            }),
            category(4, 'Salary', { type: 'income' }),
            category(5, 'Returns', {
                displayName: 'Car -> Returns',
                kind: 'offset',
                parentId: 6
            })
        ]);

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete Old fuel' })
        );

        expect(screen.getByLabelText('Replacement category')).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Move and delete' })
        ).toHaveProperty('disabled', true);

        fireEvent.click(screen.getByLabelText('Replacement category'));
        expect(
            screen.queryByRole('option', { name: 'Archived fuel' })
        ).toBeNull();
        expect(
            screen.queryByRole('option', { name: 'Car -> Returns' })
        ).toBeNull();
        expect(screen.queryByRole('option', { name: 'Salary' })).toBeNull();
        fireEvent.click(await screen.findByRole('option', { name: 'Fuel' }));
        fireEvent.submit(
            screen
                .getByRole('button', { name: 'Move and delete' })
                .closest('form') as HTMLFormElement
        );

        await waitFor(() =>
            expect(moveAndDeleteCategoryAction).toHaveBeenCalledOnce()
        );
        const formData = moveAndDeleteCategoryAction.mock
            .calls[0]?.[0] as FormData;
        expect(formData.get('id')).toBe('1');
        expect(formData.get('replacementCategoryId')).toBe('2');
    });

    it('filters income replacement categories by effective direction', async () => {
        moveAndDeleteCategoryAction.mockResolvedValue(undefined);
        renderManager([
            category(1, 'Old salary', { inUse: true, type: 'income' }),
            category(2, 'Salary', { type: 'income' }),
            category(3, 'Expense correction', {
                displayName: 'Salary -> Expense correction',
                kind: 'offset',
                parentId: 4,
                type: 'income'
            }),
            category(5, 'Fuel')
        ]);

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete Old salary' })
        );
        fireEvent.click(screen.getByLabelText('Replacement category'));

        expect(
            screen.queryByRole('option', {
                name: 'Salary -> Expense correction'
            })
        ).toBeNull();
        expect(screen.queryByRole('option', { name: 'Fuel' })).toBeNull();
        fireEvent.click(await screen.findByRole('option', { name: 'Salary' }));

        fireEvent.submit(
            screen
                .getByRole('button', { name: 'Move and delete' })
                .closest('form') as HTMLFormElement
        );

        await waitFor(() =>
            expect(moveAndDeleteCategoryAction).toHaveBeenCalledOnce()
        );
        const formData = moveAndDeleteCategoryAction.mock
            .calls[0]?.[0] as FormData;
        expect(formData.get('id')).toBe('1');
        expect(formData.get('replacementCategoryId')).toBe('2');
    });

    it('keeps parent category delete disabled', () => {
        renderManager([
            category(1, 'Car', {
                displayName: 'Car',
                hasChildren: true
            }),
            category(2, 'Fuel')
        ]);

        const deleteButton = screen.getByRole('button', {
            name: 'Delete Car'
        }) as HTMLButtonElement;

        expect(deleteButton.disabled).toBe(true);
    });

    it('hides edit and delete actions for archived categories', () => {
        renderManager([
            category(1, 'Old fuel', {
                archivedAt: new Date('2026-05-11T00:00:00.000Z')
            }),
            category(2, 'Fuel')
        ]);

        expect(
            screen.getByRole('button', { name: 'Restore Old fuel' })
        ).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Edit Old fuel' })
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Delete Old fuel' })
        ).toBeNull();
    });

    it('keeps parent rows collapsed until expanded', () => {
        renderManager([
            category(1, 'Car', {
                displayName: 'Car',
                hasChildren: true
            }),
            category(2, 'Fuel', {
                displayName: 'Car -> Fuel',
                parentId: 1
            })
        ]);

        expect(screen.queryByText('Fuel')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Expand Car' }));

        expect(screen.getByText('Fuel')).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Add subcategory to Car' })
        ).toBeTruthy();
    });

    it('opens edit dialog with existing category values', async () => {
        renderManager([category(1, 'Subscriptions')]);

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit Subscriptions' })
        );

        await waitFor(() => {
            const input = screen.getByLabelText('Name') as HTMLInputElement;
            expect(input.value).toBe('Subscriptions');
        });
    });

    it('does not autofocus the category name when opening edit dialog', async () => {
        renderManager([category(1, 'Subscriptions')]);

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit Subscriptions' })
        );

        await waitFor(() => {
            const input = screen.getByLabelText('Name') as HTMLInputElement;
            expect(input.value).toBe('Subscriptions');
            expect(document.activeElement).not.toBe(input);
        });
    });

    it('validates parent category names before creating', async () => {
        createCategoryAction.mockResolvedValue(undefined);
        renderManager([]);

        fireEvent.click(screen.getByRole('button', { name: 'Add expense' }));
        fireEvent.submit(screen.getByTestId('expense-category-form'));

        expect(
            await screen.findByText('category name is required')
        ).toBeTruthy();
        expect(createCategoryAction).not.toHaveBeenCalled();
    });
});
