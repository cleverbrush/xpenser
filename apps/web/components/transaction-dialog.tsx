'use client';

import { useSchemaForm } from '@cleverbrush/react-form';
import type {
    Category,
    Currency,
    Transaction,
    TransactionTag,
    Vendor
} from '@xpenser/contracts';
import { CreateTransactionBodySchema, FieldLimits } from '@xpenser/contracts';
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
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@xpenser/ui';
import { useRouter } from 'next/navigation';
import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState
} from 'react';
import { SchemaField } from '@/components/forms/schema-fields';
import {
    categoryEffectiveType,
    transactionCategoryOptions
} from '@/lib/category-display';
import { isNextRedirectError, valuesToFormData } from './forms/form-utils';
import { TransactionTagPicker } from './transaction-tag-picker';
import { VendorPicker } from './vendor-picker';

type TransactionDialogValues = Pick<
    Transaction,
    'amount' | 'categoryId' | 'currency' | 'vendorId' | 'note' | 'tags' | 'type'
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
    vendors,
    preferredCurrency,
    submitLabel = 'Save',
    submittingLabel = 'Saving...',
    title,
    transactionId,
    transactionTags,
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
    readonly vendors: readonly Vendor[];
    readonly preferredCurrency?: string;
    readonly submitLabel?: string;
    readonly submittingLabel?: string;
    readonly title: string;
    readonly transactionId?: number;
    readonly transactionTags: readonly TransactionTag[];
    readonly trigger: ReactNode;
    readonly timezone: string;
}) {
    const form = useSchemaForm(CreateTransactionBodySchema);
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const { submitting: pending, error } = form;
    const [selectedType, setSelectedType] =
        useState<TransactionType>('expense');
    const categoryId = form.useField(field => field.categoryId);
    const vendorId = form.useField(field => field.vendorId);
    const tags = form.useField(field => field.tags);
    const selectedCategoryId = categoryId.value;
    const selectedVendorId = vendorId.value;
    const selectedTags = tags.value ?? [];
    const [occurredAtText, setOccurredAtText] = useState('');
    const initialCategoryId = initialValues?.categoryId;
    const initialValueType = initialValues?.type;
    const selectableCategories = useMemo(
        () => transactionCategoryOptions(categories, initialCategoryId),
        [categories, initialCategoryId]
    );
    const initialType = useMemo<TransactionType>(() => {
        if (initialValueType) {
            return initialValueType;
        }

        return selectableCategories.some(
            category => categoryEffectiveType(category) === 'expense'
        )
            ? 'expense'
            : categoryEffectiveType(
                  selectableCategories[0] ?? {
                      kind: 'normal',
                      type: 'expense'
                  }
              );
    }, [initialValueType, selectableCategories]);
    const filteredCategories = useMemo(
        () =>
            selectableCategories.filter(
                category => categoryEffectiveType(category) === selectedType
            ),
        [selectableCategories, selectedType]
    );
    const activeCategory = useMemo(() => {
        const selectedCategory = selectableCategories.find(
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

        return selectableCategories.find(
            category => category.id === initialCategoryId
        );
    }, [
        initialCategoryId,
        initialValueType,
        selectableCategories,
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
        setOccurredAtText(
            dateToLocalDateTimeInput(initialOccurredAt, timezone)
        );
        form.reset({
            amount: initialValues?.amount,
            categoryId: initialValues?.categoryId,
            vendorId: initialValues?.vendorId ?? null,
            currency: initialCurrency,
            occurredAt: initialOccurredAt,
            note: initialValues?.note ?? undefined,
            tags: initialValues?.tags.map(tag => tag.name) ?? []
        });
    }, [form, initialCurrency, initialType, initialValues, timezone]);

    useEffect(() => {
        if (open) {
            resetForm();
        }
    }, [open, resetForm]);

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
    }

    function handleTypeChange(value: TransactionType) {
        setSelectedType(value);

        const currentCategory = selectableCategories.find(
            category => category.id === activeCategoryId
        );
        if (
            currentCategory &&
            categoryEffectiveType(currentCategory) === value
        ) {
            return;
        }

        const nextCategory = selectableCategories.find(
            category => categoryEffectiveType(category) === value
        );
        if (nextCategory) {
            form.setValue({ categoryId: nextCategory.id });
            return;
        }
        form.setValue({ categoryId: undefined });
    }

    function handleVendorChange(vendor: Vendor | undefined) {
        form.setValue({ vendorId: vendor?.id ?? null });

        if (!vendor?.suggestedCategoryId) {
            return;
        }

        const suggested = selectableCategories.find(
            category => category.id === vendor.suggestedCategoryId
        );
        if (!suggested) {
            return;
        }

        const suggestedType = categoryEffectiveType(suggested);
        setSelectedType(suggestedType);
        form.setValue({ categoryId: suggested.id });
    }

    const handleSubmit = form.handleSubmit(
        async values => {
            const formData = valuesToFormData(values);
            if (transactionId !== undefined) {
                formData.append('id', String(transactionId));
                formData.append('tagsTouched', 'true');
            }
            await action(formData);
        },
        {
            onSuccess: () => {
                resetForm();
                setOpen(false);
                router.refresh();
            },
            onError: caught => {
                if (isNextRedirectError(caught)) throw caught;
                return errorMessage;
            }
        }
    );

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
                                onValueChange={value => {
                                    if (
                                        value === 'expense' ||
                                        value === 'income'
                                    )
                                        handleTypeChange(value);
                                }}
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
                        <SchemaField
                            fieldProps={{
                                ariaLabel: 'Transaction category',
                                options: filteredCategories.map(category => ({
                                    label: category.displayName,
                                    value: String(category.id)
                                })),
                                placeholder: 'Select category',
                                value:
                                    activeCategoryId === undefined
                                        ? ''
                                        : String(activeCategoryId)
                            }}
                            forProperty={field => field.categoryId}
                            form={form}
                            label="Category"
                            variant="select"
                        />
                        <VendorPicker
                            vendors={vendors}
                            onChange={handleVendorChange}
                            selectedVendorId={selectedVendorId}
                        />
                        <TransactionTagPicker
                            tags={transactionTags}
                            selectedTags={selectedTags}
                            onChange={values => tags.onChange([...values])}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <SchemaField
                                fieldProps={{ min: '0.01', step: '0.01' }}
                                forProperty={field => field.amount}
                                form={form}
                                label="Amount"
                                name="amount"
                            />
                            <SchemaField
                                fieldProps={{
                                    ariaLabel: 'Transaction currency',
                                    options: currencyOptions.map(currency => ({
                                        label: currency.code,
                                        value: currency.code
                                    }))
                                }}
                                forProperty={field => field.currency}
                                form={form}
                                label="Currency"
                                variant="select"
                            />
                        </div>
                        <SchemaField
                            fieldProps={{
                                onValueChange: (value, field) => {
                                    setOccurredAtText(value);
                                    field.onChange(
                                        localDateTimeInputToDate(
                                            value,
                                            timezone
                                        ) ?? new Date(Number.NaN)
                                    );
                                },
                                value: occurredAtText
                            }}
                            forProperty={field => field.occurredAt}
                            form={form}
                            label="Date and time"
                            name="occurredAt"
                            variant="datetime-local"
                        />
                        <SchemaField
                            fieldProps={{
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
