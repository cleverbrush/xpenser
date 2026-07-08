'use client';

import type {
    Category,
    Currency,
    Transaction,
    TransactionTag,
    Vendor
} from '@xpenser/contracts';
import { FieldLimits } from '@xpenser/contracts';
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
import {
    ImageIcon,
    PencilIcon,
    SlidersHorizontalIcon,
    Trash2Icon
} from 'lucide-react';
import Image from 'next/image';
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
    categoryEffectiveType,
    categoryTypeLabel
} from '@/lib/category-display';
import { dateParam } from '@/lib/dashboard-periods';
import {
    amountClassNameForTransaction,
    directionBadgeClassName,
    formatDateTime,
    signedAmountForTransaction
} from '@/lib/format';
import { transactionCurrencyOptions } from '@/lib/transaction-currencies';
import { transactionPageSize } from '@/lib/transaction-query';
import { AmountDisplay } from './amount-display';
import { DashboardViewSettingsMenu } from './dashboard-view-settings-menu';
import { TransactionDialog } from './transaction-dialog';
import { UserAvatar } from './user-avatar';
import { VendorLogo } from './vendor-display';

type TransactionFeedResponse = {
    readonly items: readonly Transaction[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly hasMore?: boolean;
};

function activeFilterCount(searchParams: URLSearchParams): number {
    const basicFilters = [
        'search',
        'type',
        'categoryId',
        'parentCategoryId',
        'vendorId',
        'from',
        'to'
    ].filter(key => Boolean(searchParams.get(key))).length;
    return (
        basicFilters +
        (searchParams.getAll('tagId').some(value => value.trim() !== '')
            ? 1
            : 0)
    );
}

function fieldValue(formData: FormData, key: string): string {
    const value = formData.get(key);
    return typeof value === 'string' ? value.trim() : '';
}

function shouldAutoExpandFilters(hasFilters: boolean): boolean {
    return (
        hasFilters &&
        typeof window !== 'undefined' &&
        window.matchMedia('(min-width: 640px)').matches
    );
}

function TransactionAmount({
    transaction
}: {
    readonly transaction: Transaction;
}) {
    return (
        <div className="flex flex-col gap-0.5">
            <span
                className={`font-medium ${amountClassNameForTransaction(
                    transaction.amount,
                    transaction.type,
                    transaction.categoryKind
                )}`}
            >
                <AmountDisplay
                    compact={false}
                    currency={transaction.currency}
                    value={signedAmountForTransaction(
                        transaction.amount,
                        transaction.type,
                        transaction.categoryKind
                    )}
                />
            </span>
            <span
                className={`text-xs ${amountClassNameForTransaction(
                    transaction.defaultCurrencyAmount,
                    transaction.type,
                    transaction.categoryKind
                )}`}
            >
                <AmountDisplay
                    compact={false}
                    currency={transaction.defaultCurrency}
                    value={signedAmountForTransaction(
                        transaction.defaultCurrencyAmount,
                        transaction.type,
                        transaction.categoryKind
                    )}
                />
            </span>
        </div>
    );
}

function imageSizeLabel(sizeBytes: number): string {
    return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
}

function ScanImageReviewButton({
    transaction
}: {
    readonly transaction: Transaction;
}) {
    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const attachment = transaction.scanAttachment;

    useEffect(() => {
        if (!open) {
            return;
        }
        setLoaded(false);
        setFailed(false);
    }, [open]);

    if (!attachment) {
        return null;
    }
    const imageSrc = `/app-api/transactions/${transaction.id}/scan-image`;

    return (
        <Dialog onOpenChange={setOpen} open={open}>
            <DialogTrigger asChild>
                <Button
                    className="h-6 gap-1 px-2 text-xs"
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    <ImageIcon aria-hidden className="size-3" />
                    Scanned
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Scanned image</DialogTitle>
                    <DialogDescription>
                        {attachment.fileName ?? 'Uploaded image'} -{' '}
                        {imageSizeLabel(attachment.sizeBytes)}
                    </DialogDescription>
                </DialogHeader>
                {!loaded && !failed ? (
                    <p className="text-sm text-muted-foreground">
                        Loading image...
                    </p>
                ) : null}
                {failed ? (
                    <p className="text-sm text-destructive">
                        Could not load scanned image.
                    </p>
                ) : null}
                <Image
                    alt={attachment.fileName ?? 'Scanned transaction source'}
                    className="max-h-[70vh] w-full rounded-md border object-contain"
                    height={900}
                    onError={() => setFailed(true)}
                    onLoad={() => setLoaded(true)}
                    src={imageSrc}
                    unoptimized
                    width={1200}
                />
            </DialogContent>
        </Dialog>
    );
}

function transactionBadges(transaction: Transaction) {
    return (
        <>
            <Badge
                className={directionBadgeClassName(transaction.type)}
                variant="outline"
            >
                {categoryTypeLabel(transaction.type)}
            </Badge>
            <ScanImageReviewButton transaction={transaction} />
        </>
    );
}

function transactionCreatorAvatar(
    transaction: Transaction,
    currentUserId: number
) {
    if (transaction.createdBy.userId === currentUserId) {
        return null;
    }

    return (
        <UserAvatar
            avatarUrl={transaction.createdBy.avatarUrl}
            className="size-6"
            email={transaction.createdBy.email || 'another user'}
            fallbackClassName="text-[0.65rem]"
        />
    );
}

function transactionVendor(transaction: Transaction) {
    if (!transaction.vendorName) {
        return null;
    }

    const content = (
        <>
            <VendorLogo
                vendor={{
                    displayName: transaction.vendorName,
                    logoUrl: transaction.vendorLogoUrl,
                    name: transaction.vendorName
                }}
                size="xs"
            />
            <span className="truncate">{transaction.vendorName}</span>
        </>
    );
    const className =
        'mt-1 flex items-center gap-2 text-xs text-muted-foreground';

    return transaction.vendorId ? (
        <Link
            className={`${className} transition-colors hover:text-foreground`}
            href={`/settings/vendors/${transaction.vendorId}`}
        >
            {content}
        </Link>
    ) : (
        <div className={className}>{content}</div>
    );
}

function transactionTagBadges(transaction: Transaction) {
    if (transaction.tags.length === 0) {
        return null;
    }

    return (
        <div className="mt-2 flex flex-wrap gap-1">
            {transaction.tags.map(tag => (
                <Badge key={tag.id} variant="secondary">
                    {tag.name}
                </Badge>
            ))}
        </div>
    );
}

function EditTransactionButton({
    categories,
    currencies,
    defaultCurrency,
    transactionTags,
    vendors,
    timezone,
    transaction
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly transactionTags: readonly TransactionTag[];
    readonly vendors: readonly Vendor[];
    readonly timezone: string;
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
            transactionTags={transactionTags}
            vendors={vendors}
            submitLabel="Save changes"
            title="Edit transaction"
            transactionId={transaction.id}
            timezone={timezone}
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
    timezone,
    transaction
}: {
    readonly timezone: string;
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
                        This will remove {transaction.categoryDisplayName} from{' '}
                        {formatDateTime(transaction.occurredAt, timezone)}.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button
                            className="w-full sm:w-auto"
                            type="button"
                            variant="outline"
                        >
                            Cancel
                        </Button>
                    </DialogClose>
                    <form
                        action={deleteTransactionAction}
                        className="w-full sm:w-auto"
                    >
                        <input name="id" type="hidden" value={transaction.id} />
                        <Button
                            className="w-full sm:w-auto"
                            type="submit"
                            variant="destructive"
                        >
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
    transactionTags,
    vendors,
    timezone,
    transaction
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly transactionTags: readonly TransactionTag[];
    readonly vendors: readonly Vendor[];
    readonly timezone: string;
    readonly transaction: Transaction;
}) {
    return (
        <div className="flex shrink-0 items-center justify-end gap-1">
            <EditTransactionButton
                categories={categories}
                currencies={currencies}
                defaultCurrency={defaultCurrency}
                transactionTags={transactionTags}
                vendors={vendors}
                timezone={timezone}
                transaction={transaction}
            />
            <DeleteTransactionButton
                timezone={timezone}
                transaction={transaction}
            />
        </div>
    );
}

function TransactionCards({
    categories,
    currencies,
    currentUserId,
    defaultCurrency,
    transactionTags: availableTransactionTags,
    vendors,
    timezone,
    transactions
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly currentUserId: number;
    readonly defaultCurrency: string;
    readonly transactionTags: readonly TransactionTag[];
    readonly vendors: readonly Vendor[];
    readonly timezone: string;
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
                                {transaction.categoryDisplayName}
                            </h2>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                {transactionBadges(transaction)}
                                {transactionCreatorAvatar(
                                    transaction,
                                    currentUserId
                                )}
                                <span className="text-xs text-muted-foreground">
                                    {formatDateTime(
                                        transaction.occurredAt,
                                        timezone
                                    )}
                                </span>
                            </div>
                        </div>
                        <TransactionActions
                            categories={categories}
                            currencies={currencies}
                            defaultCurrency={defaultCurrency}
                            transactionTags={availableTransactionTags}
                            vendors={vendors}
                            timezone={timezone}
                            transaction={transaction}
                        />
                    </div>
                    {transactionVendor(transaction)}
                    {transactionTagBadges(transaction)}
                    <div className="mt-3">
                        <TransactionAmount transaction={transaction} />
                    </div>
                </article>
            ))}
        </div>
    );
}

function TransactionTable({
    categories,
    currencies,
    currentUserId,
    defaultCurrency,
    transactionTags: availableTransactionTags,
    vendors,
    timezone,
    transactions
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly currentUserId: number;
    readonly defaultCurrency: string;
    readonly transactionTags: readonly TransactionTag[];
    readonly vendors: readonly Vendor[];
    readonly timezone: string;
    readonly transactions: readonly Transaction[];
}) {
    return (
        <Card className="hidden sm:block">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Tags</TableHead>
                            <TableHead>Creator</TableHead>
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
                                    {transaction.categoryDisplayName}
                                </TableCell>
                                <TableCell>
                                    {transactionVendor(transaction) ?? (
                                        <span className="text-xs text-muted-foreground">
                                            -
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {transactionTagBadges(transaction) ?? (
                                        <span className="text-xs text-muted-foreground">
                                            -
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {transactionCreatorAvatar(
                                        transaction,
                                        currentUserId
                                    ) ?? (
                                        <span className="text-xs text-muted-foreground">
                                            -
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-2">
                                        {transactionBadges(transaction)}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <TransactionAmount
                                        transaction={transaction}
                                    />
                                </TableCell>
                                <TableCell>
                                    {formatDateTime(
                                        transaction.occurredAt,
                                        timezone
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <TransactionActions
                                        categories={categories}
                                        currencies={currencies}
                                        defaultCurrency={defaultCurrency}
                                        transactionTags={
                                            availableTransactionTags
                                        }
                                        vendors={vendors}
                                        timezone={timezone}
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
    currentUserId,
    defaultCurrency,
    favoriteCurrencies,
    hasInitialFilters,
    vendors,
    transactionTags,
    initialResponse,
    transactionCurrencies,
    timezone
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly currentUserId: number;
    readonly defaultCurrency: string;
    readonly favoriteCurrencies: readonly string[];
    readonly hasInitialFilters: boolean;
    readonly vendors: readonly Vendor[];
    readonly transactionTags: readonly TransactionTag[];
    readonly initialResponse: TransactionFeedResponse;
    readonly transactionCurrencies: readonly string[];
    readonly timezone: string;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchKey = searchParams.toString();
    const [expanded, setExpanded] = useState(false);
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
    const exportHref = useMemo(() => {
        return searchKey
            ? `/app-api/transactions/export.csv?${searchKey}`
            : '/app-api/transactions/export.csv';
    }, [searchKey]);
    const dialogCurrencies = useMemo(
        () =>
            transactionCurrencyOptions(
                currencies,
                defaultCurrency,
                transactionCurrencies
            ),
        [currencies, defaultCurrency, transactionCurrencies]
    );

    useEffect(() => {
        setExpanded(shouldAutoExpandFilters(hasInitialFilters));
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
        for (const key of [
            'search',
            'type',
            'categoryId',
            'vendorId',
            'from',
            'to'
        ]) {
            const value = fieldValue(formData, key);
            if (value) {
                params.set(key, value);
            }
        }
        for (const value of formData.getAll('tagId')) {
            if (typeof value === 'string' && value.trim()) {
                params.append('tagId', value.trim());
            }
        }
        if (!params.has('categoryId')) {
            const parentCategoryId = searchParams.get('parentCategoryId');
            if (parentCategoryId) {
                params.set('parentCategoryId', parentCategoryId);
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
            const response = await fetch(`/app-api/transactions?${params}`, {
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
                    <div className="flex items-center gap-2">
                        {filters > 0 ? (
                            <Button asChild size="sm" variant="ghost">
                                <Link href="/transactions">Clear</Link>
                            </Button>
                        ) : null}
                        <DashboardViewSettingsMenu
                            basePath="/transactions"
                            currencies={currencies}
                            currentDate={dateParam(new Date(), timezone)}
                            defaultCurrency={defaultCurrency}
                            exportAction={{ href: exportHref }}
                            favoriteCurrencies={favoriteCurrencies}
                            period="day"
                            selectedCurrency={defaultCurrency}
                            showCurrencySelector={false}
                            timezone={timezone}
                        />
                    </div>
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
                                maxLength={FieldLimits.transactionSearch}
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
                                        {category.displayName} (
                                        {categoryTypeLabel(
                                            categoryEffectiveType(category)
                                        )}
                                        )
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field className="md:col-span-2">
                            <FieldLabel htmlFor="vendorId">Vendor</FieldLabel>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                defaultValue={
                                    searchParams.get('vendorId') ?? ''
                                }
                                id="vendorId"
                                name="vendorId"
                            >
                                <option value="">All vendors</option>
                                <option value="none">No vendor</option>
                                {vendors.map(vendor => (
                                    <option key={vendor.id} value={vendor.id}>
                                        {vendor.displayName}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field className="md:col-span-2">
                            <FieldLabel>Tags</FieldLabel>
                            <div className="flex min-h-10 flex-wrap gap-2 rounded-md border border-input px-3 py-2">
                                {transactionTags.length === 0 ? (
                                    <span className="text-sm text-muted-foreground">
                                        No tags yet
                                    </span>
                                ) : (
                                    transactionTags.map(tag => {
                                        const id = String(tag.id);
                                        return (
                                            <label
                                                className="flex items-center gap-1.5 text-sm"
                                                key={tag.id}
                                            >
                                                <input
                                                    className="size-4"
                                                    defaultChecked={searchParams
                                                        .getAll('tagId')
                                                        .includes(id)}
                                                    name="tagId"
                                                    type="checkbox"
                                                    value={id}
                                                />
                                                <span>{tag.name}</span>
                                            </label>
                                        );
                                    })
                                )}
                                <label className="flex items-center gap-1.5 text-sm">
                                    <input
                                        className="size-4"
                                        defaultChecked={
                                            searchParams.get('untagged') ===
                                            'true'
                                        }
                                        name="untagged"
                                        type="checkbox"
                                        value="true"
                                    />
                                    <span>Untagged</span>
                                </label>
                            </div>
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
                        currencies={dialogCurrencies}
                        currentUserId={currentUserId}
                        defaultCurrency={defaultCurrency}
                        transactionTags={transactionTags}
                        vendors={vendors}
                        timezone={timezone}
                        transactions={items}
                    />
                    <TransactionTable
                        categories={categories}
                        currencies={dialogCurrencies}
                        currentUserId={currentUserId}
                        defaultCurrency={defaultCurrency}
                        transactionTags={transactionTags}
                        vendors={vendors}
                        timezone={timezone}
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
