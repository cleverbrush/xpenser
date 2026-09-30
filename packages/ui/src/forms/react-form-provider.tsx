'use client';

import {
    createFormSystem,
    defineFieldRenderer,
    type FieldRenderProps
} from '@cleverbrush/react-form';
import type * as React from 'react';
import { useId } from 'react';
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
import { Textarea } from '../components/textarea.js';

/** Give unnamed schema fields stable IDs for labels and server-error descriptions. */
function AccessibleField<T, P>({
    field,
    render
}: {
    field: FieldRenderProps<T, P>;
    render: (field: FieldRenderProps<T, P>) => React.ReactNode;
}) {
    const generatedId = useId();
    return render({ ...field, name: field.name ?? generatedId });
}

function accessibleRenderer<T, P>(
    render: (field: FieldRenderProps<T, P>) => React.ReactNode
) {
    return defineFieldRenderer<T, P>(field => (
        <AccessibleField field={field} render={render} />
    ));
}

type Binding<T> = Pick<
    FieldRenderProps<T>,
    'value' | 'initialValue' | 'onChange' | 'setValue'
>;
type InputProps = Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'defaultValue' | 'onChange' | 'onBlur'
>;
type TextareaProps = Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    'value' | 'defaultValue' | 'onChange' | 'onBlur'
>;

export type SelectRendererOption = {
    readonly label: React.ReactNode;
    readonly value: string;
};

/** Optional presentation and value conversion for schema-bound selects. */
export type SelectRendererFieldProps<T = string> = {
    readonly ariaLabel?: string;
    readonly disabled?: boolean;
    readonly onValueChange?: (value: string, field: Binding<T>) => void;
    readonly options?: readonly SelectRendererOption[];
    readonly placeholder?: string;
    readonly value?: string;
};

export type CheckboxRendererFieldProps<T = boolean> = {
    readonly checked?: boolean;
    readonly description?: React.ReactNode;
    readonly disabled?: boolean;
    readonly id?: string;
    readonly onCheckedChange?: (checked: boolean, field: Binding<T>) => void;
};

/** The text buffer lets an application apply its own timezone conversion. */
export type DateTimeRendererFieldProps = InputProps & {
    readonly onValueChange?: (value: string, field: Binding<Date>) => void;
    readonly value?: string;
};

function formatDateTimeLocalValue(value: Date | undefined) {
    if (!value || !Number.isFinite(value.getTime())) return '';
    const offset = value.getTimezoneOffset() * 60_000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function renderInput<T, P extends InputProps>(
    field: FieldRenderProps<T, P>,
    value: string,
    onChange: (value: string) => void,
    inputProps: InputProps = field.fieldProps ?? {}
) {
    const invalid = field.touched && Boolean(field.error);
    return (
        <Field
            data-disabled={inputProps.disabled || undefined}
            data-invalid={invalid || undefined}
        >
            {field.label ? (
                <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
            ) : null}
            <Input
                {...inputProps}
                aria-invalid={invalid}
                aria-describedby={
                    invalid ? String(field.name) + '-error' : undefined
                }
                id={field.name}
                name={field.name}
                onBlur={field.onBlur}
                onChange={event => onChange(event.target.value)}
                value={value}
            />
            {field.touched && field.error ? (
                <FieldError id={String(field.name) + '-error'}>
                    {field.error}
                </FieldError>
            ) : null}
        </Field>
    );
}

const textRenderer = accessibleRenderer<string, InputProps>(field =>
    renderInput(field, field.value ?? '', field.onChange)
);
const emailRenderer = accessibleRenderer<string, InputProps>(field =>
    renderInput(field, field.value ?? '', field.onChange, {
        ...field.fieldProps,
        type: 'email'
    })
);
const passwordRenderer = accessibleRenderer<string, InputProps>(field =>
    renderInput(field, field.value ?? '', field.onChange, {
        ...field.fieldProps,
        type: 'password'
    })
);
const textareaRenderer = accessibleRenderer<string | null, TextareaProps>(
    field => {
        const invalid = field.touched && Boolean(field.error);
        return (
            <Field
                data-disabled={field.fieldProps?.disabled || undefined}
                data-invalid={invalid || undefined}
            >
                {field.label ? (
                    <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
                ) : null}
                <Textarea
                    {...field.fieldProps}
                    aria-invalid={invalid}
                    aria-describedby={
                        invalid ? String(field.name) + '-error' : undefined
                    }
                    id={field.name}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={event => field.onChange(event.target.value)}
                    value={field.value ?? ''}
                />
                {field.touched && field.error ? (
                    <FieldError id={String(field.name) + '-error'}>
                        {field.error}
                    </FieldError>
                ) : null}
            </Field>
        );
    }
);

function renderSelect<T>(
    field: FieldRenderProps<T, SelectRendererFieldProps<T>>,
    decode: (value: string) => T
) {
    const {
        ariaLabel,
        disabled = false,
        onValueChange,
        options = [],
        placeholder,
        value
    } = field.fieldProps ?? {};
    const invalid = field.touched && Boolean(field.error);
    return (
        <Field
            data-disabled={disabled || undefined}
            data-invalid={invalid || undefined}
        >
            {field.label ? (
                <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
            ) : null}
            <Select
                disabled={disabled}
                onOpenChange={open => {
                    if (!open) field.onBlur();
                }}
                onValueChange={nextValue => {
                    // Radix's hidden native select can emit an empty change
                    // while reset values and options synchronize. Empty items
                    // are forbidden; clearing is controlled by the form (or an
                    // explicit option such as "none"), not this notification.
                    if (nextValue === '') return;
                    if (onValueChange) onValueChange(nextValue, field);
                    else field.onChange(decode(nextValue));
                }}
                value={value ?? String(field.value ?? '')}
            >
                <SelectTrigger
                    aria-invalid={invalid}
                    aria-describedby={
                        invalid ? String(field.name) + '-error' : undefined
                    }
                    aria-label={ariaLabel ?? field.label}
                    id={field.name}
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
            {field.touched && field.error ? (
                <FieldError id={String(field.name) + '-error'}>
                    {field.error}
                </FieldError>
            ) : null}
        </Field>
    );
}

const selectRenderer = accessibleRenderer<string, SelectRendererFieldProps>(
    field => renderSelect(field, value => value)
);
const numberSelectRenderer = accessibleRenderer<
    number | null | undefined,
    SelectRendererFieldProps<number | null | undefined>
>(field =>
    renderSelect(field, value => (value === '' ? undefined : Number(value)))
);

function renderCheckbox<T>(
    field: FieldRenderProps<T, CheckboxRendererFieldProps<T>>,
    decode: (checked: boolean) => T
) {
    const {
        checked,
        description,
        disabled = false,
        id = field.name,
        onCheckedChange
    } = field.fieldProps ?? {};
    const invalid = field.touched && Boolean(field.error);
    return (
        <Field
            data-disabled={disabled || undefined}
            data-invalid={invalid || undefined}
        >
            <label className="flex items-start gap-3 text-sm" htmlFor={id}>
                <Input
                    aria-invalid={invalid}
                    aria-describedby={
                        invalid ? String(field.name) + '-error' : undefined
                    }
                    checked={checked ?? Boolean(field.value)}
                    className="mt-0.5 size-4"
                    disabled={disabled}
                    id={id}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={event => {
                        if (onCheckedChange)
                            onCheckedChange(event.target.checked, field);
                        else field.onChange(decode(event.target.checked));
                    }}
                    type="checkbox"
                />
                <span>
                    {field.label ? (
                        <span className="block font-medium">{field.label}</span>
                    ) : null}
                    {description ? (
                        <span className="text-muted-foreground">
                            {description}
                        </span>
                    ) : null}
                </span>
            </label>
            {field.touched && field.error ? (
                <FieldError id={String(field.name) + '-error'}>
                    {field.error}
                </FieldError>
            ) : null}
        </Field>
    );
}
const checkboxRenderer = accessibleRenderer<
    boolean,
    CheckboxRendererFieldProps
>(field => renderCheckbox(field, checked => checked));
// String checkboxes must supply an explicit mapping (for example normal/offset).
type StringCheckboxProps = CheckboxRendererFieldProps<string> &
    Required<
        Pick<CheckboxRendererFieldProps<string>, 'checked' | 'onCheckedChange'>
    >;
const stringCheckboxRenderer = accessibleRenderer<string, StringCheckboxProps>(
    field => renderCheckbox(field, String)
);
const numberRenderer = accessibleRenderer<
    number | null | undefined,
    InputProps
>(field =>
    renderInput(
        field,
        String(field.value ?? ''),
        value => field.onChange(value === '' ? undefined : Number(value)),
        { ...field.fieldProps, type: 'number' }
    )
);
const dateTimeRenderer = accessibleRenderer<Date, DateTimeRendererFieldProps>(
    field => {
        const { onValueChange, value, ...inputProps } = field.fieldProps ?? {};
        return renderInput(
            field,
            value ?? formatDateTimeLocalValue(field.value),
            nextValue => {
                if (onValueChange) onValueChange(nextValue, field);
                else field.onChange(new Date(nextValue));
            },
            { ...inputProps, type: 'datetime-local' }
        );
    }
);

/** A closed, typed registry. Compose app-specific renderers from .renderers. */
const renderers = {
    string: textRenderer,
    'string:email': emailRenderer,
    'string:password': passwordRenderer,
    'string:textarea': textareaRenderer,
    'string:checkbox': stringCheckboxRenderer,
    'string:select': selectRenderer,
    number: numberRenderer,
    'number:select': numberSelectRenderer,
    'boolean:checkbox': checkboxRenderer,
    date: dateTimeRenderer,
    'date:datetime-local': dateTimeRenderer
};

export const XpenserFormSystem: ReturnType<
    typeof createFormSystem<typeof renderers>
> = createFormSystem({ renderers });

/** Also registers the adapters for legacy Field consumers. */
export const XpenserFormProvider = XpenserFormSystem.Provider;
