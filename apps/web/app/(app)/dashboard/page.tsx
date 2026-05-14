import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@xpenser/ui';
import { redirect } from 'next/navigation';
import { AddTransactionDialog } from '@/components/add-transaction-dialog';
import { AmountDisplay } from '@/components/amount-display';
import { DashboardPeriodNav } from '@/components/dashboard-period-nav';
import { getApiClient } from '@/lib/api';
import {
    dateParam,
    formatDashboardRangeLabel,
    isDashboardPeriod,
    parseDateParam
} from '@/lib/dashboard-periods';
import {
    amountClassNameForCategoryTotal,
    amountClassNameForTransaction,
    amountClassNameForValue,
    formatDateTime,
    formatTransactionMoney,
    signedCategoryTotal
} from '@/lib/format';

type DashboardSearchParams = {
    readonly date?: string;
    readonly period?: string;
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
    searchParams
}: {
    readonly searchParams: Promise<DashboardSearchParams>;
}) {
    const params = await searchParams;
    const period = isDashboardPeriod(params.period) ? params.period : 'day';
    const selectedDate = parseDateParam(params.date);
    const anchorDate = selectedDate ?? new Date();
    const anchorDateParam = dateParam(anchorDate);
    const client = await getApiClient();
    const [me, categories, currencies, summary] = await Promise.all([
        client.auth.me(),
        client.categories.list(),
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

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-semibold">Dashboard</h1>
                    <p className="text-sm text-muted-foreground">
                        {formatDashboardRangeLabel({
                            from: summary.from,
                            period,
                            to: summary.to
                        })}{' '}
                        in {summary.currency}.
                    </p>
                </div>
                <div className="shrink-0">
                    <AddTransactionDialog
                        categories={categories}
                        currencies={currencies}
                        defaultCurrency={me.defaultCurrency}
                    />
                </div>
            </div>
            <DashboardPeriodNav date={anchorDateParam} period={period} />
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
            <div>
                <section className="sm:hidden">
                    <h2 className="mb-3 text-base font-semibold">
                        Transactions
                    </h2>
                    <div className="divide-y rounded-lg border bg-card">
                        {summary.latestTransactions.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground">
                                No transactions for this period.
                            </div>
                        ) : (
                            summary.latestTransactions.map(transaction => (
                                <div
                                    className="flex items-center justify-between gap-3 p-4"
                                    key={transaction.id}
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">
                                            {transaction.categoryName}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {formatDateTime(
                                                transaction.occurredAt
                                            )}
                                        </p>
                                    </div>
                                    <p
                                        className={`shrink-0 text-sm font-semibold ${amountClassNameForTransaction(
                                            transaction.amount,
                                            transaction.type,
                                            transaction.effect
                                        )}`}
                                    >
                                        {formatTransactionMoney(
                                            transaction.amount,
                                            transaction.currency,
                                            transaction.type,
                                            transaction.effect
                                        )}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </section>
                <Card className="hidden sm:block">
                    <CardHeader>
                        <CardTitle>Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>When</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summary.latestTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            className="text-muted-foreground"
                                            colSpan={3}
                                        >
                                            No transactions for this period.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    summary.latestTransactions.map(
                                        transaction => (
                                            <TableRow key={transaction.id}>
                                                <TableCell>
                                                    {transaction.categoryName}
                                                </TableCell>
                                                <TableCell
                                                    className={amountClassNameForTransaction(
                                                        transaction.amount,
                                                        transaction.type,
                                                        transaction.effect
                                                    )}
                                                >
                                                    {formatTransactionMoney(
                                                        transaction.amount,
                                                        transaction.currency,
                                                        transaction.type,
                                                        transaction.effect
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {formatDateTime(
                                                        transaction.occurredAt
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    )
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
