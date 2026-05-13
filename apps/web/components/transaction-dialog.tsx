'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import type { Category, Currency, Transaction } from '@xpenser/contracts';
import { CreateTransactionBodySchema } from '@xpenser/contracts';
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
    type FormEvent,
    type ReactNode,
    useCallback,
    useEffect,
    useState
} from 'react';
import { isNextRedirectError, valuesToFormData } from './forms/form-utils';

type TransactionDialogValues = Pick<
    Transaction,
    'amount' | 'categoryId' | 'currency' | 'note'
> & {
    readonly occurredAt: Date | string | number;
};

export function TransactionDialog({
    action,
    categories,
    currencies,
    defaultCurrency,
    description,
    errorMessage,
    initialValues,
    submitLabel = 'Save',
    submittingLabel = 'Saving...',
    title,
    transactionId,
    trigger
}: {
    readonly action: (formData: FormData) => Promise<void>;
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly description: string;
    readonly errorMessage: string;
    readonly initialValues?: TransactionDialogValues;
    readonly submitLabel?: string;
    readonly submittingLabel?: string;
    readonly title: string;
    readonly transactionId?: number;
    readonly trigger: ReactNode;
}) {
    const form = useSchemaForm(CreateTransactionBodySchema);
    const categoryId = form.useField(field => field.categoryId);
    const currency = form.useField(field => field.currency);
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const categoryInvalid = categoryId.touched && Boolean(categoryId.error);
    const currencyInvalid = currency.touched && Boolean(currency.error);

    const resetForm = useCallback(() => {
        form.reset({
            amount: initialValues?.amount,
            categoryId: initialValues?.categoryId,
            currency: initialValues?.currency ?? defaultCurrency,
            occurredAt: initialValues?.occurredAt
                ? new Date(initialValues.occurredAt)
                : new Date(),
            note: initialValues?.note ?? undefined
        });
    }, [defaultCurrency, form, initialValues]);

    useEffect(() => {
        if (open) {
            resetForm();
        }
    }, [open, resetForm]);

    function handleOpenChange(nextOpen: boolean) {
        setOpen(nextOpen);
        setError(null);
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

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
                        <Field
                            data-invalid={categoryInvalid ? true : undefined}
                        >
                            <FieldLabel>Category</FieldLabel>
                            <Select
                                onOpenChange={selectOpen => {
                                    if (!selectOpen) {
                                        categoryId.onBlur();
                                    }
                                }}
                                onValueChange={value =>
                                    categoryId.onChange(Number(value))
                                }
                                value={
                                    categoryId.value === undefined
                                        ? ''
                                        : String(categoryId.value)
                                }
                            >
                                <SelectTrigger aria-invalid={categoryInvalid}>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        {categories.map(category => (
                                            <SelectItem
                                                key={category.id}
                                                value={String(category.id)}
                                            >
                                                {category.name} ({category.type}
                                                )
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
                                    onValueChange={currency.onChange}
                                    value={currency.value ?? defaultCurrency}
                                >
                                    <SelectTrigger
                                        aria-invalid={currencyInvalid}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            {currencies.map(currency => (
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
                        <SchemaField
                            forProperty={field => field.occurredAt}
                            form={form}
                            label="Date and time"
                            name="occurredAt"
                            variant="datetime-local"
                        />
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
