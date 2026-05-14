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
import { AmountDisplay } from '@/components/amount-display';
import {
    amountClassNameForCategoryTotal,
    amountClassNameForValue,
    formatMoney,
    signedCategoryTotal
} from '@/lib/format';
import { DatatypeChart, datatypeExpression } from './datatype-chart';

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

function CategoryRow({
    category,
    stats
}: {
    readonly category: StatsCategory;
    readonly stats: StatsOverview;
}) {
    const previousDelta = comparisonDelta(category, 'previousPeriodTotal');
    const yearDelta = comparisonDelta(category, 'previousYearTotal');

    return (
        <a
            className="grid grid-cols-[minmax(0,1fr)_auto_74px] items-center gap-3 py-3 text-sm transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_auto_110px] sm:px-2"
            href={transactionHref(stats, category)}
        >
            <span className="min-w-0 truncate font-medium">
                {category.categoryName}
            </span>
            <span className="min-w-0 text-right">
                <span
                    className={`font-semibold ${amountClassNameForCategoryTotal(
                        category.total,
                        category.type
                    )}`}
                >
                    <AmountDisplay
                        currency={stats.currency}
                        value={signedCategoryTotal(
                            category.total,
                            category.type
                        )}
                    />
                </span>
                <span className="ml-2 hidden text-xs text-muted-foreground md:inline">
                    P{' '}
                    <AmountDisplay
                        className={amountClassNameForValue(previousDelta)}
                        currency={stats.currency}
                        value={previousDelta}
                    />
                    , Y{' '}
                    <AmountDisplay
                        className={amountClassNameForValue(yearDelta)}
                        currency={stats.currency}
                        value={yearDelta}
                    />
                </span>
            </span>
            <span className="flex justify-end">
                <DatatypeChart
                    className={`text-xl ${amountClassNameForCategoryTotal(
                        category.total,
                        category.type
                    )}`}
                    expression={datatypeExpression('l', category.trend)}
                />
            </span>
        </a>
    );
}

function CategoryGroup({
    title,
    categories,
    stats
}: {
    readonly title: string;
    readonly categories: readonly StatsCategory[];
    readonly stats: StatsOverview;
}) {
    return (
        <div>
            <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                {title}
            </h3>
            <div className="flex flex-col divide-y">
                {categories.length === 0 ? (
                    <p className="py-3 text-sm text-muted-foreground">
                        No activity for this report.
                    </p>
                ) : (
                    categories.map(category => (
                        <CategoryRow
                            category={category}
                            key={`${category.type}-${category.categoryId}`}
                            stats={stats}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function CategoriesCard({
    incomeCategories,
    expenseCategories,
    stats
}: {
    readonly incomeCategories: readonly StatsCategory[];
    readonly expenseCategories: readonly StatsCategory[];
    readonly stats: StatsOverview;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">
                    <CategoryGroup
                        categories={incomeCategories}
                        stats={stats}
                        title="Income"
                    />
                    <CategoryGroup
                        categories={expenseCategories}
                        stats={stats}
                        title="Expenses"
                    />
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

            <CategoriesCard
                expenseCategories={expenseCategories}
                incomeCategories={incomeCategories}
                stats={stats}
            />
        </div>
    );
}
