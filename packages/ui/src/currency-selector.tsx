'use client';

interface CurrencySelectorProps {
  value: string;
  onChange: (value: string) => void;
  currencies: string[];
  disabled?: boolean;
}

export function CurrencySelector({
  value,
  onChange,
  currencies,
  disabled = false,
}: CurrencySelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {currencies.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  );
}
