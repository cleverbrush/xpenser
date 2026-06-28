'use client';

import type { ComponentPropsWithoutRef } from 'react';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatAmount, formatMoney } from '@/lib/format';
import { hiddenAmountLabel, useAmountPrivacy } from './amount-privacy';

type AmountDisplayProps = ComponentPropsWithoutRef<'span'> & {
    readonly value: number;
    readonly currency: string;
    readonly compact?: boolean;
    readonly compactThreshold?: number;
};

type TooltipPosition = {
    readonly left: number;
    readonly top: number;
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
    const { hideAmounts } = useAmountPrivacy();
    const tooltipId = useId();
    const amountRef = useRef<HTMLSpanElement>(null);
    const [tooltipPosition, setTooltipPosition] =
        useState<TooltipPosition | null>(null);
    const formatted = formatAmount(value, currency, {
        compact,
        compactThreshold
    });
    const exact = formatMoney(value, currency);
    const hasExactTooltip = !hideAmounts && formatted !== exact;
    function showTooltip() {
        if (!hasExactTooltip) {
            return;
        }

        const rect = amountRef.current?.getBoundingClientRect();
        if (!rect) {
            return;
        }

        setTooltipPosition({
            left: rect.left + rect.width / 2,
            top: rect.top - 6
        });
    }

    function hideTooltip() {
        setTooltipPosition(null);
    }

    return (
        <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: compact amounts expose an exact-value tooltip on hover without becoming an action. */}
            <span
                {...props}
                className={`inline-flex tabular-nums ${className ?? ''}`}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                ref={amountRef}
                title={hideAmounts ? 'Amounts hidden' : title}
            >
                {hideAmounts ? hiddenAmountLabel : formatted}
            </span>
            {hasExactTooltip && tooltipPosition
                ? createPortal(
                      <span
                          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md"
                          id={tooltipId}
                          role="tooltip"
                          style={{
                              left: tooltipPosition.left,
                              top: tooltipPosition.top
                          }}
                      >
                          {exact}
                      </span>,
                      document.body
                  )
                : null}
        </>
    );
}
