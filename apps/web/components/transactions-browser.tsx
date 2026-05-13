'use client';

import type { Category, Currency, Transaction } from '@xpenser/contracts';
import {
    Badge,
    Button,
    Card,
    CardContent,
    cn,
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
import { PencilIcon, SlidersHorizontalIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    type FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import {
    deleteTransactionAction,
    updateTransactionAction
} from '@/lib/actions';
import { expiredSessionPath } from '@/lib/auth-routes';
import {
    amountClassNameForType,
    directionBadgeClassName,
    formatDateTime,
    formatDirectionalMoney
} from '@/lib/format';
import { transactionPageSize } from '@/lib/transaction-query';
import { TransactionDialog } from './transaction-dialog';

type TransactionFeedResponse = {
    readonly items: readonly Transaction[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly hasMore?: boolean;
};

function activeFilterCount(searchParams: URLSearchParams): number {
    return ['search', 'type', 'categoryId', 'from', 'to'].filter(key =>
        Boolean(searchParams.get(key))
    ).length;
}

function fieldValue(formData: FormData, key: string): string {
    const value = formData.get(key);
    return typeof value === 'string' ? value.trim() : '';
}

function transactionAmount(transaction: Transaction) {
    return (
        <div className="flex flex-col gap-0.5">
            <span
                className={`font-medium ${amountClassNameForType(transaction.type)}`}
            >
                {formatDirectionalMoney(
                    transaction.amount,
                    transaction.currency,
                    transaction.type
                )}
            </span>
            <span
                className={`text-xs ${amountClassNameForType(transaction.type)}`}
            >
                {formatDirectionalMoney(
                    transaction.defaultCurrencyAmount,
                    transaction.defaultCurrency,
                    transaction.type
                )}
            </span>
        </div>
    );
}

function EditTransactionButton({
    categories,
    currencies,
    defaultCurrency,
    transaction
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly transaction: Transaction;
}) {
    return (
        <TransactionDialog
            action={updateTransactionAction}
            categories={categories}
            currencies={currencies}
            defaultCurrency={defaultCurrency}
            description="Update the transaction details and converted report values."
            errorMessage="Could not update the transaction."
            initialValues={transaction}
            submitLabel="Save changes"
            title="Edit transaction"
            transactionId={transaction.id}
            trigger={
                <Button
                    aria-label="Edit transaction"
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                >
                    <PencilIcon aria-hidden className="size-4" />
                </Button>
            }
        />
    );
}

function DeleteTransactionButton({
    transaction
}: {
    readonly transaction: Transaction;
}) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    aria-label="Delete transaction"
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                >
                    <Trash2Icon aria-hidden className="size-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete transaction?</DialogTitle>
                    <DialogDescription>
                        This will remove {transaction.categoryName} from{' '}
                        {formatDateTime(transaction.occurredAt)}.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline">
                            Cancel
                        </Button>
                    </DialogClose>
                    <form action={deleteTransactionAction}>
                        <input name="id" type="hidden" value={transaction.id} />
                        <Button type="submit" variant="destructive">
                            Delete
                        </Button>
                    </form>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TransactionActions({
    categories,
    currencies,
    defaultCurrency,
    transaction
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly transaction: Transaction;
}) {
    return (
        <div className="flex shrink-0 items-center justify-end gap-1">
            <EditTransactionButton
                categories={categories}
                currencies={currencies}
                defaultCurrency={defaultCurrency}
                transaction={transaction}
            />
            <DeleteTransactionButton transaction={transaction} />
        </div>
    );
}

function TransactionCards({
    categories,
    currencies,
    defaultCurrency,
    transactions
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly transactions: readonly Transaction[];
}) {
    return (
        <div className="flex flex-col gap-2 sm:hidden">
            {transactions.map(transaction => (
                <article
                    className="rounded-md border bg-card p-3"
                    key={transaction.id}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="truncate text-sm font-semibold">
                                {transaction.categoryName}
                            </h2>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge
                                    className={directionBadgeClassName(
                                        transaction.type
                                    )}
                                    variant="outline"
                                >
                                    {transaction.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                    {formatDateTime(transaction.occurredAt)}
                                </span>
                            </div>
                        </div>
                        <TransactionActions
                            categories={categories}
                            currencies={currencies}
                            defaultCurrency={defaultCurrency}
                            transaction={transaction}
                        />
                    </div>
                    <div className="mt-3">{transactionAmount(transaction)}</div>
                </article>
            ))}
        </div>
    );
}

function TransactionTable({
    categories,
    currencies,
    defaultCurrency,
    transactions
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly transactions: readonly Transaction[];
}) {
    return (
        <Card className="hidden sm:block">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>When</TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map(transaction => (
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
                                <TableCell>
                                    {transactionAmount(transaction)}
                                </TableCell>
                                <TableCell>
                                    {formatDateTime(transaction.occurredAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <TransactionActions
                                        categories={categories}
                                        currencies={currencies}
                                        defaultCurrency={defaultCurrency}
                                        transaction={transaction}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

export function TransactionsBrowser({
    categories,
    currencies,
    defaultCurrency,
    hasInitialFilters,
    initialResponse
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly hasInitialFilters: boolean;
    readonly initialResponse: TransactionFeedResponse;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchKey = searchParams.toString();
    const [expanded, setExpanded] = useState(hasInitialFilters);
    const [items, setItems] = useState<readonly Transaction[]>(
        initialResponse.items
    );
    const [page, setPage] = useState(initialResponse.page);
    const [total, setTotal] = useState(initialResponse.total);
    const [hasMore, setHasMore] = useState(
        initialResponse.hasMore ??
            initialResponse.page * initialResponse.limit < initialResponse.total
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const loadingRef = useRef(false);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const filters = useMemo(
        () => activeFilterCount(new URLSearchParams(searchKey)),
        [searchKey]
    );

    useEffect(() => {
        setExpanded(hasInitialFilters);
        setItems(initialResponse.items);
        setPage(initialResponse.page);
        setTotal(initialResponse.total);
        setHasMore(
            initialResponse.hasMore ??
                initialResponse.page * initialResponse.limit <
                    initialResponse.total
        );
        setError(null);
    }, [hasInitialFilters, initialResponse]);

    function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        const params = new URLSearchParams();
        for (const key of ['search', 'type', 'categoryId', 'from', 'to']) {
            const value = fieldValue(formData, key);
            if (value) {
                params.set(key, value);
            }
        }

        const next = params.toString();
        router.push(next ? `${pathname}?${next}` : pathname);
    }

    const fetchNextPage = useCallback(async () => {
        if (loadingRef.current || !hasMore) {
            return;
        }

        loadingRef.current = true;
        setLoading(true);
        setError(null);
        const params = new URLSearchParams(searchKey);
        params.set('page', String(page + 1));
        params.set('limit', String(transactionPageSize));
        params.set('direction', 'desc');

        try {
            const response = await fetch(`/api/transactions?${params}`, {
                cache: 'no-store'
            });
            if (response.status === 401) {
                window.location.assign(expiredSessionPath);
                return;
            }
            if (!response.ok) {
                throw new Error('Could not load more transactions.');
            }

            const next = (await response.json()) as TransactionFeedResponse & {
                readonly hasMore: boolean;
            };
            setItems(current => {
                const ids = new Set(current.map(transaction => transaction.id));
                return [
                    ...current,
                    ...next.items.filter(
                        transaction => !ids.has(transaction.id)
                    )
                ];
            });
            setPage(next.page);
            setTotal(next.total);
            setHasMore(next.hasMore);
        } catch {
            setError('Could not load more transactions.');
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, [hasMore, page, searchKey]);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !hasMore) {
            return;
        }

        const observer = new IntersectionObserver(
            entries => {
                if (entries.some(entry => entry.isIntersecting)) {
                    void fetchNextPage();
                }
            },
            { rootMargin: '240px' }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [fetchNextPage, hasMore]);

    return (
        <div className="flex flex-col gap-4">
            <section className="rounded-md border bg-card">
                <div className="flex items-center justify-between gap-2 p-3">
                    <Button
                        aria-expanded={expanded}
                        className="w-auto"
                        onClick={() => setExpanded(current => !current)}
                        size="sm"
                        type="button"
                        variant="ghost"
                    >
                        <SlidersHorizontalIcon aria-hidden className="size-4" />
                        Filters
                        {filters > 0 ? (
                            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                                {filters}
                            </span>
                        ) : null}
                    </Button>
                    {filters > 0 ? (
                        <Button asChild size="sm" variant="ghost">
                            <Link href="/transactions">Clear</Link>
                        </Button>
                    ) : null}
                </div>
                {expanded ? (
                    <form
                        className="grid gap-3 border-t p-3 md:grid-cols-6 md:items-end"
                        key={searchKey}
                        noValidate
                        onSubmit={handleFilterSubmit}
                    >
                        <Field className="w-full md:col-span-2">
                            <FieldLabel htmlFor="search">Search</FieldLabel>
                            <Input
                                defaultValue={searchParams.get('search') ?? ''}
                                id="search"
                                name="search"
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="type">Type</FieldLabel>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                defaultValue={searchParams.get('type') ?? ''}
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
                                defaultValue={
                                    searchParams.get('categoryId') ?? ''
                                }
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
                                defaultValue={searchParams.get('from') ?? ''}
                                id="from"
                                name="from"
                                type="date"
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="to">To</FieldLabel>
                            <Input
                                defaultValue={searchParams.get('to') ?? ''}
                                id="to"
                                name="to"
                                type="date"
                            />
                        </Field>
                        <Button
                            className="w-full md:w-auto"
                            size="sm"
                            type="submit"
                            variant="outline"
                        >
                            Apply
                        </Button>
                    </form>
                ) : null}
            </section>

            {items.length === 0 ? (
                <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
                    No transactions found.
                </div>
            ) : (
                <>
                    <TransactionCards
                        categories={categories}
                        currencies={currencies}
                        defaultCurrency={defaultCurrency}
                        transactions={items}
                    />
                    <TransactionTable
                        categories={categories}
                        currencies={currencies}
                        defaultCurrency={defaultCurrency}
                        transactions={items}
                    />
                </>
            )}

            <div
                aria-hidden
                className={cn('h-8', !hasMore && 'hidden')}
                ref={sentinelRef}
            />
            {loading ? (
                <p className="text-center text-sm text-muted-foreground">
                    Loading more transactions...
                </p>
            ) : null}
            {error ? (
                <p className="text-center text-sm text-destructive">{error}</p>
            ) : null}
            {!hasMore && items.length > 0 ? (
                <p className="text-center text-xs text-muted-foreground">
                    {items.length} of {total} transactions loaded.
                </p>
            ) : null}
        </div>
    );
}
