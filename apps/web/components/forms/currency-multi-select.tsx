'use client';

import type { Currency } from '@xpenser/contracts';
import { Badge, cn, FieldError, FieldLegend, FieldSet } from '@xpenser/ui';
import { ChevronDownIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CurrencyOption } from './currency-option';

export function CurrencyMultiSelect({
    currencies,
    excludedCurrency,
    selectedCurrencies,
    error,
    touched,
    onBlur,
    onChange
}: {
    readonly currencies: readonly Currency[];
    readonly excludedCurrency?: string;
    readonly selectedCurrencies: readonly string[];
    readonly error?: string;
    readonly touched?: boolean;
    readonly onBlur?: () => void;
    readonly onChange: (currencies: string[]) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const availableCurrencies = currencies.filter(
        currency => currency.code !== excludedCurrency
    );
    const selectedSet = new Set(
        selectedCurrencies.filter(currency => currency !== excludedCurrency)
    );

    function toggleCurrency(code: string, checked: boolean) {
        onChange(
            checked
                ? Array.from(new Set([...selectedSet, code])).sort()
                : Array.from(selectedSet).filter(currency => currency !== code)
        );
    }

    const closeDropdown = useCallback(() => {
        setOpen(false);
        onBlur?.();
    }, [onBlur]);

    useEffect(() => {
        if (!open) {
            return;
        }

        function handlePointerDown(event: PointerEvent) {
            const target = event.target;
            if (
                target instanceof Node &&
                !containerRef.current?.contains(target)
            ) {
                closeDropdown();
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                closeDropdown();
            }
        }

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [closeDropdown, open]);

    return (
        <FieldSet data-invalid={touched && error ? true : undefined}>
            <FieldLegend>Favorite currencies</FieldLegend>
            <div className="relative" ref={containerRef}>
                <button
                    aria-expanded={open}
                    className={cn(
                        'flex min-h-10 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring',
                        touched && error && 'border-destructive'
                    )}
                    onClick={() => {
                        if (open) {
                            closeDropdown();
                            return;
                        }
                        setOpen(true);
                    }}
                    type="button"
                >
                    <span className="truncate text-left">
                        {selectedSet.size === 0
                            ? 'Select currencies'
                            : `${selectedSet.size} selected`}
                    </span>
                    <ChevronDownIcon
                        aria-hidden
                        className="size-4 text-muted-foreground"
                    />
                </button>
                {open ? (
                    <div className="absolute z-40 mt-2 max-h-72 w-full overflow-auto rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
                        <div className="flex flex-col gap-1">
                            {availableCurrencies.map(currency => (
                                <label
                                    className="flex min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                                    key={currency.code}
                                >
                                    <input
                                        checked={selectedSet.has(currency.code)}
                                        name="favoriteCurrencies"
                                        onChange={event =>
                                            toggleCurrency(
                                                currency.code,
                                                event.target.checked
                                            )
                                        }
                                        type="checkbox"
                                        value={currency.code}
                                    />
                                    <span className="min-w-0 truncate">
                                        <CurrencyOption currency={currency} />
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                ) : null}
            </div>
            {selectedSet.size > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                    {Array.from(selectedSet).map(currency => (
                        <Badge key={currency} variant="secondary">
                            {currency}
                        </Badge>
                    ))}
                </div>
            ) : null}
            {touched && error ? <FieldError>{error}</FieldError> : null}
        </FieldSet>
    );
}
