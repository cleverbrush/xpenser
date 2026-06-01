import { defaultTimeZone, formatDateInTimeZone } from '@xpenser/timezone';

type DateInput = Date | string | number;
type TransactionType = 'expense' | 'income';
type CategoryKind = 'normal' | 'offset';
type MoneyFormatOptions = {
    readonly compact?: boolean;
    readonly compactThreshold?: number;
};

const defaultCompactThreshold = 10_000;
const compactMoneyUnits = [
    { divisor: 1_000_000_000_000, suffix: 't' },
    { divisor: 1_000_000_000, suffix: 'b' },
    { divisor: 1_000_000, suffix: 'm' },
    { divisor: 1_000, suffix: 'k' }
] as const;

function toDate(value: DateInput): Date {
    return value instanceof Date ? value : new Date(value);
}

export function formatDate(
    value: DateInput,
    timeZone = defaultTimeZone
): string {
    const date = toDate(value);
    return Number.isNaN(date.getTime())
        ? ''
        : formatDateInTimeZone(date, timeZone, {});
}

export function formatDateTime(
    value: DateInput,
    timeZone = defaultTimeZone
): string {
    const date = toDate(value);
    return Number.isNaN(date.getTime())
        ? ''
        : formatDateInTimeZone(date, timeZone, {
              dateStyle: 'short',
              timeStyle: 'short'
          });
}

function formatCompactMoney(value: number, currency: string): string {
    const magnitude = Math.abs(value);
    const fallbackUnit = compactMoneyUnits[compactMoneyUnits.length - 1]!;
    const unit =
        compactMoneyUnits.find(item => magnitude >= item.divisor) ??
        fallbackUnit;
    const scaled = value / unit.divisor;

    return `${new Intl.NumberFormat('en-US', {
        currency,
        maximumFractionDigits: 1,
        style: 'currency'
    }).format(scaled)}${unit.suffix}`;
}

export function formatMoney(
    value: number,
    currency: string,
    options: MoneyFormatOptions = {}
): string {
    if (
        options.compact &&
        Math.abs(value) >= (options.compactThreshold ?? defaultCompactThreshold)
    ) {
        return formatCompactMoney(value, currency);
    }

    return new Intl.NumberFormat('en-US', {
        currency,
        maximumFractionDigits: 2,
        style: 'currency'
    }).format(value);
}

export function formatAmount(
    value: number,
    currency: string,
    options: MoneyFormatOptions = {}
): string {
    return formatMoney(value, currency, options);
}

export function signedAmountForType(
    value: number,
    type: TransactionType
): number {
    return type === 'expense' ? -Math.abs(value) : Math.abs(value);
}

export function formatDirectionalMoney(
    value: number,
    currency: string,
    type: TransactionType
): string {
    return formatMoney(signedAmountForType(value, type), currency);
}

export function signedAmountForTransaction(
    value: number,
    type: TransactionType,
    kind: CategoryKind = 'normal'
): number {
    void kind;
    return signedAmountForType(value, type);
}

export function formatTransactionMoney(
    value: number,
    currency: string,
    type: TransactionType,
    kind: CategoryKind = 'normal'
): string {
    return formatMoney(signedAmountForTransaction(value, type, kind), currency);
}

export function signedCategoryTotal(
    value: number,
    type: TransactionType
): number {
    return type === 'expense' ? -value : value;
}

export function formatCategoryTotalMoney(
    value: number,
    currency: string,
    type: TransactionType
): string {
    return formatMoney(signedCategoryTotal(value, type), currency);
}

export function amountClassNameForType(type: TransactionType): string {
    return type === 'expense'
        ? 'text-rose-700 dark:text-rose-400'
        : 'text-emerald-700 dark:text-emerald-400';
}

export function amountClassNameForTransaction(
    value: number,
    type: TransactionType,
    kind: CategoryKind = 'normal'
): string {
    return amountClassNameForValue(
        signedAmountForTransaction(value, type, kind)
    );
}

export function amountClassNameForCategoryTotal(
    value: number,
    type: TransactionType
): string {
    return amountClassNameForValue(signedCategoryTotal(value, type));
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

export function directionBadgeClassName(type: TransactionType): string {
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

export function formatSignedPercent(value: number): string {
    const formatted = formatPercent(value);
    return value > 0 ? `+${formatted}` : formatted;
}

export function percentChangeClassNameForCategory(
    value: number,
    type: TransactionType
): string {
    return amountClassNameForValue(type === 'expense' ? -value : value);
}
