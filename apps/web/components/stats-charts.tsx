'use client';

import type { StatsOverview } from '@xpenser/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@xpenser/ui';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { formatMoney } from '@/lib/format';

const incomeColor = 'hsl(var(--primary))';
const expenseColor = 'hsl(var(--destructive))';
const netColor = 'hsl(var(--accent))';
const categoryColors = [
    'hsl(var(--primary))',
    'hsl(var(--accent))',
    'hsl(var(--destructive))',
    '#2563eb',
    '#7c3aed',
    '#0891b2'
];

type TooltipPayload = {
    readonly color?: string;
    readonly name?: string;
    readonly value?: number | string;
};

function ChartTooltip({
    active,
    label,
    payload,
    currency
}: {
    readonly active?: boolean;
    readonly label?: string | number;
    readonly payload?: readonly TooltipPayload[];
    readonly currency: string;
}) {
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
                                ? formatMoney(item.value, currency)
                                : item.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function normalize(values: readonly number[]): number[] {
    const max = Math.max(...values, 0);
    if (max <= 0) {
        return values.map(() => 0);
    }

    return values.map(value => Math.round((value / max) * 100));
}

function datatypeExpression(
    kind: 'b' | 'l',
    values: readonly number[]
): string {
    return `{${kind}:${normalize(values)
        .slice(-20)
        .map(value => Math.max(0, Math.min(100, value)))
        .join(',')}}`;
}

export function DatatypeChart({
    expression,
    className
}: {
    readonly expression: string;
    readonly className?: string;
}) {
    return (
        <span
            aria-hidden
            className={`datatype-chart text-2xl leading-none ${className ?? ''}`}
        >
            {expression}
        </span>
    );
}

export function StatsCharts({ stats }: { readonly stats: StatsOverview }) {
    const trend = stats.trend.map(item => ({
        label: item.label,
        Income: item.incomeTotal,
        Expenses: item.expenseTotal,
        Net: item.netTotal
    }));
    const expenseCategories = stats.byCategory
        .filter(category => category.type === 'expense')
        .slice(0, 6);
    const incomeCategories = stats.byCategory
        .filter(category => category.type === 'income')
        .slice(0, 6);

    return (
        <div className="grid gap-4 lg:grid-cols-2">
            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                        <CardTitle>Cashflow trend</CardTitle>
                        <DatatypeChart
                            expression={datatypeExpression(
                                'l',
                                stats.trend.map(item => item.netTotal)
                            )}
                        />
                    </div>
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
                                        Number(value).toLocaleString('en-US', {
                                            maximumFractionDigits: 0
                                        })
                                    }
                                    tickLine={false}
                                    width={44}
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
                    <div className="flex items-start justify-between gap-3">
                        <CardTitle>Income vs expenses</CardTitle>
                        <DatatypeChart
                            expression={datatypeExpression(
                                'b',
                                stats.trend.flatMap(item => [
                                    item.incomeTotal,
                                    item.expenseTotal
                                ])
                            )}
                        />
                    </div>
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
                                        Number(value).toLocaleString('en-US', {
                                            maximumFractionDigits: 0
                                        })
                                    }
                                    tickLine={false}
                                    width={44}
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
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                        <CardTitle>Expense mix</CardTitle>
                        <DatatypeChart
                            expression={`{p:${Math.round(
                                Math.min(100, Math.max(0, stats.savingsRate))
                            )}}`}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="h-64">
                            <ResponsiveContainer height="100%" width="100%">
                                <PieChart>
                                    <Pie
                                        data={expenseCategories}
                                        dataKey="total"
                                        innerRadius={54}
                                        nameKey="categoryName"
                                        outerRadius={92}
                                        paddingAngle={2}
                                    >
                                        {expenseCategories.map(
                                            (category, index) => (
                                                <Cell
                                                    fill={
                                                        categoryColors[
                                                            index %
                                                                categoryColors.length
                                                        ]
                                                    }
                                                    key={category.categoryId}
                                                />
                                            )
                                        )}
                                    </Pie>
                                    <Tooltip
                                        content={
                                            <ChartTooltip
                                                currency={stats.currency}
                                            />
                                        }
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-col gap-2">
                            {expenseCategories.map((category, index) => (
                                <div
                                    className="flex items-center justify-between gap-3 text-sm"
                                    key={category.categoryId}
                                >
                                    <span className="flex min-w-0 items-center gap-2">
                                        <span
                                            className="size-2 rounded-full"
                                            style={{
                                                background:
                                                    categoryColors[
                                                        index %
                                                            categoryColors.length
                                                    ]
                                            }}
                                        />
                                        <span className="truncate">
                                            {category.categoryName}
                                        </span>
                                    </span>
                                    <span className="font-medium">
                                        {category.share.toFixed(0)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Top income categories</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-3">
                        {incomeCategories.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No income recorded for this period.
                            </p>
                        ) : (
                            incomeCategories.map(category => (
                                <div key={category.categoryId}>
                                    <div className="mb-1 flex items-center justify-between text-sm">
                                        <span>{category.categoryName}</span>
                                        <span className="font-medium">
                                            {formatMoney(
                                                category.total,
                                                stats.currency
                                            )}
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted">
                                        <div
                                            className="h-2 rounded-full bg-primary"
                                            style={{
                                                width: `${Math.min(
                                                    100,
                                                    category.share
                                                )}%`
                                            }}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
