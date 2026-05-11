import type { Currency } from '@xpenser/contracts';
import { getCurrencyDisplay } from '@/lib/currency-display';

export function CurrencyOption({ currency }: { readonly currency: Currency }) {
    const display = getCurrencyDisplay(currency);

    return (
        <span className="flex min-w-0 items-center gap-2">
            {display.flag ? (
                <span aria-hidden className="shrink-0">
                    {display.flag}
                </span>
            ) : null}
            <span className="min-w-0">
                <span className="font-medium">{display.regionName}</span>
                <span className="text-muted-foreground">
                    {' '}
                    ({currency.code} - {currency.name})
                </span>
            </span>
        </span>
    );
}
