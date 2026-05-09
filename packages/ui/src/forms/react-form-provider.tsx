'use client';

import {
    type FieldRenderProps,
    FormSystemProvider
} from '@cleverbrush/react-form';
import type * as React from 'react';
import { Field, FieldError, FieldLabel } from '../components/field.js';
import { Input } from '../components/input.js';

function textRenderer({
    value,
    onChange,
    onBlur,
    error,
    touched,
    label,
    name,
    fieldProps
}: FieldRenderProps) {
    return (
        <Field data-invalid={touched && Boolean(error) ? true : undefined}>
            {label ? <FieldLabel htmlFor={name}>{label}</FieldLabel> : null}
            <Input
                aria-invalid={touched && Boolean(error)}
                id={name}
                name={name}
                onBlur={onBlur}
                onChange={event => onChange(event.target.value)}
                value={String(value ?? '')}
                {...fieldProps}
            />
            {touched && error ? <FieldError>{error}</FieldError> : null}
        </Field>
    );
}

function numberRenderer(props: FieldRenderProps) {
    return textRenderer({
        ...props,
        fieldProps: { ...props.fieldProps, type: 'number' },
        onChange: value => props.onChange(Number(value))
    });
}

const renderers = {
    string: textRenderer,
    'string:password': (props: FieldRenderProps) =>
        textRenderer({
            ...props,
            fieldProps: { ...props.fieldProps, type: 'password' }
        }),
    number: numberRenderer
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
