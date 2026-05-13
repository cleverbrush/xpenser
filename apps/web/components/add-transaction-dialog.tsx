'use client';

import type { Category, Currency } from '@xpenser/contracts';
import { Button } from '@xpenser/ui';
import { PlusIcon } from 'lucide-react';
import { createTransactionAction } from '@/lib/actions';
import { TransactionDialog } from './transaction-dialog';

export function AddTransactionDialog({
    categories,
    currencies,
    defaultCurrency
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
}) {
    return (
        <TransactionDialog
            action={createTransactionAction}
            categories={categories}
            currencies={currencies}
            defaultCurrency={defaultCurrency}
            description="Amounts are stored in the original currency and converted for reports."
            errorMessage="Could not save the transaction."
            title="Add transaction"
            trigger={
                <Button className="w-auto self-start" size="sm">
                    <PlusIcon aria-hidden className="size-4" />
                    <span className="sm:hidden">Add</span>
                    <span className="hidden sm:inline">Add transaction</span>
                </Button>
            }
        />
    );
}
