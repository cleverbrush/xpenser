'use client';

import {
    type FieldRenderer,
    type FieldRenderProps,
    FormSystemProvider
} from '@cleverbrush/react-form';
import type * as React from 'react';
import { Field, FieldError, FieldLabel } from '../components/field.js';
import { Input } from '../components/input.js';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '../components/select.js';

export type SelectRendererOption = {
    readonly label: React.ReactNode;
    readonly value: string;
};

export type SelectRendererFieldProps = {
    readonly ariaLabel?: string;
    readonly disabled?: boolean;
    readonly onValueChange?: (value: string, field: FieldRenderProps) => void;
    readonly options?: readonly SelectRendererOption[];
    readonly placeholder?: string;
    readonly value?: string;
};

export type CheckboxRendererFieldProps = {
    readonly checked?: boolean;
    readonly description?: React.ReactNode;
    readonly disabled?: boolean;
    readonly id?: string;
    readonly onCheckedChange?: (
        checked: boolean,
        field: FieldRenderProps
    ) => void;
};

export type DateTimeRendererFieldProps =
    React.InputHTMLAttributes<HTMLInputElement> & {
        readonly onValueChange?: (
            value: string,
            field: FieldRenderProps
        ) => void;
        readonly value?: string;
    };

function inputFieldProps(
    fieldProps: FieldRenderProps['fieldProps']
): React.InputHTMLAttributes<HTMLInputElement> {
    return {
        ...(fieldProps ?? {})
    } as React.InputHTMLAttributes<HTMLInputElement>;
}

function formatDateTimeLocalValue(value: unknown) {
    if (value instanceof Date) {
        const offset = value.getTimezoneOffset() * 60_000;
        return new Date(value.getTime() - offset).toISOString().slice(0, 16);
    }
    return String(value ?? '');
}

const textRenderer: FieldRenderer = ({
    value,
    onChange,
    onBlur,
    error,
    touched,
    label,
    name,
    fieldProps
}: FieldRenderProps) => {
    const invalid = touched && Boolean(error);

    return (
        <Field data-invalid={invalid ? true : undefined}>
            {label ? <FieldLabel htmlFor={name}>{label}</FieldLabel> : null}
            <Input
                {...fieldProps}
                aria-invalid={invalid}
                id={name}
                name={name}
                onBlur={onBlur}
                onChange={event => onChange(event.target.value)}
                value={String(value ?? '')}
            />
            {touched && error ? <FieldError>{error}</FieldError> : null}
        </Field>
    );
};

const selectRenderer: FieldRenderer = (props: FieldRenderProps) => {
    const {
        ariaLabel,
        disabled = false,
        onValueChange,
        options = [],
        placeholder,
        value
    } = (props.fieldProps ?? {}) as SelectRendererFieldProps;
    const invalid = props.touched && Boolean(props.error);
    const selectedValue = value ?? String(props.value ?? '');

    return (
        <Field data-invalid={invalid ? true : undefined}>
            {props.label ? <FieldLabel>{props.label}</FieldLabel> : null}
            <Select
                disabled={disabled}
                onOpenChange={open => {
                    if (!open) {
                        props.onBlur();
                    }
                }}
                onValueChange={nextValue => {
                    if (onValueChange) {
                        onValueChange(nextValue, props);
                        return;
                    }
                    props.onChange(nextValue);
                }}
                value={selectedValue}
            >
                <SelectTrigger
                    aria-invalid={invalid}
                    aria-label={ariaLabel ?? props.label}
                >
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {options.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
            {props.touched && props.error ? (
                <FieldError>{props.error}</FieldError>
            ) : null}
        </Field>
    );
};

const numberSelectRenderer: FieldRenderer = (props: FieldRenderProps) => {
    return selectRenderer({
        ...props,
        onChange: value =>
            props.onChange(value === '' ? undefined : Number(value))
    });
};

const checkboxRenderer: FieldRenderer = (props: FieldRenderProps) => {
    const {
        checked,
        description,
        disabled = false,
        id,
        onCheckedChange
    } = (props.fieldProps ?? {}) as CheckboxRendererFieldProps;
    const invalid = props.touched && Boolean(props.error);
    const selectedChecked = checked ?? Boolean(props.value);

    return (
        <Field data-invalid={invalid ? true : undefined}>
            <label className="flex items-start gap-3 text-sm" htmlFor={id}>
                <Input
                    aria-invalid={invalid}
                    checked={selectedChecked}
                    className="mt-0.5 size-4"
                    disabled={disabled}
                    id={id}
                    name={props.name}
                    onBlur={props.onBlur}
                    onChange={event => {
                        const nextChecked = event.target.checked;
                        if (onCheckedChange) {
                            onCheckedChange(nextChecked, props);
                            return;
                        }
                        props.onChange(nextChecked);
                    }}
                    type="checkbox"
                />
                <span>
                    {props.label ? (
                        <span className="block font-medium">{props.label}</span>
                    ) : null}
                    {description ? (
                        <span className="text-muted-foreground">
                            {description}
                        </span>
                    ) : null}
                </span>
            </label>
            {props.touched && props.error ? (
                <FieldError>{props.error}</FieldError>
            ) : null}
        </Field>
    );
};

const numberRenderer: FieldRenderer = (props: FieldRenderProps) => {
    return textRenderer({
        ...props,
        fieldProps: { ...props.fieldProps, type: 'number' },
        onChange: value =>
            props.onChange(value === '' ? undefined : Number(value))
    });
};

const dateTimeRenderer: FieldRenderer = (props: FieldRenderProps) => {
    const { onValueChange, value, ...fieldProps } = inputFieldProps(
        props.fieldProps
    ) as DateTimeRendererFieldProps;

    return textRenderer({
        ...props,
        fieldProps: { ...fieldProps, type: 'datetime-local' },
        onChange: nextValue => {
            if (onValueChange) {
                onValueChange(String(nextValue), props);
                return;
            }
            props.onChange(nextValue);
        },
        value:
            typeof value === 'string'
                ? value
                : formatDateTimeLocalValue(props.value)
    });
};

const renderers = {
    string: textRenderer,
    'string:email': (props: FieldRenderProps) =>
        textRenderer({
            ...props,
            fieldProps: { ...props.fieldProps, type: 'email' }
        }),
    'string:password': (props: FieldRenderProps) =>
        textRenderer({
            ...props,
            fieldProps: { ...props.fieldProps, type: 'password' }
        }),
    'string:checkbox': checkboxRenderer,
    'string:select': selectRenderer,
    number: numberRenderer,
    'number:select': numberSelectRenderer,
    'boolean:checkbox': checkboxRenderer,
    date: dateTimeRenderer,
    'date:datetime-local': dateTimeRenderer
};

export function XpenserFormProvider({
    children
}: {
    readonly children: React.ReactNode;
}) {
    return (
        <FormSystemProvider renderers={renderers}>
            {children}
        </FormSystemProvider>
    );
}
