'use client';

import type { Category, Currency, Transaction } from '@xpenser/contracts';
import {
    dateToLocalDateTimeInput,
    localDateTimeInputToDate
} from '@xpenser/timezone';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    cn,
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
    Input,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@xpenser/ui';
import {
    CheckCircle2Icon,
    ChevronDownIcon,
    RotateCcwIcon,
    SaveIcon
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState } from 'react';
import {
    createCaptureTransactionAction,
    deleteTransactionAction
} from '@/lib/actions';
import {
    directionBadgeClassName,
    formatDateTime,
    formatTransactionMoney
} from '@/lib/format';
import { transactionCurrencyOptions } from '@/lib/transaction-currencies';

type TransactionType = Category['type'];
type TransactionEffect = Transaction['effect'];

function initialType(categories: readonly Category[]): TransactionType {
    return categories.some(category => category.type === 'expense')
        ? 'expense'
        : (categories[0]?.type ?? 'expense');
}

function firstCategoryId(
    categories: readonly Category[],
    type: TransactionType
): number | undefined {
    return categories.find(category => category.type === type)?.id;
}

function firstCurrency(
    currencies: readonly Currency[],
    defaultCurrency: string
): string {
    return currencies[0]?.code ?? defaultCurrency;
}

function savedSummary(transaction: Transaction, timezone: string) {
    return `${transaction.categoryName} - ${formatTransactionMoney(
        transaction.amount,
        transaction.currency,
        transaction.type,
        transaction.effect
    )} - ${formatDateTime(transaction.occurredAt, timezone)}`;
}

export function QuickCaptureForm({
    categories,
    currencies,
    defaultCurrency,
    timezone,
    transactionCurrencies
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly timezone: string;
    readonly transactionCurrencies: readonly string[];
}) {
    const router = useRouter();
    const currencyOptions = useMemo(
        () =>
            transactionCurrencyOptions(
                currencies,
                defaultCurrency,
                transactionCurrencies
            ),
        [currencies, defaultCurrency, transactionCurrencies]
    );
    const startingType = useMemo(() => initialType(categories), [categories]);
    const [type, setType] = useState<TransactionType>(startingType);
    const [categoryId, setCategoryId] = useState<number | undefined>(() =>
        firstCategoryId(categories, startingType)
    );
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState(() =>
        firstCurrency(currencyOptions, defaultCurrency)
    );
    const [effect, setEffect] = useState<TransactionEffect>('normal');
    const [note, setNote] = useState('');
    const [occurredAtText, setOccurredAtText] = useState(() =>
        dateToLocalDateTimeInput(new Date(), timezone)
    );
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [undoPending, setUndoPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSaved, setLastSaved] = useState<Transaction | null>(null);
    const typedCategories = useMemo(
        () => categories.filter(category => category.type === type),
        [categories, type]
    );
    const visibleCategories = typedCategories.slice(0, 8);
    const visibleCurrencies = currencyOptions.slice(0, 4);
    const activeCategoryId =
        typedCategories.find(category => category.id === categoryId)?.id ??
        typedCategories[0]?.id;

    function handleTypeChange(nextType: TransactionType) {
        setType(nextType);
        const current = categories.find(category => category.id === categoryId);
        if (current?.type === nextType) {
            return;
        }
        setCategoryId(firstCategoryId(categories, nextType));
    }

    function resetAfterSave() {
        setAmount('');
        setNote('');
        setEffect('normal');
        setOccurredAtText(dateToLocalDateTimeInput(new Date(), timezone));
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const amountValue = Number(amount);
        const occurredAt = localDateTimeInputToDate(occurredAtText, timezone);

        if (!Number.isFinite(amountValue) || amountValue <= 0) {
            setError('Enter a positive amount.');
            return;
        }
        if (activeCategoryId === undefined) {
            setError('Choose a category.');
            return;
        }
        if (!currency) {
            setError('Choose a currency.');
            return;
        }
        if (!occurredAt) {
            setError('Choose a valid date and time.');
            return;
        }

        const formData = new FormData();
        formData.set('categoryId', String(activeCategoryId));
        formData.set('amount', String(amountValue));
        formData.set('currency', currency);
        formData.set('effect', effect);
        formData.set('occurredAt', occurredAt.toISOString());
        if (note.trim()) {
            formData.set('note', note.trim());
        }

        setPending(true);
        setError(null);
        try {
            const transaction = await createCaptureTransactionAction(formData);
            setLastSaved(transaction);
            resetAfterSave();
            router.refresh();
        } catch {
            setError('Could not save the transaction.');
        } finally {
            setPending(false);
        }
    }

    async function handleUndo() {
        if (!lastSaved) {
            return;
        }

        const formData = new FormData();
        formData.set('id', String(lastSaved.id));
        setUndoPending(true);
        setError(null);
        try {
            await deleteTransactionAction(formData);
            setLastSaved(null);
            router.refresh();
        } catch {
            setError('Could not undo the saved transaction.');
        } finally {
            setUndoPending(false);
        }
    }

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
                <CardHeader className="p-4 sm:p-6">
                    <CardTitle>Transaction</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                    <form noValidate onSubmit={handleSubmit}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor="capture-amount">
                                    Amount
                                </FieldLabel>
                                <Input
                                    autoComplete="off"
                                    className="h-14 text-2xl font-semibold"
                                    id="capture-amount"
                                    inputMode="decimal"
                                    min="0.01"
                                    name="amount"
                                    onChange={event =>
                                        setAmount(event.target.value)
                                    }
                                    placeholder="0.00"
                                    step="0.01"
                                    type="number"
                                    value={amount}
                                />
                            </Field>

                            <Field>
                                <FieldLabel>Type</FieldLabel>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['expense', 'income'] as const).map(
                                        value => (
                                            <Button
                                                aria-pressed={type === value}
                                                key={value}
                                                onClick={() =>
                                                    handleTypeChange(value)
                                                }
                                                type="button"
                                                variant={
                                                    type === value
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                            >
                                                {value === 'expense'
                                                    ? 'Expense'
                                                    : 'Income'}
                                            </Button>
                                        )
                                    )}
                                </div>
                            </Field>

                            <Field>
                                <FieldLabel>Category</FieldLabel>
                                <div className="flex flex-wrap gap-2">
                                    {visibleCategories.map(category => (
                                        <Button
                                            aria-pressed={
                                                activeCategoryId === category.id
                                            }
                                            key={category.id}
                                            onClick={() =>
                                                setCategoryId(category.id)
                                            }
                                            size="sm"
                                            type="button"
                                            variant={
                                                activeCategoryId === category.id
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                        >
                                            {category.name}
                                        </Button>
                                    ))}
                                </div>
                                <Select
                                    onValueChange={value =>
                                        setCategoryId(Number(value))
                                    }
                                    value={
                                        activeCategoryId === undefined
                                            ? ''
                                            : String(activeCategoryId)
                                    }
                                >
                                    <SelectTrigger aria-label="All categories">
                                        <SelectValue placeholder="All categories" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            {typedCategories.map(category => (
                                                <SelectItem
                                                    key={category.id}
                                                    value={String(category.id)}
                                                >
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Field>
                                <FieldLabel>Currency</FieldLabel>
                                <div className="flex flex-wrap gap-2">
                                    {visibleCurrencies.map(option => (
                                        <Button
                                            aria-pressed={
                                                currency === option.code
                                            }
                                            key={option.code}
                                            onClick={() =>
                                                setCurrency(option.code)
                                            }
                                            size="sm"
                                            type="button"
                                            variant={
                                                currency === option.code
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                        >
                                            {option.code}
                                        </Button>
                                    ))}
                                </div>
                                <Select
                                    onValueChange={setCurrency}
                                    value={currency}
                                >
                                    <SelectTrigger aria-label="All currencies">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            {currencyOptions.map(option => (
                                                <SelectItem
                                                    key={option.code}
                                                    value={option.code}
                                                >
                                                    {option.code}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Button
                                className="justify-between"
                                onClick={() =>
                                    setDetailsOpen(current => !current)
                                }
                                type="button"
                                variant="outline"
                            >
                                Details
                                <ChevronDownIcon
                                    aria-hidden
                                    className={cn(
                                        'size-4 transition-transform',
                                        detailsOpen && 'rotate-180'
                                    )}
                                />
                            </Button>

                            {detailsOpen ? (
                                <div className="grid gap-4">
                                    <Field>
                                        <FieldLabel htmlFor="capture-occurred-at">
                                            Date and time
                                        </FieldLabel>
                                        <Input
                                            id="capture-occurred-at"
                                            name="occurredAt"
                                            onChange={event =>
                                                setOccurredAtText(
                                                    event.target.value
                                                )
                                            }
                                            type="datetime-local"
                                            value={occurredAtText}
                                        />
                                    </Field>
                                    <Field>
                                        <label className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                                            <input
                                                checked={effect === 'reversal'}
                                                className="mt-0.5 size-4 rounded border-input"
                                                name="effect"
                                                onChange={event =>
                                                    setEffect(
                                                        event.target.checked
                                                            ? 'reversal'
                                                            : 'normal'
                                                    )
                                                }
                                                type="checkbox"
                                                value="reversal"
                                            />
                                            <span className="text-sm font-medium">
                                                Refund or reversal
                                            </span>
                                        </label>
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor="capture-note">
                                            Note
                                        </FieldLabel>
                                        <Input
                                            id="capture-note"
                                            maxLength={500}
                                            name="note"
                                            onChange={event =>
                                                setNote(event.target.value)
                                            }
                                            value={note}
                                        />
                                    </Field>
                                </div>
                            ) : null}

                            {error ? (
                                <FieldError role="alert">{error}</FieldError>
                            ) : null}

                            <Button
                                className="h-12 w-full"
                                disabled={pending}
                                type="submit"
                            >
                                <SaveIcon aria-hidden className="size-4" />
                                {pending ? 'Saving...' : 'Save transaction'}
                            </Button>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
                {lastSaved ? (
                    <Card>
                        <CardHeader className="p-4">
                            <div className="flex items-start gap-3">
                                <CheckCircle2Icon
                                    aria-hidden
                                    className="mt-0.5 size-5 text-emerald-600"
                                />
                                <div className="min-w-0">
                                    <CardTitle className="text-base">
                                        Saved
                                    </CardTitle>
                                    <p className="mt-1 break-words text-sm text-muted-foreground">
                                        {savedSummary(lastSaved, timezone)}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            <Button
                                className="w-full"
                                disabled={undoPending}
                                onClick={handleUndo}
                                type="button"
                                variant="outline"
                            >
                                <RotateCcwIcon aria-hidden className="size-4" />
                                {undoPending ? 'Undoing...' : 'Undo'}
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}

                <Card>
                    <CardHeader className="p-4">
                        <CardTitle className="text-base">Defaults</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2 p-4 pt-0">
                        <Badge className={directionBadgeClassName(type)}>
                            {type}
                        </Badge>
                        <Badge variant="outline">{currency}</Badge>
                        {effect === 'reversal' ? (
                            <Badge variant="outline">reversal</Badge>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
