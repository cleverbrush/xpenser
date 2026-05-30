'use client';

import type { Category, Currency } from '@xpenser/contracts';
import { Button } from '@xpenser/ui';
import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { createTransactionAction } from '@/lib/actions';
import { transactionCurrencyOptions } from '@/lib/transaction-currencies';
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
    const currencyOptions = transactionCurrencyOptions(
        currencies,
        defaultCurrency,
        transactionCurrencies
    );

    return (
        <>
            <Button asChild className="w-auto self-start sm:hidden" size="sm">
                <Link href="/capture">
                    <PlusIcon aria-hidden className="size-4" />
                    Add
                </Link>
            </Button>
            <div className="hidden sm:block">
                <TransactionDialog
                    action={createTransactionAction}
                    categories={categories}
                    currencies={currencyOptions}
                    defaultCurrency={defaultCurrency}
                    description="Amounts are stored in the original currency and converted for reports."
                    errorMessage="Could not save the transaction."
                    preferredCurrency={
                        currencyOptions[0]?.code ?? defaultCurrency
                    }
                    title="Add transaction"
                    timezone={timezone}
                    trigger={
                        <Button className="w-auto self-start" size="sm">
                            <PlusIcon aria-hidden className="size-4" />
                            Add transaction
                        </Button>
                    }
                />
            </div>
        </>
    );
}
