'use client';

import type { Currency } from '@xpenser/contracts';
import { Button, cn } from '@xpenser/ui';
import { CheckIcon, SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dashboardCurrencyOptions } from '@/lib/dashboard-currencies';
import {
    type DashboardPeriod,
    parseDateParam,
    periodHref
} from '@/lib/dashboard-periods';

export function DashboardViewSettingsMenu({
    basePath,
    currencies,
    currentDate,
    defaultCurrency,
    favoriteCurrencies,
    period,
    selectedCurrency,
    timezone
}: {
    readonly basePath: string;
    readonly currencies: readonly Currency[];
    readonly currentDate: string;
    readonly defaultCurrency: string;
    readonly favoriteCurrencies: readonly string[];
    readonly period: DashboardPeriod;
    readonly selectedCurrency: string;
    readonly timezone: string;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const defaultCurrencyCode = defaultCurrency.trim().toUpperCase();
    const selectedCurrencyCode = selectedCurrency.trim().toUpperCase();
    const anchorDate = useMemo(
        () => parseDateParam(currentDate, timezone) ?? new Date(),
        [currentDate, timezone]
    );
    const currencyOptions = useMemo(
        () =>
            dashboardCurrencyOptions(
                currencies,
                defaultCurrency,
                favoriteCurrencies
            ),
        [currencies, defaultCurrency, favoriteCurrencies]
    );

    const closeMenu = useCallback(() => {
        setOpen(false);
    }, []);

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
                closeMenu();
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                closeMenu();
            }
        }

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [closeMenu, open]);

    function currencyHref(currency: string): string {
        return periodHref(basePath, period, anchorDate, {
            cleanDefault: true,
            extraParams: currency === defaultCurrencyCode ? {} : { currency },
            timeZone: timezone
        });
    }

    return (
        <div className="relative" ref={containerRef}>
            <Button
                aria-expanded={open}
                aria-label="View settings"
                className="shrink-0"
                onClick={() => setOpen(current => !current)}
                size="icon-sm"
                type="button"
                variant="outline"
            >
                <SettingsIcon aria-hidden className="size-4" />
            </Button>
            {open ? (
                <div
                    className="absolute right-0 z-40 mt-2 w-64 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                    role="menu"
                >
                    <div className="px-2 py-1.5 text-xs font-medium uppercase text-muted-foreground">
                        Display currency
                    </div>
                    <div className="flex flex-col gap-1">
                        {currencyOptions.map(currency => {
                            const selected =
                                currency.code === selectedCurrencyCode;
                            return (
                                <Link
                                    aria-checked={selected}
                                    className={cn(
                                        'flex min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
                                        selected && 'bg-accent/70'
                                    )}
                                    href={currencyHref(currency.code)}
                                    key={currency.code}
                                    onClick={closeMenu}
                                    prefetch={false}
                                    role="menuitemradio"
                                >
                                    <span className="flex size-4 shrink-0 items-center justify-center">
                                        {selected ? (
                                            <CheckIcon
                                                aria-hidden
                                                className="size-4"
                                            />
                                        ) : null}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block font-medium">
                                            {currency.code}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                            {currency.name}
                                        </span>
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
