import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Field,
    FieldLabel,
    Input,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@xpenser/ui';
import { deleteTransactionAction } from '@/lib/actions';
import { getApiClient } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({
    searchParams
}: {
    readonly searchParams: Promise<{ readonly search?: string }>;
}) {
    const params = await searchParams;
    const client = await getApiClient();
    const transactions = await client.transactions.list({
        query: { search: params.search, page: 1, limit: 100, direction: 'desc' }
    });

    return (
        <div className="flex flex-col gap-5 sm:gap-6">
            <div>
                <h1 className="text-2xl font-semibold">Transactions</h1>
                <p className="text-sm text-muted-foreground">
                    Search and review all recorded income and expenses.
                </p>
            </div>
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle>Find transactions</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <Field className="w-full sm:max-w-sm">
                            <FieldLabel htmlFor="search">Search</FieldLabel>
                            <Input
                                defaultValue={params.search ?? ''}
                                id="search"
                                name="search"
                            />
                        </Field>
                        <Button
                            className="w-full sm:w-auto"
                            type="submit"
                            variant="outline"
                        >
                            Search
                        </Button>
                    </form>
                </CardContent>
            </Card>
            <div className="flex flex-col gap-3 sm:hidden">
                {transactions.items.length === 0 ? (
                    <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
                        No transactions found.
                    </div>
                ) : (
                    transactions.items.map(transaction => (
                        <article
                            className="rounded-lg border bg-card p-4"
                            key={transaction.id}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="truncate text-sm font-semibold">
                                        {transaction.categoryName}
                                    </h2>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary">
                                            {transaction.type}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {formatDateTime(
                                                transaction.occurredAt
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <form
                                    action={deleteTransactionAction}
                                    className="shrink-0"
                                >
                                    <input
                                        name="id"
                                        type="hidden"
                                        value={transaction.id}
                                    />
                                    <Button
                                        size="sm"
                                        type="submit"
                                        variant="ghost"
                                    >
                                        Delete
                                    </Button>
                                </form>
                            </div>
                            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Original
                                    </dt>
                                    <dd className="font-medium">
                                        {transaction.amount.toFixed(2)}{' '}
                                        {transaction.currency}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Reporting
                                    </dt>
                                    <dd className="font-medium">
                                        {transaction.defaultCurrencyAmount.toFixed(
                                            2
                                        )}{' '}
                                        {transaction.defaultCurrency}
                                    </dd>
                                </div>
                            </dl>
                        </article>
                    ))
                )}
            </div>
            <Card className="hidden sm:block">
                <CardContent className="pt-6">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Original</TableHead>
                                <TableHead>Reporting</TableHead>
                                <TableHead>When</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.items.map(transaction => (
                                <TableRow key={transaction.id}>
                                    <TableCell>
                                        {transaction.categoryName}
                                    </TableCell>
                                    <TableCell>{transaction.type}</TableCell>
                                    <TableCell>
                                        {transaction.amount.toFixed(2)}{' '}
                                        {transaction.currency}
                                    </TableCell>
                                    <TableCell>
                                        {transaction.defaultCurrencyAmount.toFixed(
                                            2
                                        )}{' '}
                                        {transaction.defaultCurrency}
                                    </TableCell>
                                    <TableCell>
                                        {formatDateTime(transaction.occurredAt)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <form action={deleteTransactionAction}>
                                            <input
                                                name="id"
                                                type="hidden"
                                                value={transaction.id}
                                            />
                                            <Button
                                                size="sm"
                                                type="submit"
                                                variant="ghost"
                                            >
                                                Delete
                                            </Button>
                                        </form>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
