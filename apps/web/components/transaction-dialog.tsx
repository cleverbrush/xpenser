'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import type { Category, Currency, Transaction } from '@xpenser/contracts';
import { CreateTransactionBodySchema } from '@xpenser/contracts';
import {
    dateToLocalDateTimeInput,
    localDateTimeInputToDate
} from '@xpenser/timezone';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
import { useRouter } from 'next/navigation';
import {
    type FormEvent,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState
} from 'react';
import { categoryEffectiveType } from '@/lib/category-display';
import { isNextRedirectError, valuesToFormData } from './forms/form-utils';

type TransactionDialogValues = Pick<
    Transaction,
    'amount' | 'categoryId' | 'currency' | 'note' | 'type'
> & {
    readonly categoryKind?: Transaction['categoryKind'];
    readonly occurredAt: Date | string | number;
};

type TransactionType = Transaction['type'];

export function TransactionDialog({
    action,
    categories,
    currencies,
    defaultCurrency,
    description,
    errorMessage,
    initialValues,
    preferredCurrency,
    submitLabel = 'Save',
    submittingLabel = 'Saving...',
    title,
    transactionId,
    trigger,
    timezone
}: {
    readonly action: (formData: FormData) => Promise<void>;
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly description: string;
    readonly errorMessage: string;
    readonly initialValues?: TransactionDialogValues;
    readonly preferredCurrency?: string;
    readonly submitLabel?: string;
    readonly submittingLabel?: string;
    readonly title: string;
    readonly transactionId?: number;
    readonly trigger: ReactNode;
    readonly timezone: string;
}) {
    const form = useSchemaForm(CreateTransactionBodySchema);
    const categoryId = form.useField(field => field.categoryId);
    const currency = form.useField(field => field.currency);
    const occurredAt = form.useField(field => field.occurredAt);
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [selectedType, setSelectedType] =
        useState<TransactionType>('expense');
    const [selectedCategoryId, setSelectedCategoryId] = useState<
        number | undefined
    >();
    const [occurredAtText, setOccurredAtText] = useState('');
    const categoryInvalid = categoryId.touched && Boolean(categoryId.error);
    const currencyInvalid = currency.touched && Boolean(currency.error);
    const occurredAtInvalid = occurredAt.touched && Boolean(occurredAt.error);
    const initialCategoryId = initialValues?.categoryId;
    const initialValueType = initialValues?.type;
    const initialType = useMemo<TransactionType>(() => {
        if (initialValueType) {
            return initialValueType;
        }

        return categories.some(
            category => categoryEffectiveType(category) === 'expense'
        )
            ? 'expense'
            : categoryEffectiveType(
                  categories[0] ?? { kind: 'normal', type: 'expense' }
              );
    }, [categories, initialValueType]);
    const filteredCategories = useMemo(
        () =>
            categories.filter(
                category => categoryEffectiveType(category) === selectedType
            ),
        [categories, selectedType]
    );
    const activeCategory = useMemo(() => {
        const selectedCategory = categories.find(
            category =>
                category.id === selectedCategoryId &&
                categoryEffectiveType(category) === selectedType
        );
        if (selectedCategory) {
            return selectedCategory;
        }

        if (!initialCategoryId || !initialValueType) {
            return undefined;
        }

        if (initialValueType !== selectedType) {
            return undefined;
        }

        return categories.find(category => category.id === initialCategoryId);
    }, [
        categories,
        initialCategoryId,
        initialValueType,
        selectedCategoryId,
        selectedType
    ]);
    const activeCategoryId = activeCategory?.id;
    const currencyOptions = useMemo(() => {
        if (
            !initialValues?.currency ||
            currencies.some(
                currency => currency.code === initialValues.currency
            )
        ) {
            return currencies;
        }

        return [
            { code: initialValues.currency, name: initialValues.currency },
            ...currencies
        ];
    }, [currencies, initialValues?.currency]);

    const initialCurrency = useMemo(() => {
        const availableCurrencyCodes = new Set(
            currencyOptions.map(option => option.code)
        );
        const fallbackCurrency = availableCurrencyCodes.has(defaultCurrency)
            ? defaultCurrency
            : (currencyOptions[0]?.code ?? defaultCurrency);
        const creationCurrency =
            preferredCurrency && availableCurrencyCodes.has(preferredCurrency)
                ? preferredCurrency
                : fallbackCurrency;
        return initialValues?.currency ?? creationCurrency;
    }, [
        currencyOptions,
        defaultCurrency,
        initialValues?.currency,
        preferredCurrency
    ]);

    const resetForm = useCallback(() => {
        const initialOccurredAt = initialValues?.occurredAt
            ? new Date(initialValues.occurredAt)
            : new Date();

        setSelectedType(initialType);
        setSelectedCategoryId(initialValues?.categoryId);
        setOccurredAtText(
            dateToLocalDateTimeInput(initialOccurredAt, timezone)
        );
        form.reset({
            amount: initialValues?.amount,
            categoryId: initialValues?.categoryId,
            currency: initialCurrency,
            occurredAt: initialOccurredAt,
            note: initialValues?.note ?? undefined
        });
    }, [form, initialCurrency, initialType, initialValues, timezone]);

    useEffect(() => {
        if (open) {
            resetForm();
        }
    }, [open, resetForm]);

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        setError(null);
    }

    function handleTypeChange(value: TransactionType) {
        setSelectedType(value);

        const currentCategory = categories.find(
            category => category.id === activeCategoryId
        );
        if (
            currentCategory &&
            categoryEffectiveType(currentCategory) === value
        ) {
            return;
        }

        const nextCategory = categories.find(
            category => categoryEffectiveType(category) === value
        );
        if (nextCategory) {
            setSelectedCategoryId(nextCategory.id);
            categoryId.onChange(nextCategory.id);
            return;
        }

        setSelectedCategoryId(undefined);
        form.setValue({ categoryId: undefined });
    }

    function handleCategoryChange(value: string) {
        const nextCategoryId = Number(value);
        setSelectedCategoryId(nextCategoryId);
        categoryId.onChange(nextCategoryId);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (activeCategoryId !== undefined) {
            form.setValue({ categoryId: activeCategoryId });
        }

        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        const formData = valuesToFormData(result.object);
        if (transactionId !== undefined) {
            formData.append('id', String(transactionId));
        }

        setPending(true);
        setError(null);
        try {
            await action(formData);
            resetForm();
            setOpen(false);
            router.refresh();
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError(errorMessage);
        } finally {
            setPending(false);
        }
    }

    return (
        <Dialog onOpenChange={handleOpenChange} open={open}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <form noValidate onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Type</FieldLabel>
                            <Select
                                onValueChange={value =>
                                    handleTypeChange(value as TransactionType)
                                }
                                value={selectedType}
                            >
                                <SelectTrigger aria-label="Transaction type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="expense">
                                            Expense
                                        </SelectItem>
                                        <SelectItem value="income">
                                            Income
                                        </SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field
                            data-invalid={categoryInvalid ? true : undefined}
                        >
                            <FieldLabel>Category</FieldLabel>
                            <Select
                                key={`${selectedType}:${
                                    activeCategoryId ?? 'none'
                                }`}
                                onOpenChange={selectOpen => {
                                    if (!selectOpen) {
                                        categoryId.onBlur();
                                    }
                                }}
                                onValueChange={handleCategoryChange}
                                value={
                                    activeCategoryId === undefined
                                        ? ''
                                        : String(activeCategoryId)
                                }
                            >
                                <SelectTrigger
                                    aria-invalid={categoryInvalid}
                                    aria-label="Transaction category"
                                >
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {filteredCategories.map(category => (
                                            <SelectItem
                                                key={category.id}
                                                value={String(category.id)}
                                            >
                                                {category.displayName}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            {categoryId.touched && categoryId.error ? (
                                <FieldError>{categoryId.error}</FieldError>
                            ) : null}
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <SchemaField
                                fieldProps={{ min: '0.01', step: '0.01' }}
                                forProperty={field => field.amount}
                                form={form}
                                label="Amount"
                                name="amount"
                            />
                            <Field
                                data-invalid={
                                    currencyInvalid ? true : undefined
                                }
                            >
                                <FieldLabel>Currency</FieldLabel>
                                <Select
                                    onOpenChange={selectOpen => {
                                        if (!selectOpen) {
                                            currency.onBlur();
                                        }
                                    }}
                                    onValueChange={value =>
                                        currency.onChange(value)
                                    }
                                    value={currency.value ?? initialCurrency}
                                >
                                    <SelectTrigger
                                        aria-invalid={currencyInvalid}
                                        aria-label="Transaction currency"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            {currencyOptions.map(currency => (
                                                <SelectItem
                                                    key={currency.code}
                                                    value={currency.code}
                                                >
                                                    {currency.code}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                {currency.touched && currency.error ? (
                                    <FieldError>{currency.error}</FieldError>
                                ) : null}
                            </Field>
                        </div>
                        <Field
                            data-invalid={occurredAtInvalid ? true : undefined}
                        >
                            <FieldLabel htmlFor="occurredAt">
                                Date and time
                            </FieldLabel>
                            <Input
                                aria-invalid={occurredAtInvalid}
                                id="occurredAt"
                                name="occurredAt"
                                onBlur={occurredAt.onBlur}
                                onChange={event => {
                                    const value = event.target.value;
                                    setOccurredAtText(value);
                                    occurredAt.onChange(
                                        localDateTimeInputToDate(
                                            value,
                                            timezone
                                        ) ?? new Date(Number.NaN)
                                    );
                                }}
                                type="datetime-local"
                                value={occurredAtText}
                            />
                            {occurredAt.touched && occurredAt.error ? (
                                <FieldError>{occurredAt.error}</FieldError>
                            ) : null}
                        </Field>
                        <SchemaField
                            forProperty={field => field.note}
                            form={form}
                            label="Note"
                            name="note"
                        />
                        {error ? (
                            <FieldError role="alert">{error}</FieldError>
                        ) : null}
                        <DialogFooter>
                            <Button
                                className="w-full sm:w-auto"
                                disabled={pending}
                                type="submit"
                            >
                                {pending ? submittingLabel : submitLabel}
                            </Button>
                        </DialogFooter>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
