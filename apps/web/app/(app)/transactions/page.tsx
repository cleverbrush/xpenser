import { TransactionsBrowser } from '@/components/transactions-browser';
import { getApiClient } from '@/lib/api';
import {
    buildTransactionListQuery,
    hasTransactionFilters,
    type TransactionSearchParams,
    transactionHasMore,
    transactionPageSize
} from '@/lib/transaction-query';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({
    searchParams
}: {
    readonly searchParams: Promise<TransactionSearchParams>;
}) {
    const params = await searchParams;
    const client = await getApiClient();
    const me = await client.auth.me();
    const [categories, currencies, vendors, transactions] = await Promise.all([
        client.categories.list({ query: {} }),
        client.currencies.list(),
        client.vendors.list({ query: { limit: 100 } }),
        client.transactions.list({
            query: buildTransactionListQuery(
                params,
                {
                    limit: transactionPageSize,
                    page: 1
                },
                me.timezone
            )
        })
    ]);
    const hasFilters = hasTransactionFilters(params);

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div>
                <h1 className="text-2xl font-semibold">Transactions</h1>
                <p className="text-sm text-muted-foreground">
                    Search and review all recorded income and expenses.
                </p>
            </div>
            <TransactionsBrowser
                categories={categories}
                currencies={currencies}
                defaultCurrency={me.defaultCurrency}
                hasInitialFilters={hasFilters}
                vendors={vendors}
                initialResponse={{
                    ...transactions,
                    hasMore: transactionHasMore(transactions)
                }}
                transactionCurrencies={me.transactionCurrencies}
                timezone={me.timezone}
            />
        </div>
    );
}
