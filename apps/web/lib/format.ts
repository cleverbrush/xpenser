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

export function formatPercent(value: number): string {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 1,
        style: 'percent'
    }).format(value / 100);
}
