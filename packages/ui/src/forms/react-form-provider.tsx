'use client';

import {
    type FieldRenderer,
    type FieldRenderProps,
    FormSystemProvider
} from '@cleverbrush/react-form';
import type * as React from 'react';
import { Field, FieldError, FieldLabel } from '../components/field.js';
import { Input } from '../components/input.js';

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

const numberRenderer: FieldRenderer = (props: FieldRenderProps) => {
    return textRenderer({
        ...props,
        fieldProps: { ...props.fieldProps, type: 'number' },
        onChange: value =>
            props.onChange(value === '' ? undefined : Number(value))
    });
};

const dateTimeRenderer: FieldRenderer = (props: FieldRenderProps) => {
    return textRenderer({
        ...props,
        fieldProps: { ...props.fieldProps, type: 'datetime-local' },
        value: formatDateTimeLocalValue(props.value)
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
    number: numberRenderer,
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
