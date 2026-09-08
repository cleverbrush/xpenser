'use client';

import { createFormSystem, defineFieldRenderer } from '@cleverbrush/react-form';
import type { Currency } from '@xpenser/contracts';
import { XpenserFormSystem } from '@xpenser/ui';
import { CurrencyMultiSelect } from './currency-multi-select';

export type CurrencyMultiSelectRendererFieldProps = {
    readonly currencies: readonly Currency[];
    readonly excludedCurrency?: string;
};

const currencyMultiSelectRenderer = defineFieldRenderer<
    string[],
    CurrencyMultiSelectRendererFieldProps
>(field => (
    <CurrencyMultiSelect
        currencies={field.fieldProps?.currencies ?? []}
        error={field.error}
        excludedCurrency={field.fieldProps?.excludedCurrency}
        onBlur={field.onBlur}
        onChange={field.onChange}
        selectedCurrencies={field.value ?? []}
        touched={field.touched}
    />
));

const webFormSystem = createFormSystem({
    renderers: {
        ...XpenserFormSystem.renderers,
        'array:currency-multi-select': currencyMultiSelectRenderer
    }
});

export const SchemaField = webFormSystem.Field;
export const XpenserWebFormProvider = webFormSystem.Provider;
