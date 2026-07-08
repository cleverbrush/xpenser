import { TransactionsBrowser } from '@/components/transactions-browser';
import { getApiClient } from '@/lib/api';
import { selectedBudgetForUser, selectedBudgetQuery } from '@/lib/budgets';
import {
    buildTransactionListQuery,
    hasTransactionFilters,
    type TransactionSearchParams,
    transactionHasMore,
    transactionPageSize
} from '@/lib/transaction-query';

export default async function TransactionsPage({
    searchParams
}: {
    readonly searchParams: Promise<TransactionSearchParams>;
}) {
    const params = await searchParams;
    const client = await getApiClient();
    const me = await client.auth.me();
    const budgetQuery = await selectedBudgetQuery(me);
    const selectedBudget = await selectedBudgetForUser(me);
    const defaultCurrency =
        selectedBudget?.defaultCurrency ?? me.defaultCurrency;
    const favoriteCurrencies =
        selectedBudget?.favoriteCurrencies ?? me.favoriteCurrencies;
    const transactionCurrencies =
        selectedBudget?.transactionCurrencies ?? me.transactionCurrencies;
    const [categories, currencies, vendors, transactionTags, transactions] =
        await Promise.all([
            client.categories.list({ query: budgetQuery }),
            client.currencies.list(),
            client.vendors.list({ query: { ...budgetQuery, limit: 100 } }),
            client.transactionTags.list({
                query: { ...budgetQuery, limit: 100 }
            }),
            client.transactions.list({
                query: {
                    ...buildTransactionListQuery(
                        params,
                        {
                            limit: transactionPageSize,
                            page: 1
                        },
                        me.timezone
                    ),
                    ...budgetQuery
                }
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
                currentUserId={me.id}
                defaultCurrency={defaultCurrency}
                favoriteCurrencies={favoriteCurrencies}
                hasInitialFilters={hasFilters}
                vendors={vendors}
                transactionTags={transactionTags}
                initialResponse={{
                    ...transactions,
                    hasMore: transactionHasMore(transactions)
                }}
                transactionCurrencies={transactionCurrencies}
                timezone={me.timezone}
            />
        </div>
    );
}
