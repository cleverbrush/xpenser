'use client';

import type { StatsOverview } from '@xpenser/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@xpenser/ui';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import {
    hiddenAmountLabel,
    useAmountPrivacy
} from '@/components/amount-privacy';
import { formatMoney } from '@/lib/format';

const incomeColor = '#047857';
const expenseColor = '#be123c';
const netColor = 'hsl(var(--accent))';
const skeletonChartKeys = [
    'cashflow',
    'income-expenses',
    'cumulative-net',
    'transaction-volume'
] as const;

type TooltipPayload = {
    readonly color?: string;
    readonly name?: string;
    readonly value?: number | string;
};

function ChartTooltip({
    active,
    currency,
    label,
    payload,
    valueKind = 'money'
}: {
    readonly active?: boolean;
    readonly currency: string;
    readonly label?: string | number;
    readonly payload?: readonly TooltipPayload[];
    readonly valueKind?: 'count' | 'money';
}) {
    const { hideAmounts } = useAmountPrivacy();

    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-sm">
            <p className="mb-1 font-medium">{label}</p>
            <div className="flex flex-col gap-1">
                {payload.map(item => (
                    <div
                        className="flex items-center justify-between gap-4"
                        key={item.name}
                    >
                        <span style={{ color: item.color }}>{item.name}</span>
                        <span className="font-medium">
                            {typeof item.value === 'number'
                                ? valueKind === 'money'
                                    ? hideAmounts
                                        ? hiddenAmountLabel
                                        : formatMoney(item.value, currency)
                                    : item.value.toLocaleString('en-US')
                                : item.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function StatsChartsSkeleton() {
    return (
        <div aria-hidden className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
                {skeletonChartKeys.map(key => (
                    <div
                        className="rounded-lg border bg-card text-card-foreground shadow-sm"
                        key={key}
                    >
                        <div className="flex flex-col space-y-1.5 p-6">
                            <div className="h-6 w-36 rounded-md bg-muted" />
                        </div>
                        <div className="p-6 pt-0">
                            <div className="h-72 rounded-md bg-muted" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function StatsCharts({ stats }: { readonly stats: StatsOverview }) {
    const { hideAmounts } = useAmountPrivacy();
    let cumulativeNet = 0;
    const trend = stats.trend.map(item => {
        cumulativeNet += item.netTotal;
        return {
            label: item.label,
            Income: item.incomeTotal,
            Expenses: -item.expenseTotal,
            Net: item.netTotal,
            'Cumulative net': cumulativeNet,
            Transactions: item.transactionCount
        };
    });

    return (
        <div className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Cashflow trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-72">
                            <ResponsiveContainer height="100%" width="100%">
                                <LineChart data={trend}>
                                    <CartesianGrid
                                        stroke="hsl(var(--border))"
                                        strokeDasharray="3 3"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="label"
                                        fontSize={12}
                                        stroke="hsl(var(--muted-foreground))"
                                        tickLine={false}
                                    />
                                    <YAxis
                                        fontSize={12}
                                        stroke="hsl(var(--muted-foreground))"
                                        tickFormatter={value =>
                                            hideAmounts
                                                ? hiddenAmountLabel
                                                : Number(value).toLocaleString(
                                                      'en-US',
                                                      {
                                                          maximumFractionDigits: 0
                                                      }
                                                  )
                                        }
                                        tickLine={false}
                                        width={48}
                                    />
                                    <ReferenceLine
                                        stroke="hsl(var(--border))"
                                        y={0}
                                    />
                                    <Tooltip
                                        content={
                                            <ChartTooltip
                                                currency={stats.currency}
                                            />
                                        }
                                    />
                                    <Line
                                        dataKey="Net"
                                        dot={false}
                                        stroke={netColor}
                                        strokeWidth={3}
                                        type="monotone"
                                    />
                                    <Line
                                        dataKey="Income"
                                        dot={false}
                                        stroke={incomeColor}
                                        strokeWidth={2}
                                        type="monotone"
                                    />
                                    <Line
                                        dataKey="Expenses"
                                        dot={false}
                                        stroke={expenseColor}
                                        strokeWidth={2}
                                        type="monotone"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Income vs expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-72">
                            <ResponsiveContainer height="100%" width="100%">
                                <BarChart data={trend}>
                                    <CartesianGrid
                                        stroke="hsl(var(--border))"
                                        strokeDasharray="3 3"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="label"
                                        fontSize={12}
                                        stroke="hsl(var(--muted-foreground))"
                                        tickLine={false}
                                    />
                                    <YAxis
                                        fontSize={12}
                                        stroke="hsl(var(--muted-foreground))"
                                        tickFormatter={value =>
                                            hideAmounts
                                                ? hiddenAmountLabel
                                                : Number(value).toLocaleString(
                                                      'en-US',
                                                      {
                                                          maximumFractionDigits: 0
                                                      }
                                                  )
                                        }
                                        tickLine={false}
                                        width={48}
                                    />
                                    <ReferenceLine
                                        stroke="hsl(var(--border))"
                                        y={0}
                                    />
                                    <Tooltip
                                        content={
                                            <ChartTooltip
                                                currency={stats.currency}
                                            />
                                        }
                                    />
                                    <Bar
                                        dataKey="Income"
                                        fill={incomeColor}
                                        radius={[4, 4, 0, 0]}
                                    />
                                    <Bar
                                        dataKey="Expenses"
                                        fill={expenseColor}
                                        radius={[0, 0, 4, 4]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Cumulative net</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-72">
                            <ResponsiveContainer height="100%" width="100%">
                                <LineChart data={trend}>
                                    <CartesianGrid
                                        stroke="hsl(var(--border))"
                                        strokeDasharray="3 3"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="label"
                                        fontSize={12}
                                        stroke="hsl(var(--muted-foreground))"
                                        tickLine={false}
                                    />
                                    <YAxis
                                        fontSize={12}
                                        stroke="hsl(var(--muted-foreground))"
                                        tickFormatter={value =>
                                            hideAmounts
                                                ? hiddenAmountLabel
                                                : Number(value).toLocaleString(
                                                      'en-US',
                                                      {
                                                          maximumFractionDigits: 0
                                                      }
                                                  )
                                        }
                                        tickLine={false}
                                        width={48}
                                    />
                                    <ReferenceLine
                                        stroke="hsl(var(--border))"
                                        y={0}
                                    />
                                    <Tooltip
                                        content={
                                            <ChartTooltip
                                                currency={stats.currency}
                                            />
                                        }
                                    />
                                    <Line
                                        dataKey="Cumulative net"
                                        dot={false}
                                        stroke={netColor}
                                        strokeWidth={3}
                                        type="monotone"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Transaction volume</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-72">
                            <ResponsiveContainer height="100%" width="100%">
                                <BarChart data={trend}>
                                    <CartesianGrid
                                        stroke="hsl(var(--border))"
                                        strokeDasharray="3 3"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey="label"
                                        fontSize={12}
                                        stroke="hsl(var(--muted-foreground))"
                                        tickLine={false}
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        fontSize={12}
                                        stroke="hsl(var(--muted-foreground))"
                                        tickLine={false}
                                        width={48}
                                    />
                                    <Tooltip
                                        content={
                                            <ChartTooltip
                                                currency={stats.currency}
                                                valueKind="count"
                                            />
                                        }
                                    />
                                    <Bar
                                        dataKey="Transactions"
                                        fill="hsl(var(--accent))"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
