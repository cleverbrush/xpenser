import { redirect } from 'next/navigation';
import { DashboardExplorer } from '@/components/dashboard-explorer';
import { getApiClient, getCurrentUser } from '@/lib/api';
import { selectedBudgetForUser, selectedBudgetQuery } from '@/lib/budgets';
import { selectedDashboardCurrency } from '@/lib/dashboard-currencies';
import { isDashboardPeriod, parseDateParam } from '@/lib/dashboard-periods';
import { initialDashboardWindowDate } from '@/lib/dashboard-window';

type DashboardSearchParams = {
    readonly currency?: string;
    readonly date?: string;
    readonly period?: string;
};

export default async function DashboardPage({
    searchParams
}: {
    readonly searchParams: Promise<DashboardSearchParams>;
}) {
    const params = await searchParams;
    const period = isDashboardPeriod(params.period) ? params.period : 'day';
    const client = await getApiClient();
    const me = await getCurrentUser();
    const budgetQuery = await selectedBudgetQuery(me);
    const selectedBudget = await selectedBudgetForUser(me);
    const defaultCurrency =
        selectedBudget?.defaultCurrency ?? me.defaultCurrency;
    const favoriteCurrencies =
        selectedBudget?.favoriteCurrencies ?? me.favoriteCurrencies;
    const transactionCurrencies =
        selectedBudget?.transactionCurrencies ?? me.transactionCurrencies;
    const displayCurrency = selectedDashboardCurrency(
        params.currency,
        defaultCurrency,
        favoriteCurrencies
    );
    const selectedDate = parseDateParam(params.date, me.timezone);
    const anchorDate = selectedDate ?? new Date();
    const [categories, currencies, vendors, transactionTags, window] =
        await Promise.all([
            client.categories.list({
                query: {
                    ...budgetQuery,
                    activeOnly: true,
                    sort: 'recent-transaction-count'
                }
            }),
            client.currencies.list(),
            client.vendors.list({ query: { ...budgetQuery, limit: 100 } }),
            client.transactionTags.list({
                query: { ...budgetQuery, limit: 100 }
            }),
            client.dashboard.window({
                query: {
                    ...budgetQuery,
                    after: 2,
                    before: 2,
                    ...(displayCurrency !== defaultCurrency
                        ? { currency: displayCurrency }
                        : {}),
                    vendorLimit: 0,
                    period,
                    ...(selectedDate ? { date: selectedDate } : {})
                }
            })
        ]);

    if (!me.hasCategories) {
        redirect('/setup/categories');
    }

    return (
        <DashboardExplorer
            categories={categories}
            currencies={currencies}
            defaultCurrency={defaultCurrency}
            favoriteCurrencies={favoriteCurrencies}
            initialDate={initialDashboardWindowDate(
                window,
                anchorDate,
                me.timezone
            )}
            initialPeriod={period}
            initialWindow={window}
            selectedCurrency={displayCurrency}
            transactionTags={transactionTags}
            vendors={vendors}
            timezone={me.timezone}
            transactionCurrencies={transactionCurrencies}
        />
    );
}
