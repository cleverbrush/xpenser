interface AmountDisplayProps {
  amount: number;
  currency: string;
  className?: string;
}

export function AmountDisplay({ amount, currency, className = '' }: AmountDisplayProps) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return (
    <span
      className={`font-mono tabular-nums ${
        amount < 0 ? 'text-destructive' : amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
      } ${className}`}
    >
      {formatted}
    </span>
  );
}
