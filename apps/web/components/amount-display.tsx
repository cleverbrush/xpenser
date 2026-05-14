import { cn } from '@xpenser/ui';
import type { ComponentPropsWithoutRef } from 'react';
import { formatAmount, formatMoney } from '@/lib/format';

type AmountDisplayProps = ComponentPropsWithoutRef<'span'> & {
    readonly value: number;
    readonly currency: string;
    readonly compact?: boolean;
    readonly compactThreshold?: number;
};

export function AmountDisplay({
    className,
    compact = true,
    compactThreshold,
    currency,
    title,
    value,
    ...props
}: AmountDisplayProps) {
    const formatted = formatAmount(value, currency, {
        compact,
        compactThreshold
    });
    const exact = formatMoney(value, currency);

    return (
        <span
            className={cn('tabular-nums', className)}
            title={title ?? (formatted === exact ? undefined : exact)}
            {...props}
        >
            {formatted}
        </span>
    );
}
