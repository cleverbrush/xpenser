'use client';

import { Field as SchemaField, useSchemaForm } from '@cleverbrush/react-form';
import type { Category, Currency } from '@xpenser/contracts';
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
import { PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { createTransactionAction } from '@/lib/actions';
import { isNextRedirectError, valuesToFormData } from './forms/form-utils';

export function AddTransactionDialog({
    categories,
    currencies,
    defaultCurrency
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
}) {
    const form = useSchemaForm(CreateTransactionBodySchema);
    const categoryId = form.useField(field => field.categoryId);
    const currency = form.useField(field => field.currency);
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const initialOccurredAt = useMemo(() => new Date(), []);
    const categoryInvalid = categoryId.touched && Boolean(categoryId.error);
    const currencyInvalid = currency.touched && Boolean(currency.error);

    useEffect(() => {
        form.reset({
            currency: defaultCurrency,
            occurredAt: initialOccurredAt
        });
    }, [defaultCurrency, form, initialOccurredAt]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const result = await form.submit();
        if (!result.valid || !result.object) {
            return;
        }

        setPending(true);
        setError(null);
        try {
            await createTransactionAction(valuesToFormData(result.object));
            form.reset({
                currency: defaultCurrency,
                occurredAt: new Date()
            });
            setOpen(false);
            router.refresh();
        } catch (caught) {
            if (isNextRedirectError(caught)) {
                throw caught;
            }
            setError('Could not save the transaction.');
        } finally {
            setPending(false);
        }
    }

    return (
        <Dialog onOpenChange={setOpen} open={open}>
            <DialogTrigger asChild>
                <Button className="w-auto self-start" size="sm">
                    <PlusIcon aria-hidden className="size-4" />
                    <span className="sm:hidden">Add</span>
                    <span className="hidden sm:inline">Add transaction</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add transaction</DialogTitle>
                    <DialogDescription>
                        Amounts are stored in the original currency and
                        converted for reports.
                    </DialogDescription>
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
                                {pending ? 'Saving...' : 'Save'}
                            </Button>
                        </DialogFooter>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
