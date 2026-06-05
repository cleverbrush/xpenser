/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { XpenserFormProvider } from '@xpenser/ui';
import { describe, expect, it, vi } from 'vitest';
import { TransactionDialog } from './transaction-dialog';

const refresh = vi.fn();
const createVendorAction = vi.fn();
const searchVendorCandidatesAction = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh })
}));

vi.mock('@/lib/actions', () => ({
    createVendorAction: (formData: FormData) => createVendorAction(formData),
    searchVendorCandidatesAction: (query: string) =>
        searchVendorCandidatesAction(query)
}));

describe('TransactionDialog', () => {
    it('submits edited transaction values as form data', async () => {
        const action = vi.fn(async (_formData: FormData) => {});

        render(
            <XpenserFormProvider>
                <TransactionDialog
                    action={action}
                    categories={[
                        {
                            createdAt: new Date('2026-05-01T00:00:00.000Z'),
                            displayName: 'Groceries',
                            hasChildren: false,
                            id: 7,
                            inUse: true,
                            kind: 'normal',
                            name: 'Groceries',
                            parentId: null,
                            archivedAt: null,
                            type: 'expense',
                            updatedAt: new Date('2026-05-01T00:00:00.000Z')
                        }
                    ]}
                    currencies={[{ code: 'USD', name: 'US dollar' }]}
                    defaultCurrency="USD"
                    description="Update transaction details."
                    errorMessage="Could not update the transaction."
                    initialValues={{
                        amount: 12.34,
                        categoryId: 7,
                        currency: 'USD',
                        vendorId: null,
                        note: 'Original',
                        occurredAt: new Date('2026-05-10T12:30:00.000Z'),
                        type: 'expense'
                    }}
                    vendors={[]}
                    submitLabel="Save changes"
                    title="Edit transaction"
                    transactionId={42}
                    trigger={<button type="button">Edit</button>}
                    timezone="UTC"
                />
            </XpenserFormProvider>
        );

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
        fireEvent.change(screen.getByLabelText('Amount'), {
            target: { value: '23.45' }
        });
        expect(screen.getByLabelText('Note').tagName).toBe('TEXTAREA');
        fireEvent.change(screen.getByLabelText('Note'), {
            target: { value: 'Updated note\nItem line' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

        await waitFor(() => expect(action).toHaveBeenCalledOnce());

        const formData = action.mock.calls[0]?.[0] as FormData | undefined;
        expect(formData?.get('id')).toBe('42');
        expect(formData?.get('categoryId')).toBe('7');
        expect(formData?.get('amount')).toBe('23.45');
        expect(formData?.get('currency')).toBe('USD');
        expect(formData?.get('note')).toBe('Updated note\nItem line');
        expect(refresh).toHaveBeenCalledOnce();
    });
});
