import type { DashboardSummary } from '@xpenser/contracts';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@xpenser/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AddTransactionDialog } from '@/components/add-transaction-dialog';
import { AmountDisplay } from '@/components/amount-display';
import { DashboardPeriodNav } from '@/components/dashboard-period-nav';
import { DashboardSwipeArea } from '@/components/dashboard-swipe-area';
import { DatatypeChart, datatypeExpression } from '@/components/datatype-chart';
import { getApiClient } from '@/lib/api';
import {
    dateParam,
    formatDashboardRangeLabel,
    isDashboardPeriod,
    parseDateParam
} from '@/lib/dashboard-periods';
import {
    amountClassNameForCategoryTotal,
    amountClassNameForValue,
    formatSignedPercent,
    percentChangeClassNameForCategory,
    signedCategoryTotal
} from '@/lib/format';

type DashboardSearchParams = {
    readonly date?: string;
    readonly period?: string;
};

type DashboardCategory = DashboardSummary['byCategory'][number];

function categoryHref(
    summary: DashboardSummary,
    category: DashboardCategory,
    timezone: string
): string {
    const params = new URLSearchParams({
        type: category.type,
        categoryId: String(category.categoryId),
        from: dateParam(summary.from, timezone),
        to: dateParam(summary.to, timezone)
    });
    return `/transactions?${params.toString()}`;
}

function CategoryRow({
    category,
    summary,
    timezone
}: {
    readonly category: DashboardCategory;
    readonly summary: DashboardSummary;
    readonly timezone: string;
}) {
    const showPeriodDetails = summary.period !== 'day';
    const percentChange = formatSignedPercent(category.percentChange);

    return (
        <Link
            className={`grid items-center gap-3 py-3 text-sm transition-colors hover:bg-muted/40 sm:px-2 ${
                showPeriodDetails
                    ? 'grid-cols-[minmax(0,1fr)_auto_74px] sm:grid-cols-[minmax(0,1fr)_auto_104px]'
                    : 'grid-cols-[minmax(0,1fr)_auto]'
            }`}
            href={categoryHref(summary, category, timezone)}
        >
            <span className="min-w-0">
                <span className="block truncate font-medium">
                    {category.categoryName}
                </span>
                <span className="text-xs text-muted-foreground">
                    {category.transactionCount}{' '}
                    {category.transactionCount === 1
                        ? 'transaction'
                        : 'transactions'}
                </span>
            </span>
            <span className="min-w-0 text-right">
                <span
                    className={`font-semibold ${amountClassNameForCategoryTotal(
                        category.total,
                        category.type
                    )}`}
                >
                    <AmountDisplay
                        currency={summary.currency}
                        value={signedCategoryTotal(
                            category.total,
                            category.type
                        )}
                    />
                </span>
                {showPeriodDetails ? (
                    <span
                        className={`block text-xs font-medium ${percentChangeClassNameForCategory(
                            category.percentChange,
                            category.type
                        )}`}
                        title={`Change from previous ${summary.period}: ${percentChange}`}
                    >
                        <span className="sr-only">
                            Change from previous {summary.period}:{' '}
                        </span>
                        {percentChange}
                    </span>
                ) : null}
            </span>
            {showPeriodDetails ? (
                <span className="flex min-w-0 justify-end overflow-hidden">
                    <DatatypeChart
                        className={`text-xl ${amountClassNameForCategoryTotal(
                            category.total,
                            category.type
                        )}`}
                        expression={datatypeExpression('l', category.trend)}
                    />
                </span>
            ) : null}
        </Link>
    );
}

function CategoryGroup({
    categories,
    summary,
    timezone,
    title
}: {
    readonly categories: readonly DashboardCategory[];
    readonly summary: DashboardSummary;
    readonly timezone: string;
    readonly title: string;
}) {
    return (
        <div>
            <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                {title}
            </h3>
            <div className="flex flex-col divide-y">
                {categories.length === 0 ? (
                    <p className="py-3 text-sm text-muted-foreground">
                        No activity for this period.
                    </p>
                ) : (
                    categories.map(category => (
                        <CategoryRow
                            category={category}
                            key={`${category.type}-${category.categoryId}`}
                            summary={summary}
                            timezone={timezone}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
    searchParams
}: {
    readonly searchParams: Promise<DashboardSearchParams>;
}) {
    const params = await searchParams;
    const period = isDashboardPeriod(params.period) ? params.period : 'day';
    const client = await getApiClient();
    const me = await client.auth.me();
    const selectedDate = parseDateParam(params.date, me.timezone);
    const anchorDate = selectedDate ?? new Date();
    const anchorDateParam = dateParam(anchorDate, me.timezone);
    const [categories, currencies, summary] = await Promise.all([
        client.categories.list({
            query: { sort: 'recent-transaction-count' }
        }),
        client.currencies.list(),
        client.dashboard.summary({
            query: {
                period,
                ...(selectedDate ? { date: selectedDate } : {})
            }
        })
    ]);

    if (!me.hasCategories) {
        redirect('/setup/categories');
    }

    const incomeCategories = summary.byCategory.filter(
        category => category.type === 'income'
    );
    const expenseCategories = summary.byCategory.filter(
        category => category.type === 'expense'
    );
    const categoryPanel = (
        <Card>
            <CardHeader>
                <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">
                    <CategoryGroup
                        categories={incomeCategories}
                        summary={summary}
                        timezone={me.timezone}
                        title="Income"
                    />
                    <CategoryGroup
                        categories={expenseCategories}
                        summary={summary}
                        timezone={me.timezone}
                        title="Expenses"
                    />
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold">Dashboard</h1>
                    <p className="text-sm text-muted-foreground">
                        {formatDashboardRangeLabel({
                            from: summary.from,
                            period,
                            to: summary.to,
                            timeZone: me.timezone
                        })}{' '}
                        in {summary.currency}.
                    </p>
                </div>
                <div className="shrink-0">
                    <AddTransactionDialog
                        categories={categories}
                        currencies={currencies}
                        defaultCurrency={me.defaultCurrency}
                        transactionCurrencies={me.transactionCurrencies}
                        timezone={me.timezone}
                    />
                </div>
            </div>
            <DashboardPeriodNav
                date={anchorDateParam}
                period={period}
                timezone={me.timezone}
            />
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <Card className="min-w-0">
                    <CardHeader className="min-w-0 p-3 sm:p-4">
                        <CardDescription className="text-xs">
                            Income
                        </CardDescription>
                        <CardTitle
                            className={`truncate text-sm sm:text-lg ${amountClassNameForCategoryTotal(summary.incomeTotal, 'income')}`}
                        >
                            <AmountDisplay
                                currency={summary.currency}
                                value={signedCategoryTotal(
                                    summary.incomeTotal,
                                    'income'
                                )}
                            />
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card className="min-w-0">
                    <CardHeader className="min-w-0 p-3 sm:p-4">
                        <CardDescription className="text-xs">
                            Expenses
                        </CardDescription>
                        <CardTitle
                            className={`truncate text-sm sm:text-lg ${amountClassNameForCategoryTotal(summary.expenseTotal, 'expense')}`}
                        >
                            <AmountDisplay
                                currency={summary.currency}
                                value={signedCategoryTotal(
                                    summary.expenseTotal,
                                    'expense'
                                )}
                            />
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card className="min-w-0">
                    <CardHeader className="min-w-0 p-3 sm:p-4">
                        <CardDescription className="text-xs">
                            Net
                        </CardDescription>
                        <CardTitle
                            className={`truncate text-sm sm:text-lg ${amountClassNameForValue(
                                summary.incomeTotal - summary.expenseTotal
                            )}`}
                        >
                            <AmountDisplay
                                currency={summary.currency}
                                value={
                                    summary.incomeTotal - summary.expenseTotal
                                }
                            />
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>
            <DashboardSwipeArea
                date={anchorDateParam}
                period={period}
                timezone={me.timezone}
            >
                {categoryPanel}
            </DashboardSwipeArea>
        </div>
    );
}
