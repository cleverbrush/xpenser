import { redirect } from 'next/navigation';
import { QuickCaptureForm } from '@/components/quick-capture-form';
import { getApiClient } from '@/lib/api';
import { categoriesByRecentUse } from '@/lib/capture-suggestions';

export const dynamic = 'force-dynamic';

export default async function CapturePage() {
    const client = await getApiClient();
    const me = await client.auth.me();
    const [categories, currencies, recentTransactions] = await Promise.all([
        client.categories.list({ query: { activeOnly: true } }),
        client.currencies.list(),
        client.transactions.list({
            query: { direction: 'desc', limit: 100, page: 1 }
        })
    ]);

    if (!me.hasCategories) {
        redirect('/setup/categories');
    }

    return (
        <div className="mx-auto flex max-w-xl flex-col">
            <QuickCaptureForm
                categories={categoriesByRecentUse(
                    categories,
                    recentTransactions.items
                )}
                currencies={currencies}
                defaultCurrency={me.defaultCurrency}
                timezone={me.timezone}
                transactionCurrencies={me.transactionCurrencies}
            />
        </div>
    );
}
