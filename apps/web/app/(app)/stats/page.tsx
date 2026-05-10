import { Card, CardDescription, CardHeader, CardTitle } from '@xpenser/ui';
import { StatsCharts } from '@/components/stats-charts';
import { getApiClient } from '@/lib/api';
import { formatDate, formatMoney, formatPercent } from '@/lib/format';

const periods = ['week', 'month', 'quarter', 'year'] as const;

function statCards(stats: Awaited<ReturnType<typeof getStats>>) {
    return [
        {
            label: 'Income',
            value: formatMoney(stats.incomeTotal, stats.currency),
            detail: `${stats.incomeCount} transactions`
        },
        {
            label: 'Expenses',
            value: formatMoney(stats.expenseTotal, stats.currency),
            detail: `${stats.expenseCount} transactions`
        },
        {
            label: 'Net',
            value: formatMoney(stats.netTotal, stats.currency),
            detail: `${formatPercent(stats.savingsRate)} savings rate`
        },
        {
            label: 'Average expense',
            value: formatMoney(stats.averageExpense, stats.currency),
            detail: stats.largestExpenseCategory
                ? `Top: ${stats.largestExpenseCategory}`
                : 'No expense category yet'
        }
    ];
}

async function getStats(period: (typeof periods)[number]) {
    const client = await getApiClient();
    return client.stats.overview({ query: { period } });
}

export const dynamic = 'force-dynamic';

export default async function StatsPage({
    searchParams
}: {
    readonly searchParams: Promise<{ readonly period?: string }>;
}) {
    const params = await searchParams;
    const period = periods.includes(params.period as (typeof periods)[number])
        ? (params.period as (typeof periods)[number])
        : 'month';
    const stats = await getStats(period);

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Stats</h1>
                    <p className="text-sm text-muted-foreground">
                        {formatDate(stats.from)} to {formatDate(stats.to)} in{' '}
                        {stats.currency}.
                    </p>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
                    {periods.map(item => (
                        <a
                            className="rounded-md border px-2 py-2 text-center text-sm capitalize hover:bg-muted sm:px-3 sm:py-1"
                            href={`/stats?period=${item}`}
                            key={item}
                        >
                            {item}
                        </a>
                    ))}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {statCards(stats).map(card => (
                    <Card key={card.label}>
                        <CardHeader>
                            <CardDescription>{card.label}</CardDescription>
                            <CardTitle className="text-xl">
                                {card.value}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                {card.detail}
                            </p>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            <StatsCharts stats={stats} />
        </div>
    );
}
