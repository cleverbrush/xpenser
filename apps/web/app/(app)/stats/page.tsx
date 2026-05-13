import { Card, CardDescription, CardHeader, CardTitle } from '@xpenser/ui';
import { ReportsFilters } from '@/components/reports-filters';
import { StatsCharts } from '@/components/stats-charts';
import { getApiClient } from '@/lib/api';
import {
    amountClassNameForCategoryTotal,
    amountClassNameForValue,
    formatCategoryTotalMoney,
    formatDate,
    formatMoney
} from '@/lib/format';
import {
    isReportGroupBy,
    isReportTimeframe,
    type ReportGroupBy,
    type ReportTimeframe
} from '@/lib/report-filters';

type StatsSearchParams = {
    readonly groupBy?: string;
    readonly timeframe?: string;
    readonly from?: string;
    readonly to?: string;
};

function parseGroupBy(value?: string): ReportGroupBy {
    return isReportGroupBy(value) ? value : 'day';
}

function parseTimeframe(value?: string): ReportTimeframe {
    return isReportTimeframe(value) ? value : 'this-month';
}

function parseDate(value?: string): Date | undefined {
    if (!value) {
        return undefined;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
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

async function getStats({
    groupBy,
    timeframe,
    from,
    to
}: {
    readonly groupBy: ReportGroupBy;
    readonly timeframe: ReportTimeframe;
    readonly from?: string;
    readonly to?: string;
}) {
    const client = await getApiClient();
    return client.stats.overview({
        query: {
            groupBy,
            timeframe,
            from: parseDate(from),
            to: parseDate(to)
        }
    });
}

export const dynamic = 'force-dynamic';

export default async function StatsPage({
    searchParams
}: {
    readonly searchParams: Promise<StatsSearchParams>;
}) {
    const params = await searchParams;
    const groupBy = parseGroupBy(params.groupBy);
    const timeframe = parseTimeframe(params.timeframe);
    const stats = await getStats({
        groupBy,
        timeframe,
        from: params.from,
        to: params.to
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
            value: formatCategoryTotalMoney(
                stats.incomeTotal,
                stats.currency,
                'income'
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
            value: formatCategoryTotalMoney(
                stats.expenseTotal,
                stats.currency,
                'expense'
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
            value: formatMoney(stats.netTotal, stats.currency),
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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Reports</h1>
                    <p className="text-sm text-muted-foreground">
                        {formatDate(stats.from)} to {formatDate(stats.to)} in{' '}
                        {stats.currency}.
                    </p>
                </div>
                <ReportsFilters
                    from={params.from}
                    groupBy={groupBy}
                    timeframe={timeframe}
                    to={params.to}
                />
            </div>

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

            <StatsCharts stats={stats} />
        </div>
    );
}
