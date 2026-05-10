type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
    return value instanceof Date ? value : new Date(value);
}

export function formatDate(value: DateInput): string {
    const date = toDate(value);
    return Number.isNaN(date.getTime())
        ? ''
        : new Intl.DateTimeFormat('en-US').format(date);
}

export function formatDateTime(value: DateInput): string {
    const date = toDate(value);
    return Number.isNaN(date.getTime())
        ? ''
        : new Intl.DateTimeFormat('en-US', {
              dateStyle: 'short',
              timeStyle: 'short'
          }).format(date);
}

export function formatMoney(value: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
        currency,
        maximumFractionDigits: 2,
        style: 'currency'
    }).format(value);
}

export function signedAmountForType(
    value: number,
    type: 'expense' | 'income'
): number {
    return type === 'expense' ? -Math.abs(value) : Math.abs(value);
}

export function formatDirectionalMoney(
    value: number,
    currency: string,
    type: 'expense' | 'income'
): string {
    return formatMoney(signedAmountForType(value, type), currency);
}

export function amountClassNameForType(type: 'expense' | 'income'): string {
    return type === 'expense'
        ? 'text-rose-700 dark:text-rose-400'
        : 'text-emerald-700 dark:text-emerald-400';
}

export function amountClassNameForValue(value: number): string {
    if (value < 0) {
        return 'text-rose-700 dark:text-rose-400';
    }
    if (value > 0) {
        return 'text-emerald-700 dark:text-emerald-400';
    }
    return 'text-muted-foreground';
}

export function directionBadgeClassName(type: 'expense' | 'income'): string {
    return type === 'expense'
        ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';
}

export function formatPercent(value: number): string {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 1,
        style: 'percent'
    }).format(value / 100);
}
