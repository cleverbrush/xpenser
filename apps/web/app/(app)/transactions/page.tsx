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
    const [me, categories, currencies, transactions] = await Promise.all([
        client.auth.me(),
        client.categories.list(),
        client.currencies.list(),
        client.transactions.list({
            query: buildTransactionListQuery(params, {
                limit: transactionPageSize,
                page: 1
            })
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
                initialResponse={{
                    ...transactions,
                    hasMore: transactionHasMore(transactions)
                }}
            />
        </div>
    );
}
