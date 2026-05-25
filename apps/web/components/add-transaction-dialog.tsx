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
    transactionCurrencies,
    timezone
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly transactionCurrencies: readonly string[];
    readonly timezone: string;
}) {
    const currenciesByCode = new Map(
        currencies.map(currency => [currency.code, currency] as const)
    );
    const selectedCurrencyCodes = Array.from(
        new Set(
            transactionCurrencies.length > 0
                ? transactionCurrencies
                : [defaultCurrency]
        )
    );
    const transactionCurrencyOptions = selectedCurrencyCodes.map(
        code => currenciesByCode.get(code) ?? { code, name: code }
    );

    return (
        <TransactionDialog
            action={createTransactionAction}
            categories={categories}
            currencies={transactionCurrencyOptions}
            defaultCurrency={defaultCurrency}
            description="Amounts are stored in the original currency and converted for reports."
            errorMessage="Could not save the transaction."
            preferredCurrency={selectedCurrencyCodes[0] ?? defaultCurrency}
            title="Add transaction"
            timezone={timezone}
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
