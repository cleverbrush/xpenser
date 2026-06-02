'use client';

import {
    type FieldRenderer,
    type FieldRenderProps,
    FormSystemProvider
} from '@cleverbrush/react-form';
import type { Currency } from '@xpenser/contracts';
import { XpenserFormProvider } from '@xpenser/ui';
import type * as React from 'react';
import { CurrencyMultiSelect } from './currency-multi-select';

export type CurrencyMultiSelectRendererFieldProps = {
    readonly currencies?: readonly Currency[];
    readonly excludedCurrency?: string;
    readonly onChange?: (values: string[], field: FieldRenderProps) => void;
    readonly selectedCurrencies?: readonly string[];
};

const currencyMultiSelectRenderer: FieldRenderer = (
    field: FieldRenderProps
) => {
    const {
        currencies = [],
        excludedCurrency,
        onChange,
        selectedCurrencies
    } = (field.fieldProps ?? {}) as CurrencyMultiSelectRendererFieldProps;
    const selected =
        selectedCurrencies ??
        (Array.isArray(field.value) ? field.value.map(String) : []);

    return (
        <CurrencyMultiSelect
            currencies={currencies}
            error={field.error}
            excludedCurrency={excludedCurrency}
            onBlur={field.onBlur}
            onChange={values => {
                if (onChange) {
                    onChange(values, field);
                    return;
                }
                field.onChange(values);
            }}
            selectedCurrencies={selected}
            touched={field.touched}
        />
    );
};

const webRenderers = {
    'array:currency-multi-select': currencyMultiSelectRenderer
};

export function XpenserWebFormProvider({
    children
}: {
    readonly children: React.ReactNode;
}) {
    return (
        <XpenserFormProvider>
            <FormSystemProvider renderers={webRenderers}>
                {children}
            </FormSystemProvider>
        </XpenserFormProvider>
    );
}
