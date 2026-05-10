'use client';

import type { StatsOverview } from '@xpenser/contracts';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@xpenser/ui';
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
    amountClassNameForType,
    amountClassNameForValue,
    directionBadgeClassName,
    formatDirectionalMoney,
    formatMoney
} from '@/lib/format';

const incomeColor = '#047857';
const expenseColor = '#be123c';
const netColor = 'hsl(var(--accent))';

type TooltipPayload = {
    readonly color?: string;
    readonly name?: string;
    readonly value?: number | string;
};

type StatsCategory = StatsOverview['byCategory'][number];

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
    const magnitudes = values.map(value => Math.abs(value));
    const max = Math.max(...magnitudes, 0);
    if (max <= 0) {
        return values.map(() => 0);
    }

    return magnitudes.map(value => Math.round((value / max) * 100));
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

function dateParam(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function transactionHref(
    stats: StatsOverview,
    category: StatsCategory
): string {
    const params = new URLSearchParams({
        type: category.type,
        categoryId: String(category.categoryId),
        from: dateParam(stats.from),
        to: dateParam(stats.to)
    });
    return `/transactions?${params.toString()}`;
}

function comparisonDelta(
    category: StatsCategory,
    field: 'previousPeriodTotal' | 'previousYearTotal'
): number {
    return category.type === 'expense'
        ? category[field] - category.total
        : category.total - category[field];
}

function CategorySection({
    title,
    type,
    total,
    count,
    categories,
    stats
}: {
    readonly title: string;
    readonly type: 'expense' | 'income';
    readonly total: number;
    readonly count: number;
    readonly categories: readonly StatsCategory[];
    readonly stats: StatsOverview;
}) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <CardTitle>{title}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {count} transactions
                        </p>
                    </div>
                    <div className="text-right">
                        <p
                            className={`text-lg font-semibold ${amountClassNameForType(type)}`}
                        >
                            {formatDirectionalMoney(
                                total,
                                stats.currency,
                                type
                            )}
                        </p>
                        <Badge
                            className={directionBadgeClassName(type)}
                            variant="outline"
                        >
                            subtotal
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col divide-y">
                    {categories.length === 0 ? (
                        <p className="py-4 text-sm text-muted-foreground">
                            No {type} activity for this report.
                        </p>
                    ) : (
                        categories.map(category => {
                            const previousDelta = comparisonDelta(
                                category,
                                'previousPeriodTotal'
                            );
                            const yearDelta = comparisonDelta(
                                category,
                                'previousYearTotal'
                            );

                            return (
                                <a
                                    className="grid gap-3 py-4 text-sm transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_120px_180px] sm:px-2"
                                    href={transactionHref(stats, category)}
                                    key={`${category.type}-${category.categoryId}`}
                                >
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 items-center gap-2">
                                            <Badge
                                                className={directionBadgeClassName(
                                                    category.type
                                                )}
                                                variant="outline"
                                            >
                                                {category.type}
                                            </Badge>
                                            <p className="truncate font-medium">
                                                {category.categoryName}
                                            </p>
                                        </div>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {category.transactionCount}{' '}
                                            transactions,{' '}
                                            {category.share.toFixed(0)}%
                                        </p>
                                    </div>
                                    <div className="flex items-center sm:justify-center">
                                        <DatatypeChart
                                            className={amountClassNameForType(
                                                category.type
                                            )}
                                            expression={datatypeExpression(
                                                'l',
                                                category.trend
                                            )}
                                        />
                                    </div>
                                    <div className="text-left sm:text-right">
                                        <p
                                            className={`font-semibold ${amountClassNameForType(
                                                category.type
                                            )}`}
                                        >
                                            {formatDirectionalMoney(
                                                category.total,
                                                stats.currency,
                                                category.type
                                            )}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Prev:{' '}
                                            <span
                                                className={amountClassNameForValue(
                                                    previousDelta
                                                )}
                                            >
                                                {formatMoney(
                                                    previousDelta,
                                                    stats.currency
                                                )}
                                            </span>
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Year:{' '}
                                            <span
                                                className={amountClassNameForValue(
                                                    yearDelta
                                                )}
                                            >
                                                {formatMoney(
                                                    yearDelta,
                                                    stats.currency
                                                )}
                                            </span>
                                        </p>
                                    </div>
                                </a>
                            );
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export function StatsCharts({ stats }: { readonly stats: StatsOverview }) {
    const trend = stats.trend.map(item => ({
        label: item.label,
        Income: item.incomeTotal,
        Expenses: -item.expenseTotal,
        Net: item.netTotal,
        transactions: item.transactionCount
    }));
    const expenseCategories = stats.byCategory.filter(
        category => category.type === 'expense'
    );
    const incomeCategories = stats.byCategory.filter(
        category => category.type === 'income'
    );

    return (
        <div className="grid gap-4">
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
                                            Number(value).toLocaleString(
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
                                            Number(value).toLocaleString(
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

            <div className="grid gap-4 xl:grid-cols-2">
                <CategorySection
                    categories={incomeCategories}
                    count={stats.incomeCount}
                    stats={stats}
                    title="Income categories"
                    total={stats.incomeTotal}
                    type="income"
                />
                <CategorySection
                    categories={expenseCategories}
                    count={stats.expenseCount}
                    stats={stats}
                    title="Expense categories"
                    total={stats.expenseTotal}
                    type="expense"
                />
            </div>
        </div>
    );
}
