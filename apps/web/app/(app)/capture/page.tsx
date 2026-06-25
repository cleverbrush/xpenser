import { redirect } from 'next/navigation';
import { TransactionCaptureWorkspace } from '@/components/transaction-scan-capture';
import { getApiClient } from '@/lib/api';
import { categoriesByRecentUse } from '@/lib/capture-suggestions';

export default async function CapturePage() {
    const client = await getApiClient();
    const me = await client.auth.me();
    const [
        categories,
        currencies,
        vendors,
        transactionTags,
        recentTransactions
    ] = await Promise.all([
        client.categories.list({ query: { activeOnly: true } }),
        client.currencies.list(),
        client.vendors.list({ query: { limit: 100 } }),
        client.transactionTags.list({ query: { limit: 100 } }),
        client.transactions.list({
            query: { direction: 'desc', limit: 100, page: 1 }
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
                defaultCurrency={me.defaultCurrency}
                vendors={vendors}
                transactionTags={transactionTags}
                timezone={me.timezone}
                transactionCurrencies={me.transactionCurrencies}
            />
        </div>
    );
}
