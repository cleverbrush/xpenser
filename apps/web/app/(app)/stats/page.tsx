import type { DashboardSummary, StatsQuery } from '@xpenser/contracts';
import { Card, CardDescription, CardHeader, CardTitle } from '@xpenser/ui';
import { AmountDisplay } from '@/components/amount-display';
import { DashboardPeriodNav } from '@/components/dashboard-period-nav';
import { DashboardSwipeArea } from '@/components/dashboard-swipe-area';
import { StatsCharts, StatsChartsSkeleton } from '@/components/stats-charts';
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
    formatMoney,
    signedCategoryTotal
} from '@/lib/format';

type StatsSearchParams = {
    readonly date?: string;
    readonly period?: string;
};

type DashboardPeriod = DashboardSummary['period'];
type StatsGroupBy = NonNullable<StatsQuery['groupBy']>;

function groupByForPeriod(period: DashboardPeriod): StatsGroupBy {
    if (period === 'day') {
        return 'hour';
    }
    if (period === 'week') {
        return 'day';
    }
    if (period === 'year') {
        return 'month';
    }
    return 'week';
}

function formatCountDelta(value: number): string {
    if (value === 0) {
        return '0';
    }
    return `${value > 0 ? '+' : ''}${value}`;
}

function signedComparisonDelta(
    current: number,
    previous: number,
    type: 'expense' | 'income'
): number {
    return type === 'expense' ? previous - current : current - previous;
}

export const dynamic = 'force-dynamic';

export default async function StatsPage({
    searchParams
}: {
    readonly searchParams: Promise<StatsSearchParams>;
}) {
    const params = await searchParams;
    const period = isDashboardPeriod(params.period) ? params.period : 'day';
    const selectedDate = parseDateParam(params.date);
    const anchorDate = selectedDate ?? new Date();
    const anchorDateParam = dateParam(anchorDate);
    const client = await getApiClient();
    const stats = await client.stats.overview({
        query: {
            groupBy: groupByForPeriod(period),
            period,
            timeframe: 'custom',
            ...(selectedDate ? { date: selectedDate } : {})
        }
    });
    const netDeltaPrevious =
        stats.netTotal - stats.comparison.previousPeriod.netTotal;
    const netDeltaYear =
        stats.netTotal - stats.comparison.previousYear.netTotal;
    const countDeltaPrevious =
        stats.transactionCount -
        stats.comparison.previousPeriod.transactionCount;
    const countDeltaYear =
        stats.transactionCount - stats.comparison.previousYear.transactionCount;

    const cards = [
        {
            label: 'Income',
            value: (
                <AmountDisplay
                    currency={stats.currency}
                    value={signedCategoryTotal(stats.incomeTotal, 'income')}
                />
            ),
            className: amountClassNameForCategoryTotal(
                stats.incomeTotal,
                'income'
            ),
            previous: signedComparisonDelta(
                stats.incomeTotal,
                stats.comparison.previousPeriod.incomeTotal,
                'income'
            ),
            previousYear: signedComparisonDelta(
                stats.incomeTotal,
                stats.comparison.previousYear.incomeTotal,
                'income'
            ),
            money: true
        },
        {
            label: 'Expenses',
            value: (
                <AmountDisplay
                    currency={stats.currency}
                    value={signedCategoryTotal(stats.expenseTotal, 'expense')}
                />
            ),
            className: amountClassNameForCategoryTotal(
                stats.expenseTotal,
                'expense'
            ),
            previous: signedComparisonDelta(
                stats.expenseTotal,
                stats.comparison.previousPeriod.expenseTotal,
                'expense'
            ),
            previousYear: signedComparisonDelta(
                stats.expenseTotal,
                stats.comparison.previousYear.expenseTotal,
                'expense'
            ),
            money: true
        },
        {
            label: 'Net',
            value: (
                <AmountDisplay
                    currency={stats.currency}
                    value={stats.netTotal}
                />
            ),
            className: amountClassNameForValue(stats.netTotal),
            previous: netDeltaPrevious,
            previousYear: netDeltaYear,
            money: true
        },
        {
            label: 'Transactions',
            value: String(stats.transactionCount),
            className: '',
            previous: countDeltaPrevious,
            previousYear: countDeltaYear,
            money: false
        }
    ];

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div>
                <h1 className="text-2xl font-semibold">Reports</h1>
                <p className="text-sm text-muted-foreground">
                    {formatDashboardRangeLabel({
                        from: stats.from,
                        period,
                        to: stats.to
                    })}{' '}
                    in {stats.currency}.
                </p>
            </div>

            <DashboardPeriodNav
                basePath="/stats"
                date={anchorDateParam}
                period={period}
            />

            <div className="grid grid-cols-4 gap-2 sm:gap-4">
                {cards.map(card => (
                    <Card className="min-w-0" key={card.label}>
                        <CardHeader className="min-w-0 p-2 sm:p-4">
                            <CardDescription className="truncate text-xs">
                                {card.label}
                            </CardDescription>
                            <CardTitle
                                className={`truncate text-sm sm:text-xl ${card.className}`}
                            >
                                {card.value}
                            </CardTitle>
                            <div className="hidden flex-col gap-1 text-xs text-muted-foreground sm:flex">
                                <span>
                                    Previous period:{' '}
                                    <span
                                        className={amountClassNameForValue(
                                            card.previous
                                        )}
                                    >
                                        {card.money
                                            ? formatMoney(
                                                  card.previous,
                                                  stats.currency
                                              )
                                            : formatCountDelta(card.previous)}
                                    </span>
                                </span>
                                <span>
                                    Previous year:{' '}
                                    <span
                                        className={amountClassNameForValue(
                                            card.previousYear
                                        )}
                                    >
                                        {card.money
                                            ? formatMoney(
                                                  card.previousYear,
                                                  stats.currency
                                              )
                                            : formatCountDelta(
                                                  card.previousYear
                                              )}
                                    </span>
                                </span>
                            </div>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            <DashboardSwipeArea
                basePath="/stats"
                date={anchorDateParam}
                period={period}
                skeleton={<StatsChartsSkeleton />}
            >
                <StatsCharts stats={stats} />
            </DashboardSwipeArea>
        </div>
    );
}
