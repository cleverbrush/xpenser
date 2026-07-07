'use client';

import type { Currency } from '@xpenser/contracts';
import { Badge, Button } from '@xpenser/ui';
import { XIcon } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

function currencyLabel(currency: Currency): string {
    return currency.name
        ? `${currency.code} - ${currency.name}`
        : currency.code;
}

function normalizeCurrency(value: string): string {
    return value.trim().toUpperCase();
}

function uniqueCurrencies(
    values: readonly string[],
    defaultCurrency: string
): string[] {
    const result: string[] = [];
    const seen = new Set<string>();
    const normalizedDefault = normalizeCurrency(defaultCurrency);
    for (const value of values) {
        const currency = normalizeCurrency(value);
        if (
            !/^[A-Z]{3}$/.test(currency) ||
            currency === normalizedDefault ||
            seen.has(currency)
        ) {
            continue;
        }
        seen.add(currency);
        result.push(currency);
    }
    return result;
}

function CurrencyChipSelector({
    currencies,
    defaultCurrency,
    inputId,
    selectedCurrencies
}: {
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly inputId: string;
    readonly selectedCurrencies: readonly string[];
}) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(() =>
        uniqueCurrencies(selectedCurrencies, defaultCurrency)
    );
    const normalizedDefault = normalizeCurrency(defaultCurrency);
    const availableCodes = useMemo(
        () => new Set(currencies.map(currency => currency.code)),
        [currencies]
    );
    const datalistId = `${inputId}-options`;
    const effectiveSelected = uniqueCurrencies(selected, normalizedDefault);
    const suggestions = currencies.filter(currency => {
        if (
            currency.code === normalizedDefault ||
            effectiveSelected.includes(currency.code)
        ) {
            return false;
        }
        const needle = query.trim().toLowerCase();
        return (
            needle === '' ||
            currency.code.toLowerCase().includes(needle) ||
            currency.name.toLowerCase().includes(needle)
        );
    });

    function addCurrency(value: string) {
        const currency = normalizeCurrency(value);
        if (
            currency === normalizedDefault ||
            !availableCodes.has(currency) ||
            effectiveSelected.includes(currency)
        ) {
            return;
        }
        setSelected(current =>
            uniqueCurrencies([...current, currency], normalizedDefault)
        );
        setQuery('');
    }

    function removeCurrency(value: string) {
        setSelected(current => current.filter(item => item !== value));
    }

    return (
        <div className="grid gap-2 text-sm">
            <label className="font-medium" htmlFor={inputId}>
                Favorite currencies
            </label>
            <div className="flex flex-wrap gap-2">
                {effectiveSelected.map(currency => (
                    <Badge
                        className="gap-1 rounded-full px-2 py-1"
                        key={currency}
                        variant="secondary"
                    >
                        {currency}
                        <button
                            aria-label={`Remove ${currency}`}
                            className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => removeCurrency(currency)}
                            type="button"
                        >
                            <XIcon aria-hidden className="size-3" />
                        </button>
                        <input
                            name="favoriteCurrencies"
                            type="hidden"
                            value={currency}
                        />
                    </Badge>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
                    id={inputId}
                    list={datalistId}
                    onChange={event => setQuery(event.currentTarget.value)}
                    onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ',') {
                            event.preventDefault();
                            addCurrency(query);
                        }
                    }}
                    placeholder="Search currency"
                    value={query}
                />
                <Button
                    onClick={() => addCurrency(query)}
                    type="button"
                    variant="outline"
                >
                    Add
                </Button>
            </div>
            <datalist id={datalistId}>
                {suggestions.slice(0, 20).map(currency => (
                    <option
                        key={currency.code}
                        label={currencyLabel(currency)}
                        value={currency.code}
                    />
                ))}
            </datalist>
        </div>
    );
}

export function BudgetCurrencyFields({
    currencies,
    defaultCurrency,
    idPrefix,
    selectedCurrencies
}: {
    readonly currencies: readonly Currency[];
    readonly defaultCurrency: string;
    readonly idPrefix?: string;
    readonly selectedCurrencies: readonly string[];
}) {
    const generatedId = useId();
    const fieldId = idPrefix ?? generatedId;
    const [primary, setPrimary] = useState(defaultCurrency);

    return (
        <>
            <label className="grid gap-1 text-sm">
                <span className="font-medium">Primary</span>
                <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    defaultValue={defaultCurrency}
                    name="defaultCurrency"
                    onChange={event => setPrimary(event.currentTarget.value)}
                >
                    {currencies.map(currency => (
                        <option key={currency.code} value={currency.code}>
                            {currency.code}
                        </option>
                    ))}
                </select>
            </label>
            <CurrencyChipSelector
                currencies={currencies}
                defaultCurrency={primary}
                inputId={`${fieldId}-favorite-currencies`}
                selectedCurrencies={selectedCurrencies}
            />
        </>
    );
}
