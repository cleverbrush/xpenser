'use client';

import {
    type FieldProps,
    type FieldRenderProps,
    Field as SchemaField
} from '@cleverbrush/react-form';
import type { ObjectSchemaBuilder } from '@cleverbrush/schema';
import {
    Field,
    FieldError,
    FieldLabel,
    Input,
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@xpenser/ui';
import { type ReactNode, useId } from 'react';

type SchemaFieldProps<TSchema extends ObjectSchemaBuilder<any, any, any>> =
    Pick<FieldProps<TSchema>, 'forProperty' | 'form'>;

export type SchemaSelectOption = {
    readonly label: ReactNode;
    readonly value: string;
};

export function SchemaSelectField<
    TSchema extends ObjectSchemaBuilder<any, any, any>
>({
    ariaLabel,
    disabled = false,
    forProperty,
    form,
    label,
    onChange,
    options,
    placeholder,
    value
}: SchemaFieldProps<TSchema> & {
    readonly ariaLabel?: string;
    readonly disabled?: boolean;
    readonly label: string;
    readonly onChange?: (value: string, field: FieldRenderProps) => void;
    readonly options: readonly SchemaSelectOption[];
    readonly placeholder?: string;
    readonly value?: string;
}) {
    return (
        <SchemaField
            forProperty={forProperty}
            form={form}
            renderer={field => {
                const invalid = field.touched && Boolean(field.error);
                const selectedValue = value ?? String(field.value ?? '');

                return (
                    <Field data-invalid={invalid ? true : undefined}>
                        <FieldLabel>{label}</FieldLabel>
                        <Select
                            disabled={disabled}
                            onOpenChange={open => {
                                if (!open) {
                                    field.onBlur();
                                }
                            }}
                            onValueChange={nextValue => {
                                if (onChange) {
                                    onChange(nextValue, field);
                                    return;
                                }
                                field.onChange(nextValue);
                            }}
                            value={selectedValue}
                        >
                            <SelectTrigger
                                aria-invalid={invalid}
                                aria-label={ariaLabel ?? label}
                            >
                                <SelectValue placeholder={placeholder} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {options.map(option => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        {field.touched && field.error ? (
                            <FieldError>{field.error}</FieldError>
                        ) : null}
                    </Field>
                );
            }}
        />
    );
}

export function SchemaCheckboxField<
    TSchema extends ObjectSchemaBuilder<any, any, any>
>({
    checked,
    description,
    disabled = false,
    forProperty,
    form,
    label,
    onChange
}: SchemaFieldProps<TSchema> & {
    readonly checked?: boolean;
    readonly description?: ReactNode;
    readonly disabled?: boolean;
    readonly label: string;
    readonly onChange?: (checked: boolean, field: FieldRenderProps) => void;
}) {
    const inputId = useId();

    return (
        <SchemaField
            forProperty={forProperty}
            form={form}
            renderer={field => {
                const invalid = field.touched && Boolean(field.error);
                const selectedChecked = checked ?? Boolean(field.value);

                return (
                    <Field data-invalid={invalid ? true : undefined}>
                        <label
                            className="flex items-start gap-3 text-sm"
                            htmlFor={inputId}
                        >
                            <Input
                                aria-invalid={invalid}
                                checked={selectedChecked}
                                className="mt-0.5 size-4"
                                disabled={disabled}
                                id={inputId}
                                onBlur={field.onBlur}
                                onChange={event => {
                                    const nextChecked = event.target.checked;
                                    if (onChange) {
                                        onChange(nextChecked, field);
                                        return;
                                    }
                                    field.onChange(nextChecked);
                                }}
                                type="checkbox"
                            />
                            <span>
                                <span className="block font-medium">
                                    {label}
                                </span>
                                {description ? (
                                    <span className="text-muted-foreground">
                                        {description}
                                    </span>
                                ) : null}
                            </span>
                        </label>
                        {field.touched && field.error ? (
                            <FieldError>{field.error}</FieldError>
                        ) : null}
                    </Field>
                );
            }}
        />
    );
}

export function SchemaDateTimeField<
    TSchema extends ObjectSchemaBuilder<any, any, any>
>({
    forProperty,
    form,
    label,
    onChange,
    value
}: SchemaFieldProps<TSchema> & {
    readonly label: string;
    readonly onChange: (value: string, field: FieldRenderProps) => void;
    readonly value: string;
}) {
    return (
        <SchemaField
            forProperty={forProperty}
            form={form}
            renderer={field => {
                const invalid = field.touched && Boolean(field.error);

                return (
                    <Field data-invalid={invalid ? true : undefined}>
                        <FieldLabel htmlFor="occurredAt">{label}</FieldLabel>
                        <Input
                            aria-invalid={invalid}
                            id="occurredAt"
                            name="occurredAt"
                            onBlur={field.onBlur}
                            onChange={event =>
                                onChange(event.target.value, field)
                            }
                            type="datetime-local"
                            value={value}
                        />
                        {field.touched && field.error ? (
                            <FieldError>{field.error}</FieldError>
                        ) : null}
                    </Field>
                );
            }}
        />
    );
}
