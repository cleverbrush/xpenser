import { VendorsExplorer } from '@/components/vendors-explorer';
import { getApiClient } from '@/lib/api';
import { selectedDashboardCurrency } from '@/lib/dashboard-currencies';
import { isDashboardPeriod, parseDateParam } from '@/lib/dashboard-periods';
import { initialDashboardWindowDate } from '@/lib/dashboard-window';
import { vendorAnalyticsVendorLimit } from '@/lib/vendor-analytics';

type VendorsSearchParams = {
    readonly currency?: string;
    readonly date?: string;
    readonly period?: string;
};

export default async function VendorsPage({
    searchParams
}: {
    readonly searchParams: Promise<VendorsSearchParams>;
}) {
    const params = await searchParams;
    const period = isDashboardPeriod(params.period) ? params.period : 'day';
    const client = await getApiClient();
    const me = await client.auth.me();
    const displayCurrency = selectedDashboardCurrency(
        params.currency,
        me.defaultCurrency,
        me.favoriteCurrencies
    );
    const selectedDate = parseDateParam(params.date, me.timezone);
    const anchorDate = selectedDate ?? new Date();
    const [categories, currencies, vendors, transactionTags, window] =
        await Promise.all([
            client.categories.list({
                query: { activeOnly: true, sort: 'recent-transaction-count' }
            }),
            client.currencies.list(),
            client.vendors.list({ query: { limit: 100 } }),
            client.transactionTags.list({ query: { limit: 100 } }),
            client.dashboard.window({
                query: {
                    after: 2,
                    before: 2,
                    ...(displayCurrency !== me.defaultCurrency
                        ? { currency: displayCurrency }
                        : {}),
                    vendorLimit: vendorAnalyticsVendorLimit,
                    period,
                    ...(selectedDate ? { date: selectedDate } : {})
                }
            })
        ]);

    return (
        <VendorsExplorer
            categories={categories}
            currencies={currencies}
            defaultCurrency={me.defaultCurrency}
            favoriteCurrencies={me.favoriteCurrencies}
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
            transactionCurrencies={me.transactionCurrencies}
        />
    );
}
