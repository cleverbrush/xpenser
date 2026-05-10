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
import {
    amountClassNameForType,
    directionBadgeClassName,
    formatDateTime,
    formatDirectionalMoney
} from '@/lib/format';

export const dynamic = 'force-dynamic';

type TransactionSearchParams = {
    readonly search?: string;
    readonly type?: string;
    readonly categoryId?: string;
    readonly from?: string;
    readonly to?: string;
};

function parseType(value?: string): 'expense' | 'income' | undefined {
    return value === 'expense' || value === 'income' ? value : undefined;
}

function parseId(value?: string): number | undefined {
    if (!value) {
        return undefined;
    }
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : undefined;
}

function parseDateFilter(
    value: string | undefined,
    boundary: 'end' | 'start'
): Date | undefined {
    if (!value) {
        return undefined;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return undefined;
    }
    if (boundary === 'start') {
        date.setHours(0, 0, 0, 0);
    } else {
        date.setHours(23, 59, 59, 999);
    }
    return date;
}

export default async function TransactionsPage({
    searchParams
}: {
    readonly searchParams: Promise<TransactionSearchParams>;
}) {
    const params = await searchParams;
    const client = await getApiClient();
    const type = parseType(params.type);
    const categoryId = parseId(params.categoryId);
    const [categories, transactions] = await Promise.all([
        client.categories.list(),
        client.transactions.list({
            query: {
                search: params.search,
                type,
                categoryId,
                from: parseDateFilter(params.from, 'start'),
                to: parseDateFilter(params.to, 'end'),
                page: 1,
                limit: 100,
                direction: 'desc'
            }
        })
    ]);
    const hasFilters = Boolean(
        params.search || type || categoryId || params.from || params.to
    );

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
                    <form className="grid gap-3 md:grid-cols-6 md:items-end">
                        <Field className="w-full sm:max-w-sm">
                            <FieldLabel htmlFor="search">Search</FieldLabel>
                            <Input
                                defaultValue={params.search ?? ''}
                                id="search"
                                name="search"
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="type">Type</FieldLabel>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                defaultValue={type ?? ''}
                                id="type"
                                name="type"
                            >
                                <option value="">All</option>
                                <option value="income">Income</option>
                                <option value="expense">Expense</option>
                            </select>
                        </Field>
                        <Field className="md:col-span-2">
                            <FieldLabel htmlFor="categoryId">
                                Category
                            </FieldLabel>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                defaultValue={categoryId ?? ''}
                                id="categoryId"
                                name="categoryId"
                            >
                                <option value="">All categories</option>
                                {categories.map(category => (
                                    <option
                                        key={category.id}
                                        value={category.id}
                                    >
                                        {category.name} ({category.type})
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="from">From</FieldLabel>
                            <Input
                                defaultValue={params.from ?? ''}
                                id="from"
                                name="from"
                                type="date"
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="to">To</FieldLabel>
                            <Input
                                defaultValue={params.to ?? ''}
                                id="to"
                                name="to"
                                type="date"
                            />
                        </Field>
                        <Button
                            className="w-full md:w-auto"
                            type="submit"
                            variant="outline"
                        >
                            Apply
                        </Button>
                        {hasFilters ? (
                            <Button
                                asChild
                                className="w-full md:w-auto"
                                variant="ghost"
                            >
                                <a href="/transactions">Clear</a>
                            </Button>
                        ) : null}
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
                                        <Badge
                                            className={directionBadgeClassName(
                                                transaction.type
                                            )}
                                            variant="outline"
                                        >
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
                                    <dd
                                        className={`font-medium ${amountClassNameForType(transaction.type)}`}
                                    >
                                        {formatDirectionalMoney(
                                            transaction.amount,
                                            transaction.currency,
                                            transaction.type
                                        )}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs text-muted-foreground">
                                        Reporting
                                    </dt>
                                    <dd
                                        className={`font-medium ${amountClassNameForType(transaction.type)}`}
                                    >
                                        {formatDirectionalMoney(
                                            transaction.defaultCurrencyAmount,
                                            transaction.defaultCurrency,
                                            transaction.type
                                        )}
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
                                    <TableCell>
                                        <Badge
                                            className={directionBadgeClassName(
                                                transaction.type
                                            )}
                                            variant="outline"
                                        >
                                            {transaction.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell
                                        className={amountClassNameForType(
                                            transaction.type
                                        )}
                                    >
                                        {formatDirectionalMoney(
                                            transaction.amount,
                                            transaction.currency,
                                            transaction.type
                                        )}
                                    </TableCell>
                                    <TableCell
                                        className={amountClassNameForType(
                                            transaction.type
                                        )}
                                    >
                                        {formatDirectionalMoney(
                                            transaction.defaultCurrencyAmount,
                                            transaction.defaultCurrency,
                                            transaction.type
                                        )}
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
