'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import {
    type Category,
    CreateTransactionBodySchema,
    type Currency,
    FieldLimits,
    type Transaction,
    type TransactionTag,
    type Vendor
} from '@xpenser/contracts';
import {
    dateToLocalDateTimeInput,
    localDateTimeInputToDate
} from '@xpenser/timezone';
import {
    Button,
    Card,
    CardContent,
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
import { CheckCircle2Icon, RotateCcwIcon, SaveIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useMemo, useState } from 'react';
import {
    createCaptureTransactionAction,
    deleteTransactionAction
} from '@/lib/actions';
import {
    categoryEffectiveType,
    transactionCategoryOptions
} from '@/lib/category-display';
import { formatDateTime, formatTransactionMoney } from '@/lib/format';
import { transactionCurrencyOptions } from '@/lib/transaction-currencies';
import { hiddenAmountLabel, useAmountPrivacy } from './amount-privacy';
import { valuesToFormData } from './forms/form-utils';
import { TransactionTagPicker } from './transaction-tag-picker';
import { VendorPicker } from './vendor-picker';

type TransactionType = Category['type'];

const CATEGORY_BATCH_SIZE = 4;

function initialType(categories: readonly Category[]): TransactionType {
    return categories.some(
        category => categoryEffectiveType(category) === 'expense'
    )
        ? 'expense'
        : categoryEffectiveType(
              categories[0] ?? { kind: 'normal', type: 'expense' }
          );
}

function firstCategoryId(
    categories: readonly Category[],
    type: TransactionType
): number | undefined {
    return categories.find(category => categoryEffectiveType(category) === type)
        ?.id;
}

function firstCurrency(
    currencies: readonly Currency[],
    defaultCurrency: string
): string {
    return currencies[0]?.code ?? defaultCurrency;
}

function parseCaptureAmount(value: string): number | undefined {
    const normalized = value.trim().replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
        return undefined;
    }

    const amount = Number(normalized);
    return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

function savedSummary(
    transaction: Transaction,
    timezone: string,
    hideAmounts: boolean
) {
    const vendor = transaction.vendorName ? `${transaction.vendorName} - ` : '';
    const amount = hideAmounts
        ? hiddenAmountLabel
        : formatTransactionMoney(
              transaction.amount,
              transaction.currency,
              transaction.type,
              transaction.categoryKind
          );
    return `${vendor}${transaction.categoryDisplayName} - ${amount} - ${formatDateTime(transaction.occurredAt, timezone)}`;
}

export function QuickCaptureForm({
    categories,
    currencies,
    defaultCurrency,
    vendors,
    transactionTags,
    timezone,
    transactionCurrencies
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly vendors: readonly Vendor[];
    readonly transactionTags: readonly TransactionTag[];
    readonly timezone: string;
    readonly transactionCurrencies: readonly string[];
}) {
    const form = useSchemaForm(CreateTransactionBodySchema);
    const router = useRouter();
    const { hideAmounts } = useAmountPrivacy();
    const currencyOptions = useMemo(
        () =>
            transactionCurrencyOptions(
                currencies,
                defaultCurrency,
                transactionCurrencies
            ),
        [currencies, defaultCurrency, transactionCurrencies]
    );
    const transactionCategories = useMemo(
        () => transactionCategoryOptions(categories),
        [categories]
    );
    const startingType = useMemo(
        () => initialType(transactionCategories),
        [transactionCategories]
    );
    const [type, setType] = useState<TransactionType>(startingType);
    const [categoryId, setCategoryId] = useState<number | undefined>(() =>
        firstCategoryId(transactionCategories, startingType)
    );
    const [vendorId, setVendorId] = useState<number | null>(null);
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState(() =>
        firstCurrency(currencyOptions, defaultCurrency)
    );
    const [selectedTags, setSelectedTags] = useState<readonly string[]>([]);
    const [occurredAtText, setOccurredAtText] = useState(() =>
        dateToLocalDateTimeInput(new Date(), timezone)
    );
    const [visibleCategoryCount, setVisibleCategoryCount] =
        useState(CATEGORY_BATCH_SIZE);
    const [pending, setPending] = useState(false);
    const [undoPending, setUndoPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSaved, setLastSaved] = useState<Transaction | null>(null);
    const typedCategories = useMemo(
        () =>
            transactionCategories.filter(
                category => categoryEffectiveType(category) === type
            ),
        [transactionCategories, type]
    );
    const activeCategoryId =
        typedCategories.find(category => category.id === categoryId)?.id ??
        typedCategories[0]?.id;
    const visibleCategories = typedCategories.slice(0, visibleCategoryCount);
    const hasMoreCategories = visibleCategoryCount < typedCategories.length;

    function handleTypeChange(nextType: TransactionType) {
        setType(nextType);
        setVisibleCategoryCount(CATEGORY_BATCH_SIZE);
        const current = transactionCategories.find(
            category => category.id === categoryId
        );
        if (current && categoryEffectiveType(current) === nextType) {
            return;
        }
        setCategoryId(firstCategoryId(transactionCategories, nextType));
    }

    function handleVendorChange(vendor: Vendor | undefined) {
        setVendorId(vendor?.id ?? null);

        if (!vendor?.suggestedCategoryId) {
            return;
        }

        const suggested = transactionCategories.find(
            category => category.id === vendor.suggestedCategoryId
        );
        if (!suggested) {
            return;
        }

        setType(categoryEffectiveType(suggested));
        setCategoryId(suggested.id);
        setVisibleCategoryCount(CATEGORY_BATCH_SIZE);
        form.setValue({ categoryId: suggested.id });
    }

    function resetAfterSave() {
        const nextOccurredAt = new Date();
        setAmount('');
        setVendorId(null);
        setSelectedTags([]);
        setOccurredAtText(dateToLocalDateTimeInput(nextOccurredAt, timezone));
        form.reset({
            amount: undefined,
            categoryId: activeCategoryId,
            vendorId: null,
            currency,
            occurredAt: nextOccurredAt,
            note: undefined,
            tags: []
        });
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const amountValue = parseCaptureAmount(amount);
        const occurredAt = localDateTimeInputToDate(occurredAtText, timezone);

        if (amountValue === undefined) {
            setError('Enter a positive amount with up to two decimals.');
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

        form.setValue({
            amount: amountValue,
            categoryId: activeCategoryId,
            vendorId,
            currency,
            occurredAt,
            tags: [...selectedTags]
        });

        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        const formData = valuesToFormData({
            ...result.object,
            tags: selectedTags
        });

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

    if (transactionCategories.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:p-6">
                    <div>
                        <p className="text-sm font-medium">
                            No active categories
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Restore or add a category before creating
                            transactions.
                        </p>
                    </div>
                    <Button asChild className="w-full sm:w-auto">
                        <Link href="/settings/categories">
                            Manage categories
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <Card className="overflow-visible">
                <CardContent className="p-4 sm:p-6">
                    <form
                        className="pb-20 sm:pb-0"
                        noValidate
                        onSubmit={handleSubmit}
                    >
                        <FieldGroup className="gap-3 sm:gap-4">
                            <Field className="gap-2">
                                <FieldLabel htmlFor="capture-amount">
                                    Amount
                                </FieldLabel>
                                <div className="grid grid-cols-[minmax(0,1fr)_5.25rem] gap-2">
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
                                        type="text"
                                        value={amount}
                                    />
                                    <Select
                                        onValueChange={setCurrency}
                                        value={currency}
                                    >
                                        <SelectTrigger
                                            aria-label="Currency"
                                            className="h-14 w-[5.25rem] px-2 text-base font-semibold [&>svg]:size-4"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="min-w-[5.25rem]">
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
                                </div>
                            </Field>

                            <VendorPicker
                                vendors={vendors}
                                onChange={handleVendorChange}
                                selectedVendorId={vendorId}
                            />

                            <TransactionTagPicker
                                tags={transactionTags}
                                selectedTags={selectedTags}
                                onChange={setSelectedTags}
                            />

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
                                            className="max-w-[9.5rem] justify-start overflow-hidden"
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
                                            title={category.displayName}
                                        >
                                            <span className="truncate">
                                                {category.displayName}
                                            </span>
                                        </Button>
                                    ))}
                                    {hasMoreCategories ? (
                                        <Button
                                            onClick={() =>
                                                setVisibleCategoryCount(
                                                    current =>
                                                        current +
                                                        CATEGORY_BATCH_SIZE
                                                )
                                            }
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                        >
                                            Load more
                                        </Button>
                                    ) : null}
                                </div>
                            </Field>

                            <Field>
                                <FieldLabel htmlFor="capture-occurred-at">
                                    Date and time
                                </FieldLabel>
                                <Input
                                    id="capture-occurred-at"
                                    name="occurredAt"
                                    onChange={event =>
                                        setOccurredAtText(event.target.value)
                                    }
                                    type="datetime-local"
                                    value={occurredAtText}
                                />
                            </Field>

                            <SchemaField
                                fieldProps={{
                                    autoComplete: 'off',
                                    maxLength: FieldLimits.transactionNote,
                                    rows: 4
                                }}
                                forProperty={field => field.note}
                                form={form}
                                label="Note"
                                name="note"
                                variant="textarea"
                            />

                            {error ? (
                                <FieldError role="alert">{error}</FieldError>
                            ) : null}

                            <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 border-t bg-background/95 px-3 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
                                <Button
                                    className="h-12 w-full"
                                    disabled={pending}
                                    type="submit"
                                >
                                    <SaveIcon aria-hidden className="size-4" />
                                    {pending ? 'Saving...' : 'Save transaction'}
                                </Button>
                            </div>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>

            {lastSaved ? (
                <Card>
                    <CardContent className="flex items-center gap-3 p-3">
                        <CheckCircle2Icon
                            aria-hidden
                            className="size-5 shrink-0 text-emerald-600"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">Saved</p>
                            <p className="truncate text-sm text-muted-foreground">
                                {savedSummary(lastSaved, timezone, hideAmounts)}
                            </p>
                        </div>
                        <div className="shrink-0">
                            <Button
                                disabled={undoPending}
                                onClick={handleUndo}
                                size="sm"
                                type="button"
                                variant="outline"
                            >
                                <RotateCcwIcon aria-hidden className="size-4" />
                                {undoPending ? 'Undoing...' : 'Undo'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : null}
        </div>
    );
}
