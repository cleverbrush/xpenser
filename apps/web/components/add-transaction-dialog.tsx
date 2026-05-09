'use client';

import type { Category, Currency } from '@xpenser/contracts';
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
import { PlusIcon } from 'lucide-react';
import { createTransactionAction } from '@/lib/actions';

export function AddTransactionDialog({
    categories,
    currencies,
    defaultCurrency
}: {
    readonly categories: readonly Category[];
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
}) {
    const now = new Date().toISOString().slice(0, 16);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button>
                    <PlusIcon data-icon="inline-start" />
                    Add transaction
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
                <form action={createTransactionAction}>
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Category</FieldLabel>
                            <Select name="categoryId" required>
                                <SelectTrigger>
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
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field>
                                <FieldLabel htmlFor="amount">Amount</FieldLabel>
                                <Input
                                    id="amount"
                                    min="0.01"
                                    name="amount"
                                    required
                                    step="0.01"
                                    type="number"
                                />
                            </Field>
                            <Field>
                                <FieldLabel>Currency</FieldLabel>
                                <Select
                                    defaultValue={defaultCurrency}
                                    name="currency"
                                    required
                                >
                                    <SelectTrigger>
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
                            </Field>
                        </div>
                        <Field>
                            <FieldLabel htmlFor="occurredAt">
                                Date and time
                            </FieldLabel>
                            <Input
                                defaultValue={now}
                                id="occurredAt"
                                name="occurredAt"
                                required
                                type="datetime-local"
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="note">Note</FieldLabel>
                            <Input id="note" name="note" />
                        </Field>
                        <DialogFooter>
                            <Button type="submit">Save</Button>
                        </DialogFooter>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
