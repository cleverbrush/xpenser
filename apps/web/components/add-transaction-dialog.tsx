'use client';

import type { Category, Currency } from '@xpenser/contracts';
import { Button } from '@xpenser/ui';
import { PlusIcon } from 'lucide-react';
import { createTransactionAction } from '@/lib/actions';
import { TransactionDialog } from './transaction-dialog';

export function AddTransactionDialog({
    categories,
    currencies,
    defaultCurrency,
    favoriteCurrencies
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly favoriteCurrencies: readonly string[];
}) {
    const currenciesByCode = new Map(
        currencies.map(currency => [currency.code, currency] as const)
    );
    const selectedCurrencyCodes = [
        defaultCurrency,
        ...favoriteCurrencies.filter(currency => currency !== defaultCurrency)
    ];
    const transactionCurrencies = selectedCurrencyCodes.map(
        code => currenciesByCode.get(code) ?? { code, name: code }
    );

    return (
        <TransactionDialog
            action={createTransactionAction}
            categories={categories}
            currencies={transactionCurrencies}
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
