import {
    Button,
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
    Field,
    FieldLabel,
    Input
} from '@xpenser/ui';
import { StatsCharts } from '@/components/stats-charts';
import { getApiClient } from '@/lib/api';
import {
    amountClassNameForType,
    amountClassNameForValue,
    formatDate,
    formatDirectionalMoney,
    formatMoney
} from '@/lib/format';

const groupByOptions = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' }
] as const;

const timeframeOptions = [
    { value: 'this-week', label: 'This week' },
    { value: 'last-7-days', label: 'Last 7 days' },
    { value: 'this-month', label: 'This month' },
    { value: 'last-month', label: 'Last month' },
    { value: 'last-30-days', label: 'Last 30 days' },
    { value: 'custom', label: 'Custom interval' }
] as const;

type GroupBy = (typeof groupByOptions)[number]['value'];
type Timeframe = (typeof timeframeOptions)[number]['value'];

type StatsSearchParams = {
    readonly groupBy?: string;
    readonly timeframe?: string;
    readonly from?: string;
    readonly to?: string;
};

function parseGroupBy(value?: string): GroupBy {
    return groupByOptions.some(option => option.value === value)
        ? (value as GroupBy)
        : 'day';
}

function parseTimeframe(value?: string): Timeframe {
    return timeframeOptions.some(option => option.value === value)
        ? (value as Timeframe)
        : 'this-month';
}

function parseDate(value?: string): Date | undefined {
    if (!value) {
        return undefined;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDateInput(value?: string): string {
    return value && !Number.isNaN(new Date(value).getTime()) ? value : '';
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
    readonly groupBy: GroupBy;
    readonly timeframe: Timeframe;
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
            value: formatDirectionalMoney(
                stats.incomeTotal,
                stats.currency,
                'income'
            ),
            className: amountClassNameForType('income'),
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
            value: formatDirectionalMoney(
                stats.expenseTotal,
                stats.currency,
                'expense'
            ),
            className: amountClassNameForType('expense'),
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
                <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[160px_180px_140px_140px_auto] lg:items-end">
                    <Field>
                        <FieldLabel htmlFor="groupBy">Group by</FieldLabel>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            defaultValue={groupBy}
                            id="groupBy"
                            name="groupBy"
                        >
                            {groupByOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="timeframe">Timeframe</FieldLabel>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            defaultValue={timeframe}
                            id="timeframe"
                            name="timeframe"
                        >
                            {timeframeOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                    {timeframe === 'custom' ? (
                        <>
                            <Field>
                                <FieldLabel htmlFor="from">From</FieldLabel>
                                <Input
                                    defaultValue={formatDateInput(params.from)}
                                    id="from"
                                    name="from"
                                    type="date"
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor="to">To</FieldLabel>
                                <Input
                                    defaultValue={formatDateInput(params.to)}
                                    id="to"
                                    name="to"
                                    type="date"
                                />
                            </Field>
                        </>
                    ) : null}
                    <Button type="submit" variant="outline">
                        Apply
                    </Button>
                </form>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map(card => (
                    <Card key={card.label}>
                        <CardHeader>
                            <CardDescription>{card.label}</CardDescription>
                            <CardTitle className={`text-xl ${card.className}`}>
                                {card.value}
                            </CardTitle>
                            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
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
