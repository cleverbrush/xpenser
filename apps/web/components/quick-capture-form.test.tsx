/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Category, Currency, Transaction } from '@xpenser/contracts';
import { XpenserFormProvider } from '@xpenser/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickCaptureForm } from './quick-capture-form';

const refresh = vi.fn();
const createVendorAction = vi.fn();
const searchVendorCandidatesAction = vi.fn();
const createCaptureTransactionAction = vi.fn();
const deleteTransactionAction = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh })
}));

vi.mock('@/lib/actions', () => ({
    createVendorAction: (formData: FormData) => createVendorAction(formData),
    searchVendorCandidatesAction: (query: string) =>
        searchVendorCandidatesAction(query),
    createCaptureTransactionAction: (formData: FormData) =>
        createCaptureTransactionAction(formData),
    deleteTransactionAction: (formData: FormData) =>
        deleteTransactionAction(formData)
}));

const timestamp = new Date('2026-05-10T12:30:00.000Z');

function category(
    id: number,
    name: string,
    type: Category['type'] = 'expense'
): Category {
    return {
        id,
        name,
        type,
        parentId: null,
        kind: 'normal',
        displayName: name,
        inUse: true,
        hasChildren: false,
        archivedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp
    };
}

const categories = [
    category(7, 'Groceries'),
    category(8, 'Coffee'),
    category(9, 'Salary', 'income')
];

const currencies: Currency[] = [
    { code: 'USD', name: 'US dollar' },
    { code: 'EUR', name: 'Euro' }
];

function savedTransaction(): Transaction {
    return {
        id: 42,
        categoryId: 7,
        vendorId: null,
        categoryName: 'Groceries',
        categoryDisplayName: 'Groceries',
        categoryParentId: null,
        categoryKind: 'normal',
        type: 'expense',
        amount: 12.34,
        currency: 'USD',
        defaultCurrencyAmount: 12.34,
        defaultCurrency: 'USD',
        exchangeRate: 1,
        exchangeRateDate: '2026-05-10',
        occurredAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp
    };
}

function renderQuickCaptureForm({
    categories: nextCategories = categories,
    transactionCurrencies = ['USD', 'EUR']
}: {
    readonly categories?: readonly Category[];
    readonly transactionCurrencies?: readonly string[];
} = {}) {
    return render(
        <XpenserFormProvider>
            <QuickCaptureForm
                categories={nextCategories}
                currencies={currencies}
                defaultCurrency="USD"
                vendors={[]}
                timezone="UTC"
                transactionCurrencies={transactionCurrencies}
            />
        </XpenserFormProvider>
    );
}

describe('QuickCaptureForm', () => {
    afterEach(() => {
        createVendorAction.mockReset();
        searchVendorCandidatesAction.mockReset();
        createCaptureTransactionAction.mockReset();
        deleteTransactionAction.mockReset();
        refresh.mockReset();
    });

    it('saves a transaction with fast defaults and allows undo', async () => {
        createCaptureTransactionAction.mockResolvedValue(savedTransaction());
        deleteTransactionAction.mockResolvedValue(undefined);

        renderQuickCaptureForm();

        expect(screen.getByRole('combobox', { name: 'Currency' })).toBeTruthy();
        expect(screen.getByLabelText('Date and time')).toBeTruthy();
        expect(screen.getByLabelText('Note')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Details' })).toBeNull();
        expect(
            screen.queryByRole('combobox', { name: 'All categories' })
        ).toBeNull();
        expect(screen.queryByText('Defaults')).toBeNull();

        fireEvent.change(screen.getByLabelText('Amount'), {
            target: { value: '12.34' }
        });
        fireEvent.change(screen.getByLabelText('Note'), {
            target: { value: 'Quick capture note' }
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Save transaction' })
        );

        await waitFor(() =>
            expect(createCaptureTransactionAction).toHaveBeenCalledOnce()
        );

        const formData = createCaptureTransactionAction.mock
            .calls[0]?.[0] as FormData;
        expect(formData.get('categoryId')).toBe('7');
        expect(formData.get('amount')).toBe('12.34');
        expect(formData.get('currency')).toBe('USD');
        expect(formData.get('effect')).toBeNull();
        expect(formData.get('note')).toBe('Quick capture note');
        expect(formData.get('occurredAt')).toBeTruthy();
        expect(refresh).toHaveBeenCalledOnce();
        expect((screen.getByLabelText('Note') as HTMLInputElement).value).toBe(
            ''
        );

        expect(screen.getByText('Saved')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

        await waitFor(() =>
            expect(deleteTransactionAction).toHaveBeenCalledOnce()
        );

        const undoFormData = deleteTransactionAction.mock
            .calls[0]?.[0] as FormData;
        expect(undoFormData.get('id')).toBe('42');
        expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('wraps categories and reveals more on demand', () => {
        const manyCategories = Array.from({ length: 6 }, (_, index) =>
            category(index + 1, `Category ${index + 1}`)
        );

        renderQuickCaptureForm({
            categories: manyCategories,
            transactionCurrencies: ['USD']
        });

        expect(screen.getByRole('button', { name: 'Category 1' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Category 4' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Category 5' })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

        expect(screen.getByRole('button', { name: 'Category 5' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    });

    it('validates amount before saving', async () => {
        renderQuickCaptureForm({ transactionCurrencies: ['USD'] });

        fireEvent.click(
            screen.getByRole('button', { name: 'Save transaction' })
        );

        expect((await screen.findByRole('alert')).textContent).toBe(
            'Enter a positive amount with up to two decimals.'
        );
        expect(createCaptureTransactionAction).not.toHaveBeenCalled();
    });

    it('shows a management link when no active categories are available', () => {
        renderQuickCaptureForm({
            categories: [
                {
                    ...category(7, 'Old groceries'),
                    archivedAt: new Date('2026-05-11T00:00:00.000Z')
                }
            ],
            transactionCurrencies: ['USD']
        });

        expect(screen.getByText('No active categories')).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Manage categories' })
                .getAttribute('href')
        ).toBe('/settings/categories');
        expect(
            screen.queryByRole('button', { name: 'Save transaction' })
        ).toBeNull();
    });

    it('accepts comma decimal input without browser number coercion', async () => {
        createCaptureTransactionAction.mockResolvedValue(savedTransaction());

        renderQuickCaptureForm({ transactionCurrencies: ['USD'] });

        fireEvent.change(screen.getByLabelText('Amount'), {
            target: { value: '4,56' }
        });
        fireEvent.click(
            screen.getByRole('button', { name: 'Save transaction' })
        );

        await waitFor(() =>
            expect(createCaptureTransactionAction).toHaveBeenCalledOnce()
        );

        const formData = createCaptureTransactionAction.mock
            .calls[0]?.[0] as FormData;
        expect(formData.get('amount')).toBe('4.56');
    });
});
