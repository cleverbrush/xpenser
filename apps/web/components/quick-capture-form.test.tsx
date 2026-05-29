/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Category, Currency, Transaction } from '@xpenser/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuickCaptureForm } from './quick-capture-form';

const refresh = vi.fn();
const createCaptureTransactionAction = vi.fn();
const deleteTransactionAction = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh })
}));

vi.mock('@/lib/actions', () => ({
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
        inUse: true,
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
        categoryName: 'Groceries',
        type: 'expense',
        effect: 'normal',
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

describe('QuickCaptureForm', () => {
    afterEach(() => {
        createCaptureTransactionAction.mockReset();
        deleteTransactionAction.mockReset();
        refresh.mockReset();
    });

    it('saves a transaction with fast defaults and allows undo', async () => {
        createCaptureTransactionAction.mockResolvedValue(savedTransaction());
        deleteTransactionAction.mockResolvedValue(undefined);

        render(
            <QuickCaptureForm
                categories={categories}
                currencies={currencies}
                defaultCurrency="USD"
                timezone="UTC"
                transactionCurrencies={['USD', 'EUR']}
            />
        );

        fireEvent.change(screen.getByLabelText('Amount'), {
            target: { value: '12.34' }
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
        expect(formData.get('effect')).toBe('normal');
        expect(formData.get('occurredAt')).toBeTruthy();
        expect(refresh).toHaveBeenCalledOnce();

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

    it('validates amount before saving', async () => {
        render(
            <QuickCaptureForm
                categories={categories}
                currencies={currencies}
                defaultCurrency="USD"
                timezone="UTC"
                transactionCurrencies={['USD']}
            />
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Save transaction' })
        );

        expect((await screen.findByRole('alert')).textContent).toBe(
            'Enter a positive amount.'
        );
        expect(createCaptureTransactionAction).not.toHaveBeenCalled();
    });
});
