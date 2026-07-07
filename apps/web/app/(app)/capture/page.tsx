import { redirect } from 'next/navigation';
import { TransactionCaptureWorkspace } from '@/components/transaction-scan-capture';
import { getApiClient } from '@/lib/api';
import { selectedBudgetForUser, selectedBudgetQuery } from '@/lib/budgets';
import { categoriesByRecentUse } from '@/lib/capture-suggestions';

export default async function CapturePage() {
    const client = await getApiClient();
    const me = await client.auth.me();
    const budgetQuery = await selectedBudgetQuery(me);
    const selectedBudget = await selectedBudgetForUser(me);
    const defaultCurrency =
        selectedBudget?.defaultCurrency ?? me.defaultCurrency;
    const [
        categories,
        currencies,
        vendors,
        transactionTags,
        recentTransactions
    ] = await Promise.all([
        client.categories.list({
            query: { ...budgetQuery, activeOnly: true }
        }),
        client.currencies.list(),
        client.vendors.list({ query: { ...budgetQuery, limit: 100 } }),
        client.transactionTags.list({
            query: { ...budgetQuery, limit: 100 }
        }),
        client.transactions.list({
            query: { ...budgetQuery, direction: 'desc', limit: 100, page: 1 }
        })
    ]);

    if (!me.hasCategories) {
        redirect('/setup/categories');
    }

    return (
        <div className="mx-auto flex max-w-xl flex-col">
            <TransactionCaptureWorkspace
                categories={categoriesByRecentUse(
                    categories,
                    recentTransactions.items
                )}
                currencies={currencies}
                defaultCurrency={defaultCurrency}
                vendors={vendors}
                transactionTags={transactionTags}
                timezone={me.timezone}
                transactionCurrencies={me.transactionCurrencies}
            />
        </div>
    );
}
