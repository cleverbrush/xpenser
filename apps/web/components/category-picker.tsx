'use client';

import {
    Field,
    FieldError,
    FieldLabel,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@xpenser/ui';
import { useId } from 'react';

type CategoryOption = { readonly id: number; readonly displayName: string };

export function CategoryPicker({
    categories,
    value,
    onChange,
    onBlur,
    ariaLabel = 'Transaction category',
    error,
    touched = false
}: {
    readonly categories: readonly CategoryOption[];
    readonly value: number | undefined;
    readonly onChange: (value: number) => void;
    readonly onBlur?: () => void;
    readonly ariaLabel?: string;
    readonly error?: string | null;
    readonly touched?: boolean;
}) {
    const id = useId();
    const invalid = touched && Boolean(error);
    return (
        <Field data-invalid={invalid || undefined}>
            <FieldLabel htmlFor={id}>Category</FieldLabel>
            <Select
                value={value === undefined ? '' : String(value)}
                onOpenChange={open => {
                    if (!open) onBlur?.();
                }}
                onValueChange={next => {
                    if (next !== '') onChange(Number(next));
                }}
            >
                <SelectTrigger
                    id={id}
                    aria-label={ariaLabel}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? `${id}-error` : undefined}
                >
                    <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {categories.map(category => (
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
            {invalid ? (
                <FieldError id={`${id}-error`}>{error}</FieldError>
            ) : null}
        </Field>
    );
}
